import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { runtime } from '../scripts/runtime.mjs';
import { demoFixtures } from '../scripts/demo-fixtures.mjs';
import { moduleUnderTest } from './modules.mjs';
import { client, login } from './helpers.mjs';

test('M6 retention rechecks activity and current policy inside the erasure transaction', async () => {
  const { mf, db, secret } = await runtime();
  try {
    await demoFixtures(db);
    const { eraseCustomer, retentionSweep } = await moduleUnderTest('privacy'),
      env = { DB: db, APP_SECRET: secret };
    await db.prepare("UPDATE tenants SET retention_days=1 WHERE id='t_atlas'").run();
    await db.prepare("UPDATE customers SET created_at=0 WHERE id='demo_customer_atlas'").run();
    // Simulate a booking committed after the sweep selected its candidate, before erasure.
    await db
      .prepare(
        "UPDATE bookings SET starts_at=?,ends_at=?,occupied_until=? WHERE id='demo_past_atlas'",
      )
      .bind(Date.now() + 86400000, Date.now() + 87600000, Date.now() + 87600000)
      .run();
    assert.equal(
      await eraseCustomer(env, 't_atlas', 'demo_customer_atlas', 'retention_job', true),
      false,
    );
    assert.equal(
      (await db.prepare("SELECT name FROM customers WHERE id='demo_customer_atlas'").first()).name,
      'Visite Démo atlas',
    );
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM booking_claims').first()).n, 8);
    await db
      .prepare(
        "UPDATE bookings SET starts_at=0,ends_at=1200000,occupied_until=1200000 WHERE id='demo_past_atlas'",
      )
      .run();
    await db.prepare("UPDATE tenants SET retention_days=0 WHERE id='t_atlas'").run();
    assert.equal(
      await eraseCustomer(env, 't_atlas', 'demo_customer_atlas', 'retention_job', true),
      false,
    );
    await db.prepare("UPDATE tenants SET retention_days=1 WHERE id='t_atlas'").run();
    const { retentionMessage } = await moduleUnderTest('retention');
    const tenant = await db.prepare("SELECT * FROM tenants WHERE id='t_atlas'").first(),
      booking = await db.prepare("SELECT * FROM bookings WHERE id='demo_past_atlas'").first();
    const preparedBeforeErasure = await retentionMessage(
      env,
      tenant,
      booking,
      'loyalty',
      'privacy-race',
    );
    assert.equal(await retentionSweep(env, 't_atlas'), 1);
    await preparedBeforeErasure.run();
    await (await retentionMessage(env, tenant, booking, 'loyalty', 'after-erasure')).run();
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM notification_outbox').first()).n, 0);
    assert.equal(
      (
        await db
          .prepare("SELECT unsubscribe_hash FROM customers WHERE id='demo_customer_atlas'")
          .first()
      ).unsubscribe_hash,
      null,
    );
    assert.equal(await retentionSweep(env, 't_atlas'), 0);
    assert.equal(
      (await db.prepare("SELECT name FROM customers WHERE id='demo_customer_atlas'").first()).name,
      'Client anonymisé',
    );
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM retention_guards').first()).n, 0);
  } finally {
    await mf.dispose();
  }
});

