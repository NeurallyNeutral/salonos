import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { runtime } from '../scripts/runtime.mjs';
import { client, login } from './helpers.mjs';
import { moduleUnderTest } from './modules.mjs';
test('V2-G inquiry pagination/export covers every record and product images enforce tenant ownership', async () => {
  const { mf, db } = await runtime();
  try {
    await db
      .prepare("UPDATE tenants SET business_mode='catalog_inquiry' WHERE id='t_rivage'")
      .run();
    const owner = await login(mf, db, 'rivage@example.invalid'),
      other = await login(mf, db);
    const item = (
      await owner.api('/merchant/catalog', { name: 'Produit fictif', price_centimes: 12000 })
    ).data.id;
    await db
      .prepare(
        "INSERT INTO customers(id,tenant_id,name,phone,created_at) VALUES ('pages_customer','t_rivage','Client pages fictif','+212600000079',1)",
      )
      .run();
    await db
      .prepare(
        "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<105) INSERT INTO inquiries(id,tenant_id,item_id,customer_id,variant,quantity,price_centimes,note,source,consent_contact,created_at,idempotency_key,request_hash) SELECT 'page_'||x,'t_rivage',?,'pages_customer','',1,12000,'','direct',1,x,'page_key_'||x,'fixture' FROM n",
      )
      .bind(item)
      .run();
    const first = (await owner.api('/merchant/inquiries')).data,
      second = (await owner.api('/merchant/inquiries?offset=' + first.next_offset)).data;
    assert.equal(first.inquiries.length, 100);
    assert.equal(second.inquiries.length, 5);
    assert.equal(second.next_offset, null);
    assert.equal(new Set([...first.inquiries, ...second.inquiries].map((i) => i.id)).size, 105);
    assert.equal((await owner.api('/merchant/account/export')).data.inquiries.length, 105);
    assert.equal((await other.api('/merchant/inquiries')).data.inquiries.length, 0);
    assert.equal((await owner.api('/merchant/inquiries?offset=-1')).status, 400);
    const data = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
        'base64',
      ),
      sha256 = createHash('sha256').update(data).digest('hex');
    const { ticket } = (
      await other.api('/merchant/assets/ticket', {
        mime: 'image/png',
        size: data.length,
        sha256,
        owns_rights: true,
      })
    ).data;
    const asset = (
      await other.api('/merchant/assets/upload', { ticket, data: data.toString('base64') })
    ).data.id;
    assert.equal(
      (await owner.api('/merchant/catalog/' + item + '/image', { asset_id: asset }, 'PUT')).status,
      400,
    );
    const ticket2 = (
      await owner.api('/merchant/assets/ticket', {
        mime: 'image/png',
        size: data.length,
        sha256,
        owns_rights: true,
      })
    ).data.ticket;
    const owned = (
      await owner.api('/merchant/assets/upload', {
        ticket: ticket2,
        data: data.toString('base64'),
        use_as_logo: false,
      })
    ).data.id;
    assert.equal(
      (await owner.api('/merchant/catalog/' + item + '/image', { asset_id: owned }, 'PUT')).status,
      200,
    );
    assert.equal(
      (await client(mf)('/storefront/studio-rivage')).data.items[0].image_url,
      '/media/' + owned,
    );
  } finally {
    await mf.dispose();
  }
});
test('V2-G signup delivery adapter retries with stable keys and records acceptance without inventing delivery (mock HTTP)', async () => {
  const { mf, db, secret } = await runtime();
  try {
    const api = client(mf);
    await api('/signup-api/request', { email: 'wire-signup@example.invalid' });
    const { processSignup } = await moduleUnderTest('onboarding'),
      seen = [],
      env = {
        DB: db,
        APP_SECRET: secret,
        ENVIRONMENT: 'test',
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 'synthetic-not-a-secret',
        EMAIL_FROM: 'sender@example.invalid',
      };
    await processSignup(env, async (url, request) => {
      seen.push(request.headers['Idempotency-Key']);
      assert.equal(url, 'https://api.resend.com/emails');
      assert.match(JSON.parse(request.body).text, /signup#/);
      return new Response('{}', { status: 503 });
    });
    assert.equal(
      (await db.prepare('SELECT state FROM signup_deliveries').first()).state,
      'failed_retryable',
    );
    await db.prepare('UPDATE signup_deliveries SET due_at=0').run();
    await processSignup(env, async (_url, request) => {
      seen.push(request.headers['Idempotency-Key']);
      return new Response('{"id":"fixture_accepted"}', { status: 200 });
    });
    const row = await db.prepare('SELECT * FROM signup_deliveries').first();
    assert.equal(row.state, 'provider_accepted');
    assert.equal(row.reason, 'acceptance_not_delivery');
    assert.equal(seen[0], seen[1]);
    const before = seen.length;
    await processSignup(env, async () => {
      throw Error('duplicate send');
    });
    assert.equal(seen.length, before);
  } finally {
    await mf.dispose();
  }
});
