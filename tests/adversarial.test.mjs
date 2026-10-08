import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { runtime } from '../scripts/runtime.mjs';
import { client, login } from './helpers.mjs';
import { moduleUnderTest } from './modules.mjs';
const key = () => randomUUID().replaceAll('-', '');
const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
test('M6 same-customer concurrent bookings select the persisted identity and preserve consent address', async () => {
  const { mf, db, secret } = await runtime();
  try {
    const api = client(mf),
      owner = await login(mf, db),
      slots = (await api('/public/atelier-atlas/availability?service_id=s_atlas&date=' + date)).data
        .slots;
    const results = await Promise.all(
      [0, 8].map((n, i) =>
        api(
          '/public/atelier-atlas/bookings',
          {
            offer: slots[n].offer,
            name: 'Client Concurrence',
            phone: '+212600000033',
            email: i ? 'second@example.invalid' : 'first@example.invalid',
            consent_email: true,
          },
          'POST',
          { 'Idempotency-Key': key() },
        ),
      ),
    );
    assert.ok(
      results.every((r) => r.status === 201),
      JSON.stringify(results),
    );
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM customers').first()).n, 1);
    const booked = (await db.prepare('SELECT customer_id,contact_email FROM bookings').all())
      .results;
    assert.equal(new Set(booked.map((b) => b.customer_id)).size, 1);
    assert.equal(new Set(booked.map((b) => b.contact_email)).size, 2);
    const b = results[1].data;
    await owner.api('/merchant/bookings/' + b.id + '/reschedule', { offer: slots[16].offer });
    await api('/dev/process', {});
    const { unseal } = await moduleUnderTest('core');
    const job = await db
      .prepare(
        "SELECT payload_cipher FROM notification_outbox WHERE booking_id=? AND kind='reschedule'",
      )
      .bind(b.id)
      .first();
    const decoded = await unseal(secret, job.payload_cipher);
    assert.equal(decoded.recipient, 'second@example.invalid');
    // Assert against booking snapshot without reading or exposing any real credential.
    assert.equal(
      (await db.prepare('SELECT contact_email FROM bookings WHERE id=?').bind(b.id).first())
        .contact_email,
      'second@example.invalid',
    );
    assert.ok(job.payload_cipher.startsWith('v1.'));
  } finally {
    await mf.dispose();
  }
});
test('M6 timezone folds/gaps and buffers use merchant-local calendar with explicit UTC', async () => {
  const { localParts, fits } = await moduleUnderTest('availability');
  const t = { timezone: 'Africa/Casablanca', cutoff_min: 0, horizon_days: 180 },
    service = { duration_min: 20, buffer_min: 0 },
    hours = [{ resource_id: 'r', weekday: 0, start_min: 120, end_min: 180 }];
  const first = Date.parse('2026-02-15T01:30:00Z'),
    second = Date.parse('2026-02-15T02:30:00Z');
  assert.equal(localParts(first, t.timezone).minute, 150);
  assert.equal(localParts(second, t.timezone).minute, 150);
  assert.ok(fits(t, service, hours, 'r', first, first - 86400000));
  assert.ok(fits(t, service, hours, 'r', second, first - 86400000));
  const gap = Date.parse('2026-03-22T02:00:00Z');
  assert.equal(localParts(gap, t.timezone).minute, 180);
  assert.equal(
    fits(
      t,
      { duration_min: 20, buffer_min: 10 },
      [{ resource_id: 'r', weekday: 0, start_min: 90, end_min: 180 }],
      'r',
      gap - 10 * 60000,
      gap - 86400000,
    ),
    false,
  );
  const { mf, db } = await runtime();
  try {
    const a = await login(mf, db);
    assert.equal((await a.api('/merchant/local-time', { value: '2026-02-15T02:30' })).status, 400);
    assert.equal((await a.api('/merchant/local-time', { value: '2026-03-22T02:30' })).status, 400);
    assert.equal((await a.api('/merchant/local-time', { value: '2026-03-22T03:30' })).status, 200);
  } finally {
    await mf.dispose();
  }
});
test('M6 privacy erasure is tenant scoped, releases future slots, revokes links and keeps audit', async () => {
  const { mf, db } = await runtime();
  try {
    const api = client(mf),
      a = await login(mf, db),
      b = await login(mf, db, 'rivage@example.invalid'),
      slot = (await api('/public/atelier-atlas/availability?service_id=s_atlas&date=' + date)).data
        .slots[0];
    const booking = (
      await api(
        '/public/atelier-atlas/bookings',
        {
          offer: slot.offer,
          name: 'Private Demo',
          phone: '+212600000044',
          email: 'private@example.invalid',
          consent_email: true,
        },
        'POST',
        { 'Idempotency-Key': key() },
      )
    ).data;
    const customer = (await a.api('/merchant/customers')).data.customers[0];
    assert.equal((await b.api('/merchant/customers/' + customer.id + '/erase', {})).status, 404);
    assert.equal((await b.api('/merchant/customers/' + customer.id + '/export')).status, 404);
    assert.equal((await a.api('/merchant/customers/' + customer.id + '/export')).status, 200);
    assert.equal((await a.api('/merchant/customers/' + customer.id + '/erase', {})).status, 200);
    const erased = (await a.api('/merchant/customers')).data.customers[0];
    assert.equal(erased.name, 'Client anonymisé');
    assert.equal(erased.email, null);
    assert.ok(erased.phone.startsWith('deleted:'));
    assert.equal(
      (
        await client(mf, { Authorization: 'Bearer ' + booking.manage_token })(
          '/manage-api/' + booking.id,
        )
      ).status,
      404,
    );
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM booking_claims').first()).n, 0);
    assert.ok(
      (
        await db
          .prepare("SELECT COUNT(*) n FROM audit_log WHERE action='customer_anonymized'")
          .first()
      ).n,
    );
    await api('/dev/process', {});
    assert.equal(
      (
        await db
          .prepare(
            "SELECT state FROM notification_outbox WHERE booking_id=? AND kind='confirmation'",
          )
          .bind(booking.id)
          .first()
      ).state,
      'suppressed',
    );
  } finally {
    await mf.dispose();
  }
});
test('M6 auth cookie security, atomic magic consumption, payload limits, no public PII and abuse control', async () => {
  const { mf, db } = await runtime();
  try {
    const api = client(mf);
    await api('/auth/request', { email: 'atlas@example.invalid' });
    await api('/dev/process', {});
    const mail = await db.prepare('SELECT token FROM mock_mail LIMIT 1').first();
    const result = await Promise.all([
      api('/auth/consume', { token: mail.token }),
      api('/auth/consume', { token: mail.token }),
    ]);
    assert.deepEqual(result.map((r) => r.status).sort(), [200, 401]);
    const cookie = result.find((r) => r.status === 200).headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Strict/);
    assert.equal((await api('/auth/request', { email: 'x'.repeat(17000) })).status, 413);
    for (const path of [
      '/api/state',
      '/api/reset',
      '/manage/atelier-atlas/bookings',
      '/admin',
      '/merchant/export.csv',
    ])
      assert.ok([401, 404].includes((await api(path)).status));
    const health = await api('/health');
    assert.equal(health.headers.get('access-control-allow-origin'), null);
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
    await api('/auth/request', { email: 'atlas@example.invalid' }, 'POST', {
      'CF-Connecting-IP': '1.2.3.4',
    });
    await api('/auth/request', { email: 'atlas@example.invalid' }, 'POST', {
      'CF-Connecting-IP': '2.3.4.5',
    });
    assert.equal(
      (
        await api('/auth/request', { email: 'atlas@example.invalid' }, 'POST', {
          'CF-Connecting-IP': '3.4.5.6',
        })
      ).status,
      429,
    );
  } finally {
    await mf.dispose();
  }
});
test('M6 Resend raw-body signatures, receipt-before-acceptance reconciliation and monotonic state', async () => {
  const secret = Buffer.from('synthetic-webhook-key-32-characters').toString('base64'),
    { mf, db } = await runtime({ bindings: { RESEND_WEBHOOK_SECRET: 'whsec_' + secret } });
  try {
    const api = client(mf);
    await api('/auth/request', { email: 'atlas@example.invalid' });
    await api('/dev/process', {});
    const job = await db
      .prepare("SELECT * FROM notification_outbox WHERE kind='magic_link'")
      .first();
    async function receipt(type, eventId = 'evt-' + type) {
      const body = { type, data: { email_id: job.provider_id } },
        timestamp = String(Math.floor(Date.now() / 1000)),
        signature = createHmac('sha256', Buffer.from(secret, 'base64'))
          .update(eventId + '.' + timestamp + '.' + JSON.stringify(body))
          .digest('base64');
      return api('/webhooks/resend', body, 'POST', {
        'svix-id': eventId,
        'svix-timestamp': timestamp,
        'svix-signature': 'v1,' + signature,
      });
    }
    await db
      .prepare("UPDATE notification_outbox SET provider_id=NULL,state='leased' WHERE id=?")
      .bind(job.id)
      .run();
    assert.equal((await receipt('email.delivered')).status, 200);
    assert.equal(
      (await db.prepare('SELECT reconciled FROM webhook_events LIMIT 1').first()).reconciled,
      0,
    );
    await db
      .prepare('UPDATE notification_outbox SET provider_id=? WHERE id=?')
      .bind(job.provider_id, job.id)
      .run();
    await api('/dev/process', {});
    await receipt('email.sent');
    await receipt('email.bounced');
    assert.equal(
      (await db.prepare('SELECT state FROM notification_outbox WHERE id=?').bind(job.id).first())
        .state,
      'delivered',
    );
    await receipt('email.delivered');
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM webhook_events').first()).n, 3);
  } finally {
    await mf.dispose();
  }
});
