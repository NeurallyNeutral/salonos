import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { runtime } from '../scripts/runtime.mjs';
import { client, login } from './helpers.mjs';
test('M6 restart preserves bookings and edited schedules; app-key rotation retains idempotency and customer identity', async () => {
  await mkdir('.wrangler', { recursive: true });
  const persist = await mkdtemp(path.resolve('.wrangler/restart-')),
    oldSecret = randomUUID() + randomUUID();
  let run = await runtime({ persist, secret: oldSecret });
  let active = run.mf;
  try {
    const api = client(run.mf),
      a = await login(run.mf, run.db),
      date = new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      slots = (await api('/public/atelier-atlas/availability?service_id=s_atlas&date=' + date)).data
        .slots;
    const body = { offer: slots[0].offer, name: 'Persistence Fixture', phone: '+212600000055' },
      key = randomUUID().replaceAll('-', '');
    const original = await api('/public/atelier-atlas/bookings', body, 'POST', {
      'Idempotency-Key': key,
    });
    assert.equal(original.status, 201);
    const customer = (await a.api('/merchant/customers')).data.customers[0];
    await a.api('/merchant/hours', { hours: [] }, 'PUT');
    await a.api('/merchant/settings', { paused: true }, 'PATCH');
    await run.mf.dispose();
    active = null;
    run = await runtime({
      persist,
      secret: randomUUID() + randomUUID(),
      bindings: { APP_SECRET_PREVIOUS: oldSecret },
    });
    active = run.mf;
    const nextApi = client(run.mf);
    const replay = await nextApi('/public/atelier-atlas/bookings', body, 'POST', {
      'Idempotency-Key': key,
    });
    assert.equal(replay.status, 200);
    assert.deepEqual(replay.data, original.data);
    assert.equal(
      (await run.db.prepare("SELECT paused FROM tenants WHERE id='t_atlas'").first()).paused,
      1,
    );
    assert.equal(
      (
        await run.db
          .prepare("SELECT COUNT(*) n FROM weekly_hours WHERE tenant_id='t_atlas'")
          .first()
      ).n,
      0,
    );
    assert.equal((await run.db.prepare('SELECT COUNT(*) n FROM booking_claims').first()).n, 4);
    assert.equal(
      (
        await run.db
          .prepare('SELECT customer_id FROM bookings WHERE id=?')
          .bind(original.data.id)
          .first()
      ).customer_id,
      customer.id,
    );
    const manage = client(run.mf, { Authorization: 'Bearer ' + original.data.manage_token });
    assert.equal((await manage('/manage-api/' + original.data.id)).status, 200);
  } finally {
    if (active) await active.dispose();
  }
});