test('M6 bulk key rotation decrypts every stored payload after old keys retire; unsubscribe survives rotation and is tenant scoped', async () => {
  const { mf, db, secret } = await runtime();
  try {
    await demoFixtures(db);
    const owner = await login(mf, db),
      api = client(mf);
    assert.equal(
      (
        await owner.api(
          '/merchant/settings',
          { marketing_enabled: true, review_url: 'https://g.page/r/synthetic/review' },
          'PATCH',
        )
      ).status,
      200,
    );
    const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      slot = (await api('/public/atelier-atlas/availability?service_id=s_atlas&date=' + date)).data
        .slots[0];
    assert.equal(
      (
        await api(
          '/public/atelier-atlas/bookings',
          { offer: slot.offer, name: 'Key rotation fixture', phone: '+212600000090' },
          'POST',
          { 'Idempotency-Key': randomUUID().replaceAll('-', '') },
        )
      ).status,
      201,
    );
    assert.equal(
      (await owner.api('/merchant/bookings/demo_past_atlas/attendance', { status: 'completed' }))
        .status,
      200,
    );
    const { seal, unsealApp, unsealProvider, hash } = await moduleUnderTest('core');
    const oldKek = randomUUID(),
      newKek = randomUUID(),
      nextSecret = randomUUID() + randomUUID();
    await db
      .prepare(
        "INSERT INTO tenant_provider_connections(tenant_id,channel,enabled,config_cipher) VALUES ('t_atlas','email',1,?)",
      )
      .bind(await seal(oldKek, { api_key: 'synthetic-rotation-key' }))
      .run();
    const customer = await db
      .prepare("SELECT * FROM customers WHERE id='demo_customer_atlas'")
      .first();
    const raw = (await unsealApp({ APP_SECRET: secret }, customer.unsubscribe_cipher)).token;
    assert.equal(await hash(raw), customer.unsubscribe_hash);
    assert.equal(
      (await api('/unsubscribe', { customer_id: 'demo_customer_rivage', signature: raw })).status,
      404,
    );
    assert.equal(
      (await api('/unsubscribe', { customer_id: customer.id, signature: raw + 'wrong' })).status,
      404,
    );
    const { reencryptStoredKeys } = await moduleUnderTest('key-rotation');
    const rotated = {
      DB: db,
      APP_SECRET: nextSecret,
      APP_SECRET_PREVIOUS: secret,
      PROVIDER_KEK: newKek,
      PROVIDER_KEK_PREVIOUS: oldKek,
    };
    assert.ok((await reencryptStoredKeys(rotated)).reencrypted_records > 0);
    for (const [table, column] of [
      ['notification_outbox', 'payload_cipher'],
      ['mock_deliveries', 'payload_cipher'],
      ['bookings', 'response_cipher'],
      ['customers', 'unsubscribe_cipher'],
    ]) {
      for (const row of (await db.prepare(`SELECT ${column} value FROM ${table}`).all()).results) {
        if (row.value) await unsealApp({ APP_SECRET: nextSecret }, row.value);
      }
    }
    assert.deepEqual(
      await unsealProvider(
        { PROVIDER_KEK: newKek },
        (await db.prepare('SELECT config_cipher FROM tenant_provider_connections').first())
          .config_cipher,
      ),
      { api_key: 'synthetic-rotation-key' },
    );
    assert.equal(
      (await api('/unsubscribe', { customer_id: customer.id, signature: raw })).status,
      200,
    );
    assert.equal(
      (await api('/unsubscribe', { customer_id: customer.id, signature: raw })).status,
      200,
    );
    assert.equal(
      (await db.prepare("SELECT suppressed FROM customers WHERE id='demo_customer_atlas'").first())
        .suppressed,
      1,
    );
    assert.equal(
      (await db.prepare("SELECT suppressed FROM customers WHERE id='demo_customer_rivage'").first())
        .suppressed,
      0,
    );
    const { processOutbox } = await moduleUnderTest('delivery');
    let sends = 0;
    await processOutbox({ ...rotated, ENVIRONMENT: 'test' }, null, async () => {
      sends++;
      return { outcome: 'accepted' };
    });
    assert.equal(sends, 0);
    assert.equal(
      (await db.prepare("SELECT state FROM notification_outbox WHERE kind='review'").first()).state,
      'suppressed',
    );
    await reencryptStoredKeys({
      ...rotated,
      APP_SECRET_PREVIOUS: undefined,
      PROVIDER_KEK_PREVIOUS: undefined,
    });
  } finally {
    await mf.dispose();
  }
});

test('M6 customer and calendar pagination and streamed CSV do not silently truncate tenant data', async () => {
  const { mf, db } = await runtime();
  try {
    await demoFixtures(db);
    const a = await login(mf, db),
      b = await login(mf, db, 'rivage@example.invalid');
    const original = await db.prepare("SELECT * FROM bookings WHERE id='demo_past_atlas'").first();
    // Trusted fixtures exercise the API's page boundaries without invoking public abuse limits.
    for (let start = 0; start < 505; start += 50) {
      const statements = [];
      for (let i = start; i < Math.min(start + 50, 505); i++) {
        const cid = 'page-c-' + String(i).padStart(4, '0'),
          bid = 'page-b-' + String(i).padStart(4, '0');
        statements.push(
          db
            .prepare(
              "INSERT INTO customers(id,tenant_id,name,phone,created_at) VALUES (?,'t_atlas',?,?,?)",
            )
            .bind(cid, 'Pagination ' + i, '+212610' + String(i).padStart(6, '0'), Date.now()),
        );
        const clone = {
          ...original,
          id: bid,
          customer_id: cid,
          status: 'cancelled',
          idempotency_key: bid,
        };
        const columns = Object.keys(clone);
        statements.push(
          db
            .prepare(
              `INSERT INTO bookings(${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
            )
            .bind(...Object.values(clone)),
        );
      }
      await db.batch(statements);
    }
    const ids = [];
    let offset = 0;
    do {
      const page = await a.api('/merchant/customers?offset=' + offset);
      assert.equal(page.status, 200);
      ids.push(...page.data.customers.map((c) => c.id));
      offset = page.data.next_offset;
    } while (offset !== null);
    assert.equal(new Set(ids).size, 506);
    assert.equal(ids.length, 506);
    const first = (await a.api('/merchant/bookings')).data,
      second = (await a.api('/merchant/bookings?offset=' + first.next_offset)).data;
    assert.equal(first.bookings.length, 500);
    assert.equal(second.bookings.length, 6);
    assert.equal(second.next_offset, null);
    assert.equal(new Set([...first.bookings, ...second.bookings].map((b) => b.id)).size, 506);
    const csv = await (
      await mf.dispatchFetch('http://localhost/merchant/export.csv', {
        headers: { Cookie: a.cookie },
      })
    ).text();
    assert.equal(csv.trim().split('\r\n').length, 507);
    assert.doesNotMatch(csv, /rivage/);
    assert.equal((await b.api('/merchant/customers')).data.customers.length, 1);
    assert.equal((await a.api('/merchant/bookings?offset=-1')).status, 400);
  } finally {
    await mf.dispose();
  }
});
