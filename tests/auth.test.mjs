import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from '../scripts/runtime.mjs';
import { client, login } from './helpers.mjs';
test('M1 secure sign-in, one-time links, CSRF, roles and tenant configuration', async () => {
  const { mf, db } = await runtime();
  try {
    const api = client(mf),
      a = await login(mf, db),
      b = await login(mf, db, 'rivage@example.invalid'),
      staff = await login(mf, db, 'staff@example.invalid');
    assert.equal((await api('/merchant/config')).status, 401);
    assert.equal((await api('/auth/consume', { token: a.token })).status, 401);
    assert.equal((await api('/auth/consume', { token: '0'.repeat(64) })).status, 401);
    assert.equal((await api('/auth/consume', { token: a.token.slice(1) })).status, 401);
    assert.equal(
      (await client(mf, { Cookie: a.cookie })('/merchant/settings', { paused: 1 }, 'PATCH')).status,
      403,
    );
    assert.equal(
      (
        await a.api('/merchant/settings', { paused: 1 }, 'PATCH', {
          Origin: 'https://evil.invalid',
        })
      ).status,
      403,
    );
    assert.equal((await staff.api('/merchant/settings', { paused: 1 }, 'PATCH')).status, 403);
    assert.equal((await a.api('/merchant/settings', { paused: 1 }, 'PATCH')).status, 200);
    assert.equal((await b.api('/merchant/config')).data.tenant.paused, 0);
    assert.equal(
      (await a.api('/merchant/services/s_rivage', { name: 'stolen' }, 'PATCH')).status,
      404,
    );
    assert.equal(
      (
        await a.api(
          '/merchant/assignments',
          { assignments: [{ service_id: 's_atlas', resource_id: 'r_rivage' }] },
          'PUT',
        )
      ).status,
      400,
    );
    assert.equal((await a.api('/merchant/config')).data.assignments.length, 2);
    assert.equal(
      (await a.api('/merchant/settings', { tenant_id: 't_rivage' }, 'PATCH')).status,
      400,
    );
    await db.prepare('UPDATE sessions SET expires_at=0 WHERE user_id=?').bind('u_staff').run();
    assert.equal((await staff.api('/merchant/config')).status, 401);
    await api('/auth/request', { email: 'atlas@example.invalid' });
    await api('/dev/process', {});
    await db.prepare('UPDATE magic_links SET expires_at=0 WHERE used_at IS NULL').run();
    const expired = await db
      .prepare('SELECT token FROM mock_mail WHERE recipient=? ORDER BY created_at DESC LIMIT 1')
      .bind('atlas@example.invalid')
      .first();
    assert.equal((await api('/auth/consume', { token: expired.token })).status, 401);
    assert.equal((await a.api('/merchant/logout', {})).status, 200);
    assert.equal((await a.api('/merchant/config')).status, 401);
  } finally {
    await mf.dispose();
  }
});
