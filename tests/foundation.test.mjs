import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from '../scripts/runtime.mjs';
test('real local Worker and D1: health, migrations, isolated tenants', async () => {
  const { mf, db } = await runtime();
  try {
    assert.equal((await mf.dispatchFetch('http://localhost/health')).status, 200);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM tenants').first()).n, 2);
    assert.equal((await mf.dispatchFetch('http://localhost/api/state')).status, 404);
    assert.equal((await mf.dispatchFetch('http://localhost/api/reset')).status, 404);
  } finally { await mf.dispose(); }
});
