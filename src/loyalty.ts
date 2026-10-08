import { merchant } from './auth';
import { Row, owner, stmt, rows, now, id, str, integer, hash, fail, audit } from './core';
import { expireCredits, retentionMessage } from './retention';
function idem(value: unknown) {
  const key = str(value, 100);
  if (!/^[a-zA-Z0-9_-]{32,100}$/.test(key)) fail(400, 'invalid_idempotency_key');
  return key;
}
merchant.get('/customers/:id/loyalty', async (c) => {
  const tid = c.get('merchant').tenant_id,
    key = c.req.param('id'),
    db = c.env.DB;
  if (!(await stmt(db, 'SELECT id FROM customers WHERE tenant_id=? AND id=?', tid, key).first()))
    fail(404, 'not_found');
  await expireCredits(c.env, tid);
  const balance =
    (
      await stmt(
        db,
        'SELECT balance_centimes FROM loyalty_balances WHERE tenant_id=? AND customer_id=?',
        tid,
        key,
      ).first<Row>()
    )?.balance_centimes ?? 0;
  return c.json({
    balance_centimes: balance,
    redeemable_centimes: Math.max(0, balance),
    ledger: await rows(
      db,
      'SELECT id,kind,amount_centimes,expires_at,created_at FROM loyalty_ledger WHERE tenant_id=? AND customer_id=? ORDER BY created_at,id',
      tid,
      key,
    ),
  });
});
merchant.get('/bookings/:id/payments', async (c) => {
  const tid = c.get('merchant').tenant_id,
    booking = c.req.param('id');
  if (
    !(await stmt(
      c.env.DB,
      'SELECT id FROM bookings WHERE tenant_id=? AND id=?',
      tid,
      booking,
    ).first())
  )
    fail(404, 'not_found');
  return c.json({
    payments: await rows(
      c.env.DB,
      'SELECT p.*,COALESCE((SELECT SUM(cash_centimes) FROM refund_records WHERE tenant_id=p.tenant_id AND payment_id=p.id),0) refunded_cash,COALESCE((SELECT SUM(credit_centimes) FROM refund_records WHERE tenant_id=p.tenant_id AND payment_id=p.id),0) refunded_credit FROM payment_records p WHERE p.tenant_id=? AND p.booking_id=?',
      tid,
      booking,
    ),
  });
});
merchant.post('/bookings/:id/payments', async (c) => {
  const m = owner(c),
    db = c.env.DB,
    b = await c.req.json<Row>(),
    key = idem(c.req.header('Idempotency-Key')),
    bookingId = c.req.param('id');
  if (b.actual_payment_received !== true) fail(400, 'payment_confirmation_required');
  const amount = integer(b.amount_centimes, 0, 10000000),
    eligible = integer(b.eligible_centimes ?? amount, 0, amount),
    redeemed = integer(b.redeemed_centimes ?? 0, 0, 10000000),
    authorization = b.customer_verified_in_person === true ? 'in_person_verified' : 'none',
    receipt = b.receipt_reference ? str(b.receipt_reference, 100) : null;
  const requestHash = await hash(
    JSON.stringify({ bookingId, amount, eligible, redeemed, authorization, receipt }),
  );
  const replay = async () => {
    const old = await stmt(
      db,
      'SELECT id,request_hash FROM payment_records WHERE tenant_id=? AND idempotency_key=?',
      m.tenant_id,
      key,
    ).first<Row>();
    if (old && old.request_hash !== requestHash) fail(409, 'idempotency_mismatch');
    return old;
  };
  const old = await replay();
  if (old) return c.json({ id: old.id });
  const booking = await stmt(
    db,
    'SELECT * FROM bookings WHERE tenant_id=? AND id=?',
    m.tenant_id,
    bookingId,
  ).first<Row>();
  if (!booking) fail(404, 'not_found');
  if (booking.status !== 'completed') fail(409, 'completed_visit_required');
  const t = (await stmt(db, 'SELECT * FROM tenants WHERE id=?', m.tenant_id).first<Row>())!,
    payment = id(),
    earned = Math.min(Math.floor((eligible * t.loyalty_bps) / 10000), t.loyalty_cap);
  await expireCredits(c.env, m.tenant_id);
  const q = [
    stmt(
      db,
      'INSERT INTO payment_records(id,tenant_id,booking_id,customer_id,amount_centimes,eligible_centimes,redeemed_centimes,earned_centimes,rate_bps,expiry_days,authorization,actor,receipt_reference,tenant_revision,idempotency_key,request_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      payment,
      m.tenant_id,
      bookingId,
      booking.customer_id,
      amount,
      eligible,
      redeemed,
      earned,
      t.loyalty_bps,
      t.loyalty_expiry_days,
      authorization,
      m.id,
      receipt,
      t.revision,
      key,
      requestHash,
      now(),
    ),
    audit(db, m.tenant_id, m.id, 'payment_recorded', payment),
  ];
  if (earned > 0)
    q.push(await retentionMessage(c.env, t, booking, 'loyalty', 'loyalty:' + payment));
  try {
    await db.batch(q);
  } catch (error) {
    const duplicate = await replay();
    if (duplicate) return c.json({ id: duplicate.id });
    if (
      /invalid_payment|payment_exceeds_invoice|insufficient_credit|constraint/i.test(String(error))
    )
      fail(409, 'payment_conflict');
    throw error;
  }
  return c.json({ id: payment }, 201);
});
merchant.post('/payments/:id/refunds', async (c) => {
  const m = owner(c),
    db = c.env.DB,
    b = await c.req.json<Row>(),
    paymentId = c.req.param('id'),
    key = idem(c.req.header('Idempotency-Key')),
    cash = integer(b.cash_centimes, 0, 10000000),
    credit = integer(b.credit_centimes ?? 0, 0, 10000000),
    reason = str(b.reason, 200),
    requestHash = await hash(JSON.stringify({ paymentId, cash, credit, reason }));
  const replay = async () => {
    const old = await stmt(
      db,
      'SELECT id,request_hash FROM refund_records WHERE tenant_id=? AND idempotency_key=?',
      m.tenant_id,
      key,
    ).first<Row>();
    if (old && old.request_hash !== requestHash) fail(409, 'idempotency_mismatch');
    return old;
  };
  const previous = await replay();
  if (previous) return c.json({ id: previous.id });
  if (
    !(await stmt(
      db,
      'SELECT id FROM payment_records WHERE tenant_id=? AND id=?',
      m.tenant_id,
      paymentId,
    ).first())
  )
    fail(404, 'not_found');
  const refund = id();
  try {
    await db.batch([
      stmt(
        db,
        'INSERT INTO refund_records VALUES (?,?,?,?,?,?,?,?,?,?)',
        refund,
        m.tenant_id,
        paymentId,
        cash,
        credit,
        reason,
        m.id,
        key,
        requestHash,
        now(),
      ),
      audit(db, m.tenant_id, m.id, 'refund_recorded', refund),
    ]);
  } catch (error) {
    const duplicate = await replay();
    if (duplicate) return c.json({ id: duplicate.id });
    if (/refund_exceeds_payment|constraint/i.test(String(error))) fail(409, 'refund_conflict');
    throw error;
  }
  return c.json({ id: refund }, 201);
});
