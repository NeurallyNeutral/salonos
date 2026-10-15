import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { runtime } from '../scripts/runtime.mjs';
import { demoFixtures } from '../scripts/demo-fixtures.mjs';
import { client, login } from './helpers.mjs';
test('V2-G catalog privacy export/retention erasure and self-service account deletion revoke public and private access', async () => {
  const { mf, db } = await runtime();
  await demoFixtures(db);
  try {
    const owner = await login(mf, db, 'boutique@example.invalid'),
      other = await login(mf, db),
      api = client(mf);
    const result = await api(
      '/storefront/maison-sable/inquiries',
      {
        item_id: 'item_sac',
        name: 'Vie privée fictive',
        phone: '+212600000067',
        note: 'Question privée synthétique',
        consent_contact: true,
      },
      'POST',
      { 'Idempotency-Key': randomUUID().replaceAll('-', '') },
    );
    assert.equal(result.status, 201);
    const customer = (await owner.api('/merchant/inquiries')).data.inquiries[0].customer_id;
    const exported = (await owner.api('/merchant/customers/' + customer + '/export')).data;
    assert.equal(exported.inquiries.length, 1);
    assert.match(JSON.stringify(exported), /Question privée/);
    assert.equal((await other.api('/merchant/customers/' + customer + '/export')).status, 404);
    await db.prepare('UPDATE customers SET created_at=1 WHERE id=?').bind(customer).run();
    await owner.api('/merchant/settings', { retention_days: 1 }, 'PATCH');
    assert.equal((await owner.api('/merchant/retention/run', {})).data.anonymized, 0);
    const shared = await owner.api('/merchant/launch/previews', {
        authorized_business_content: true,
      }),
      token = shared.data.url.split('#')[1];
    const account = (await owner.api('/merchant/account/export')).data;
    assert.ok(!JSON.stringify(account).includes('config_cipher'));
    assert.ok(!JSON.stringify(account).includes('manage_hash'));
    assert.equal((await client(mf)('/merchant/account/export')).status, 401);
    const deletion = await owner.api('/merchant/account/delete', { confirm_delete: true });
    assert.equal(deletion.status, 202);
    assert.equal(deletion.data.state, 'completed');
    assert.equal((await owner.api('/merchant/session')).status, 401);
    assert.equal((await api('/storefront/maison-sable')).status, 404);
    assert.equal((await api('/preview-api', { token })).status, 404);
    assert.equal((await other.api('/merchant/session')).status, 200);
    const c = await db.prepare('SELECT * FROM customers WHERE id=?').bind(customer).first();
    assert.equal(c.name, 'Client anonymisé');
    assert.match(c.phone, /^deleted:/);
    const inquiry = await db
      .prepare('SELECT note,status FROM inquiries WHERE id=?')
      .bind(result.data.id)
      .first();
    assert.equal(inquiry.note, '');
    assert.equal(inquiry.status, 'cancelled');
    assert.equal(
      (await db.prepare("SELECT email FROM merchant_users WHERE id='u_boutique'").first()).email,
      'deleted:u_boutique@example.invalid',
    );
  } finally {
    await mf.dispose();
  }
});
