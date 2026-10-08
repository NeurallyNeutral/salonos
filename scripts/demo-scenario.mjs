import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { runtime } from './runtime.mjs';
import { demoFixtures } from './demo-fixtures.mjs';
const { mf, db } = await runtime();
const key = () => randomUUID().replaceAll('-', '');
const request =
  (headers = {}) =>
  async (path, body, method = body === undefined ? 'GET' : 'POST', extra = {}) => {
    const r = await mf.dispatchFetch('http://localhost' + path, {
      method,
      headers: {
        Origin: 'http://localhost',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await r.json();
    assert.ok(r.ok, JSON.stringify({ path, status: r.status, data }));
    return { data, headers: r.headers };
  };
try {
  await demoFixtures(db);
  const api = request();
  async function login(email) {
    await api('/auth/request', { email });
    await api('/dev/process', {});
    const mail = await db
      .prepare('SELECT token FROM mock_mail WHERE recipient=? ORDER BY created_at DESC LIMIT 1')
      .bind(email)
      .first();
    const logged = await api('/auth/consume', { token: mail.token });
    const cookie = logged.headers.get('set-cookie').split(';')[0],
      session = await request({ Cookie: cookie })('/merchant/session');
    return request({ Cookie: cookie, 'X-CSRF-Token': session.data.csrf });
  }
  const atlas = await login('atlas@example.invalid'),
    rivage = await login('rivage@example.invalid');
  await atlas(
    '/merchant/settings',
    { loyalty_bps: 200, marketing_enabled: true, review_url: 'https://g.page/r/demo/review' },
    'PATCH',
  );
  const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    slots = (await api('/public/atelier-atlas/availability?service_id=s_atlas&date=' + date)).data
      .slots;
  const booked = (
    await api(
      '/public/atelier-atlas/bookings',
      {
        offer: slots[0].offer,
        name: 'Scénario fictif',
        phone: '+212600000099',
        email: 'scenario@example.invalid',
        consent_email: true,
        consent_whatsapp: true,
        consent_marketing: true,
      },
      'POST',
      { 'Idempotency-Key': key() },
    )
  ).data;
  assert.ok(!(await rivage('/merchant/bookings')).data.bookings.some((b) => b.id === booked.id));
  await db.prepare("INSERT INTO mock_behavior VALUES ('whatsapp','retryable')").run();
  await api('/dev/process', {});
  assert.equal(
    (
      await db
        .prepare("SELECT state FROM notification_outbox WHERE booking_id=? AND kind='confirmation'")
        .bind(booked.id)
        .first()
    ).state,
    'failed_retryable',
  );
  await db.prepare("UPDATE mock_behavior SET outcome='ok'").run();
  await db
    .prepare('UPDATE notification_outbox SET due_at=0 WHERE booking_id=?')
    .bind(booked.id)
    .run();
  await api('/dev/process', {});
  const reminders = await db
    .prepare(
      "SELECT COUNT(*) n FROM mock_deliveries d JOIN notification_outbox o ON o.id=d.outbox_id WHERE o.booking_id=? AND o.kind LIKE 'reminder_%'",
    )
    .bind(booked.id)
    .first();
  assert.equal(reminders.n, 2);
  await atlas('/merchant/bookings/demo_past_atlas/attendance', { status: 'completed' });
  const payment = (
    await atlas(
      '/merchant/bookings/demo_past_atlas/payments',
      { actual_payment_received: true, amount_centimes: 12000 },
      'POST',
      { 'Idempotency-Key': key() },
    )
  ).data;
  assert.equal(
    (await atlas('/merchant/customers/demo_customer_atlas/loyalty')).data.balance_centimes,
    240,
  );
  await atlas(
    '/merchant/payments/' + payment.id + '/refunds',
    { cash_centimes: 6000, credit_centimes: 0, reason: 'Remboursement partiel fictif' },
    'POST',
    { 'Idempotency-Key': key() },
  );
  assert.equal(
    (await atlas('/merchant/customers/demo_customer_atlas/loyalty')).data.balance_centimes,
    120,
  );
  await api('/dev/process', {});
  const review = (await api('/dev/messages')).data.messages.find((m) => m.kind === 'review');
  assert.match(review.text, /expérience honnête/);
  const report = {
    result: 'PASS',
    mode: 'LOCAL MOCK ONLY',
    tenants: 2,
    public_booking: true,
    cross_tenant_isolation: true,
    transient_outage_recovered: true,
    reminders_accepted: reminders.n,
    merchant_reported_payment_centimes: 12000,
    credit_issued_centimes: 240,
    partial_refund_centimes: 6000,
    credit_remaining_centimes: 120,
    neutral_review: true,
    live_delivery: 'NOT_VERIFIED',
  };
  console.log(JSON.stringify(report, null, 2));
} finally {
  await mf.dispose();
}
