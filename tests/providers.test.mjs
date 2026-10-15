import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from '../scripts/runtime.mjs';
import { moduleUnderTest } from './modules.mjs';
import { client } from './helpers.mjs';
import { randomUUID } from 'node:crypto';

test('a delivered receipt arriving during an uncertain send cannot be downgraded or retried', async () => {
  const { mf, db, secret } = await runtime();
  try {
    const api = client(mf),
      date = new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      slots = (await api('/public/atelier-atlas/availability?service_id=s_atlas&date=' + date)).data
        .slots;
    const b = await api(
      '/public/atelier-atlas/bookings',
      {
        offer: slots[0].offer,
        name: 'Receipt race fixture',
        phone: '+212600000066',
        consent_whatsapp: true,
      },
      'POST',
      { 'Idempotency-Key': randomUUID().replaceAll('-', '') },
    );
    assert.equal(b.status, 201);
    const { processOutbox, reconcile } = await moduleUnderTest('delivery'),
      env = { DB: db, APP_SECRET: secret, ENVIRONMENT: 'test' };
    let sends = 0;
    await processOutbox(env, null, async (_env, job) => {
      sends++;
      await db
        .prepare('UPDATE notification_outbox SET provider_id=? WHERE id=?')
        .bind('receipt-race-provider-id', job.id)
        .run();
      await db
        .prepare(
          "INSERT INTO webhook_events VALUES ('receipt-race','meta','receipt-race-provider-id','delivered',?,0)",
        )
        .bind(Date.now())
        .run();
      await reconcile(env);
      return { outcome: 'uncertain', reason: 'network_timeout' };
    });
    const job = await db
      .prepare("SELECT * FROM notification_outbox WHERE booking_id=? AND kind='confirmation'")
      .bind(b.data.id)
      .first();
    assert.equal(job.state, 'delivered');
    assert.equal(job.provider_id, 'receipt-race-provider-id');
    assert.ok(job.delivered_at);
    assert.equal(
      (
        await db
          .prepare('SELECT COUNT(*) n FROM operations_alerts WHERE resolved_at IS NULL')
          .first()
      ).n,
      0,
    );
    await processOutbox(env, null, async () => {
      sends++;
      return { outcome: 'accepted' };
    });
    assert.equal(sends, 1);
  } finally {
    await mf.dispose();
  }
});
test('provider wire contracts use stable keys, approved templates, encryption and truthful outcomes (mock HTTP only)', async () => {
  const { mf, db, secret } = await runtime();
  try {
    const { sendProvider } = await moduleUnderTest('providers'),
      { seal, unsealProvider, unsealApp } = await moduleUnderTest('core'),
      job = { id: 'synthetic-job', kind: 'magic_link', channel: 'email', tenant_id: 't_atlas' },
      env = {
        DB: db,
        ENVIRONMENT: 'test',
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 'synthetic-key',
        EMAIL_FROM: 'demo@example.invalid',
        APP_SECRET: secret,
        PROVIDER_KEK: 'synthetic-kek',
      };
    let called = 0;
    const accepted = await sendProvider(
      env,
      job,
      { recipient: 'owner@example.invalid', login_url: 'https://example.invalid/login' },
      async (url, init) => {
        called++;
        assert.equal(url, 'https://api.resend.com/emails');
        assert.equal(init.headers['Idempotency-Key'], job.id);
        assert.equal(JSON.parse(init.body).to[0], 'owner@example.invalid');
        return Response.json({ id: 'email-fixture' });
      },
    );
    assert.equal(accepted.outcome, 'accepted');
    assert.equal(called, 1);
    assert.equal(
      (
        await sendProvider(env, job, { recipient: 'owner@example.invalid' }, async () => {
          throw Error('offline');
        })
      ).outcome,
      'retryable',
    );
    const config = {
        phone_number_id: '123456',
        api_version: 'v99.0',
        access_token: 'synthetic-token',
        templates: { confirmation: 'approved_fixture_template' },
        language: 'fr',
      },
      cipher = await seal(env.PROVIDER_KEK, config);
    assert.notEqual(cipher, await seal(env.PROVIDER_KEK, config));
    await db
      .prepare(
        "INSERT INTO tenant_provider_connections(tenant_id,channel,enabled,config_cipher) VALUES ('t_atlas','whatsapp',1,?)",
      )
      .bind(cipher)
      .run();
    env.WHATSAPP_PROVIDER = 'meta';
    job.kind = 'confirmation';
    job.channel = 'whatsapp';
    const result = await sendProvider(
      env,
      job,
      {
        recipient: '+212600000001',
        tenant_name: 'Demo',
        starts_at: Date.now(),
        timezone: 'Africa/Casablanca',
        manage_url: 'https://example.invalid/manage',
      },
      async (url, init) => {
        assert.equal(url, 'https://graph.facebook.com/v99.0/123456/messages');
        const body = JSON.parse(init.body);
        assert.equal(body.type, 'template');
        assert.equal(body.template.name, 'approved_fixture_template');
        assert.equal(body.biz_opaque_callback_data, job.id);
        return Response.json({ messages: [{ id: 'wa-fixture' }] });
      },
    );
    assert.equal(result.provider_id, 'wa-fixture');
    assert.equal(
      (
        await sendProvider(
          env,
          job,
          { recipient: '+212600000001', starts_at: Date.now(), timezone: 'Africa/Casablanca' },
          async () => {
            throw Error('timeout');
          },
        )
      ).outcome,
      'uncertain',
    );
    assert.deepEqual(
      await unsealProvider(
        { ...env, PROVIDER_KEK: 'new-key', PROVIDER_KEK_PREVIOUS: env.PROVIDER_KEK },
        cipher,
      ),
      config,
    );
    const appCipher = await seal(secret, { value: 'fixture' });
    assert.deepEqual(
      await unsealApp(
        { ...env, APP_SECRET: 'new-app-key', APP_SECRET_PREVIOUS: secret },
        appCipher,
      ),
      { value: 'fixture' },
    );
  } finally {
    await mf.dispose();
  }
});
test('subscription infrastructure is idempotent in local mocks and disabled for live collection', async () => {
  const { mf, db } = await runtime();
  try {
    const { MockBillingProvider, DisabledBillingProvider } = await moduleUnderTest('billing'),
      provider = new MockBillingProvider({ DB: db, ENVIRONMENT: 'test' }),
      event = { id: 'mock-invoice-1', tenant_id: 't_atlas', status: 'active' };
    await provider.apply(event);
    await provider.apply(event);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM subscription_events').first()).n, 1);
    assert.equal(
      (
        await db
          .prepare("SELECT status FROM tenant_subscription_status WHERE tenant_id='t_atlas'")
          .first()
      ).status,
      'active',
    );
    assert.equal(
      (
        await db
          .prepare("SELECT status FROM tenant_subscription_status WHERE tenant_id='t_rivage'")
          .first()
      ).status,
      'trial',
    );
    await assert.rejects(new DisabledBillingProvider().apply(event), /not_configured/);
    await assert.rejects(
      new MockBillingProvider({ DB: db, ENVIRONMENT: 'production' }).apply(event),
      /forbidden/,
    );
  } finally {
    await mf.dispose();
  }
});
