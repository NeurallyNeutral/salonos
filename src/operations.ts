import { merchant } from './auth';
import { Row, stmt, rows, owner, fail, now, audit } from './core';
import { eraseCustomer, retentionSweep } from './privacy';
merchant.get('/customers/:id/export', async (c) => {
  const m = owner(c),
    db = c.env.DB,
    key = c.req.param('id'),
    customer = await stmt(
      db,
      'SELECT id,name,phone,email,suppressed,created_at FROM customers WHERE tenant_id=? AND id=?',
      m.tenant_id,
      key,
    ).first<Row>();
  if (!customer) fail(404, 'not_found');
  const bookings = await rows(
    db,
    'SELECT id,service_id,resource_id,starts_at,ends_at,status,price_centimes,source,consent_email,consent_whatsapp,consent_marketing,consent_at FROM bookings WHERE tenant_id=? AND customer_id=?',
    m.tenant_id,
    key,
  );
  const ledger = await rows(
    db,
    'SELECT kind,amount_centimes,created_at,expires_at FROM loyalty_ledger WHERE tenant_id=? AND customer_id=?',
    m.tenant_id,
    key,
  );
  const payments = await rows(
    db,
    'SELECT id,amount_centimes,redeemed_centimes,verification,created_at FROM payment_records WHERE tenant_id=? AND customer_id=?',
    m.tenant_id,
    key,
  );
  await audit(db, m.tenant_id, m.id, 'customer_export', key).run();
  const refunds = await rows(
    db,
    'SELECT r.id,r.payment_id,r.cash_centimes,r.credit_centimes,r.reason,r.created_at FROM refund_records r JOIN payment_records p ON p.tenant_id=r.tenant_id AND p.id=r.payment_id WHERE p.tenant_id=? AND p.customer_id=?',
    m.tenant_id,
    key,
  );
  const notifications = await rows(
    db,
    'SELECT kind,channel,state,due_at,accepted_at,delivered_at FROM notification_outbox WHERE tenant_id=? AND customer_id=?',
    m.tenant_id,
    key,
  );
  c.header('Content-Disposition', 'attachment; filename="dossier-client.json"');
  return c.json({ customer, bookings, payments, refunds, ledger, notifications });
});
merchant.post('/customers/:id/erase', async (c) => {
  const m = owner(c),
    key = c.req.param('id');
  if (
    !(await stmt(
      c.env.DB,
      'SELECT id FROM customers WHERE tenant_id=? AND id=?',
      m.tenant_id,
      key,
    ).first())
  )
    fail(404, 'not_found');
  await eraseCustomer(c.env, m.tenant_id, key, m.id);
  return c.json({ ok: true });
});
merchant.post('/retention/run', async (c) => {
  const m = owner(c);
  return c.json({ anonymized: await retentionSweep(c.env, m.tenant_id) });
});
merchant.get('/health', async (c) => {
  const tid = c.get('merchant').tenant_id;
  return c.json({
    queue: await rows(
      c.env.DB,
      'SELECT state,COUNT(*) count,MIN(due_at) oldest_due_at FROM notification_outbox WHERE tenant_id=? GROUP BY state',
      tid,
    ),
    overdue: (await stmt(
      c.env.DB,
      "SELECT COUNT(*) count FROM notification_outbox WHERE tenant_id=? AND state IN ('pending','failed_retryable') AND due_at<?",
      tid,
      now() - 1800000,
    ).first<Row>())!.count,
    alerts: await rows(
      c.env.DB,
      'SELECT kind,subject,created_at FROM operations_alerts WHERE tenant_id=? AND resolved_at IS NULL',
      tid,
    ),
  });
});
