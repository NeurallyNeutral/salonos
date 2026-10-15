import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from '../scripts/runtime.mjs';
import { login, client } from './helpers.mjs';
test('V2-E connectors separate fixture testing from real delivery, scope revocation and leave Instagram deferred', async () => {
  const { mf, db } = await runtime({
    bindings: { PROVIDER_KEK: 'local-fixture-key-with-at-least-32-characters' },
  });
  try {
    const owner = await login(mf, db),
      other = await login(mf, db, 'rivage@example.invalid');
    const initial = (await owner.api('/merchant/connectors')).data;
    assert.ok(
      initial.connectors.every((c) => c.state === 'DISCONNECTED' && !c.live_provider_verified),
    );
    const testResult = await owner.api('/merchant/connectors/whatsapp/mock-check', {});
    assert.equal(testResult.data.state, 'TESTING');
    assert.equal(testResult.data.messages_sent, 0);
    await owner.api('/merchant/connectors/instagram/mock-check', {});
    const after = (await owner.api('/merchant/connectors')).data.connectors;
    assert.equal(after.find((c) => c.channel === 'whatsapp').state, 'TESTING');
    assert.equal(after.find((c) => c.channel === 'instagram').state, 'DISCONNECTED');
    assert.equal(
      (await other.api('/merchant/connectors')).data.connectors.find(
        (c) => c.channel === 'whatsapp',
      ).state,
      'DISCONNECTED',
    );
    await owner.api(
      '/merchant/providers/whatsapp',
      {
        enabled: true,
        access_token: 'synthetic-fixture',
        phone_number_id: '1234',
        api_version: 'v99.0',
        templates: { confirmation: 'confirmation' },
      },
      'PUT',
    );
    assert.equal(
      (await owner.api('/merchant/connectors')).data.connectors.find(
        (c) => c.channel === 'whatsapp',
      ).live_provider_verified,
      false,
    );
    assert.ok(
      (
        await db.prepare('SELECT config_cipher FROM tenant_provider_connections').first()
      ).config_cipher.startsWith('v1.'),
    );
    await owner.api('/merchant/connectors/whatsapp/disconnect', {});
    const row = await db
      .prepare('SELECT enabled,config_cipher FROM tenant_provider_connections')
      .first();
    assert.equal(row.enabled, 0);
    assert.equal(row.config_cipher, '');
    assert.equal(
      (await owner.api('/merchant/connectors')).data.connectors.find(
        (c) => c.channel === 'whatsapp',
      ).state,
      'DISCONNECTED',
    );
    assert.equal(
      (await db.prepare("SELECT COUNT(*) n FROM mock_deliveries WHERE channel='whatsapp'").first())
        .n,
      0,
    );
    assert.equal((await client(mf)('/merchant/connectors')).status, 401);
  } finally {
    await mf.dispose();
  }
  const production = await runtime({ environment: 'production' });
  try {
    const owner = await login(production.mf, production.db).catch(() => null);
    assert.equal(owner, null);
  } finally {
    await production.mf.dispose();
  }
});
