import { merchant } from './auth';
import { Row, stmt, rows, str, flag, fail, audit, integer } from './core';
merchant.get('/customers', async (c) => {
  const offset = integer(Number(c.req.query('offset') ?? 0), 0, 10000000);
  const customers = await rows(
    c.env.DB,
    "SELECT c.id,c.name,c.phone,c.email,c.suppressed,c.created_at,COUNT(b.id) visits FROM customers c LEFT JOIN bookings b ON b.tenant_id=c.tenant_id AND b.customer_id=c.id AND b.status='completed' WHERE c.tenant_id=? GROUP BY c.id ORDER BY c.name,c.id LIMIT 101 OFFSET ?",
    c.get('merchant').tenant_id,
    offset,
  );
  return c.json({
    customers: customers.slice(0, 100),
    next_offset: customers.length > 100 ? offset + 100 : null,
  });
});
merchant.patch('/customers/:id', async (c) => {
  const m = c.get('merchant'),
    b = await c.req.json<Row>(),
    db = c.env.DB,
    current = await stmt(
      db,
      'SELECT * FROM customers WHERE tenant_id=? AND id=?',
      m.tenant_id,
      c.req.param('id'),
    ).first<Row>();
  if (!current) fail(404, 'not_found');
  await db.batch([
    stmt(
      db,
      'UPDATE customers SET name=?,suppressed=? WHERE tenant_id=? AND id=?',
      str(b.name ?? current.name, 100),
      flag(b.suppressed ?? current.suppressed),
      m.tenant_id,
      current.id,
    ),
    audit(db, m.tenant_id, m.id, 'customer_updated', current.id),
  ]);
  return c.json({ ok: true });
});
merchant.get('/metrics', async (c) => {
  const tid = c.get('merchant').tenant_id,
    db = c.env.DB;
  const counts = await stmt(
    db,
    "SELECT COUNT(*) processed_bookings,COALESCE(SUM(status='completed'),0) completed_visits,COALESCE(SUM(status='no_show'),0) no_shows,COALESCE(SUM(status IN ('completed','no_show')),0) attendance_denominator,COALESCE(SUM(CASE WHEN status!='cancelled' THEN price_centimes ELSE 0 END),0) booked_value_centimes FROM bookings WHERE tenant_id=?",
    tid,
  ).first<Row>();
  const repeats = await stmt(
    db,
    "SELECT COUNT(*) n FROM (SELECT customer_id FROM bookings WHERE tenant_id=? AND status='completed' GROUP BY customer_id HAVING COUNT(*)>1)",
    tid,
  ).first<Row>();
  const paid = await stmt(
    db,
    'SELECT COALESCE(SUM(amount_centimes),0) paid FROM payment_records WHERE tenant_id=?',
    tid,
  ).first<Row>();
  const refunds = await stmt(
    db,
    'SELECT COALESCE(SUM(cash_centimes),0) refunded FROM refund_records WHERE tenant_id=?',
    tid,
  ).first<Row>();
  const loyalty = await stmt(
    db,
    "SELECT COALESCE(SUM(CASE WHEN kind='earn' THEN amount_centimes ELSE 0 END),0) issued,COALESCE(SUM(CASE WHEN kind='redeem' THEN -amount_centimes ELSE 0 END),0) redeemed FROM loyalty_ledger WHERE tenant_id=?",
    tid,
  ).first<Row>();
  return c.json({
    ...counts,
    repeat_customers: repeats!.n,
    merchant_reported_paid_centimes: paid!.paid,
    refunded_centimes: refunds!.refunded,
    merchant_reported_net_centimes: paid!.paid - refunds!.refunded,
    loyalty_issued_centimes: loyalty!.issued,
    loyalty_redeemed_centimes: loyalty!.redeemed,
    deliveries: await rows(
      db,
      'SELECT state,COUNT(*) count FROM notification_outbox WHERE tenant_id=? GROUP BY state',
      tid,
    ),
    processor_verified_value: null,
    payment_reporting: 'merchant_reported',
  });
});
export function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
merchant.get('/export.csv', async (c) => {
  const m = c.get('merchant'),
    db = c.env.DB,
    cutoff = Date.now();
  await audit(c.env.DB, m.tenant_id, m.id, 'booking_csv_export').run();
  const columns = ['id', 'name', 'phone', 'starts_at', 'status', 'source', 'price_centimes'];
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', 'attachment; filename="salonos-reservations.csv"');
  const encoder = new TextEncoder();
  let cursor = '';
  return c.body(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('\uFEFF' + columns.map(csvCell).join(',') + '\r\n'));
      },
      async pull(controller) {
        try {
          const data = await rows(
            db,
            'SELECT b.id,c.name,c.phone,b.starts_at,b.status,b.source,b.price_centimes FROM bookings b JOIN customers c ON c.tenant_id=b.tenant_id AND c.id=b.customer_id WHERE b.tenant_id=? AND b.id>? AND b.created_at<=? ORDER BY b.id LIMIT 500',
            m.tenant_id,
            cursor,
            cutoff,
          );
          if (!data.length) {
            controller.close();
            return;
          }
          cursor = data[data.length - 1].id;
          controller.enqueue(
            encoder.encode(
              data.map((r) => columns.map((k) => csvCell(r[k])).join(',')).join('\r\n') + '\r\n',
            ),
          );
        } catch {
          controller.error(new Error('export_failed'));
        }
      },
    }),
  );
});
