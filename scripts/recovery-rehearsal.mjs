import assert from 'node:assert/strict';
import { mkdir, cp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { runtime } from './runtime.mjs';
import { demoFixtures } from './demo-fixtures.mjs';
import { login } from '../tests/helpers.mjs';
const root = path.resolve('.wrangler/recovery', randomUUID()),
  source = path.join(root, 'source'),
  snapshot = path.join(root, 'snapshot'),
  restored = path.join(root, 'restored');
await mkdir(root, { recursive: true });
const secret = randomUUID() + randomUUID();
let run = await runtime({ persist: source, secret });
await demoFixtures(run.db);
const owner = await login(run.mf, run.db);
assert.equal((await owner.api('/merchant/settings', { loyalty_bps: 200 }, 'PATCH')).status, 200);
assert.equal(
  (await owner.api('/merchant/bookings/demo_past_atlas/attendance', { status: 'completed' }))
    .status,
  200,
);
const payment = await owner.api(
  '/merchant/bookings/demo_past_atlas/payments',
  { actual_payment_received: true, amount_centimes: 12000 },
  'POST',
  { 'Idempotency-Key': randomUUID().replaceAll('-', '') },
);
assert.equal(payment.status, 201);
assert.equal(
  (
    await owner.api(
      '/merchant/payments/' + payment.data.id + '/refunds',
      { cash_centimes: 6000, credit_centimes: 0, reason: 'Synthetic recovery fixture' },
      'POST',
      { 'Idempotency-Key': randomUUID().replaceAll('-', '') },
    )
  ).status,
  201,
);
async function captureRows(db) {
  const result = {};
  for (const table of [
    'tenants',
    'customers',
    'bookings',
    'booking_claims',
    'payment_records',
    'refund_records',
    'loyalty_ledger',
    'notification_outbox',
    'sessions',
    'schema_migrations',
  ])
    result[table] = (await db.prepare('SELECT * FROM ' + table).all()).results
      .map((row) => JSON.stringify(row))
      .sort();
  return result;
}
await run.db.prepare("UPDATE tenants SET name='Snapshot fixture' WHERE id='t_atlas'").run();
const expected = await captureRows(run.db);
const initial = await run.db.prepare('SELECT COUNT(*) n FROM booking_claims').first();
await run.mf.dispose();
const backupStart = performance.now();
await cp(source, snapshot, { recursive: true });
const backupMs = Math.round(performance.now() - backupStart);
run = await runtime({ persist: source, secret, seed: false });
assert.equal(
  (await run.db.prepare("SELECT name FROM tenants WHERE id='t_atlas'").first()).name,
  'Snapshot fixture',
);
assert.equal((await run.db.prepare('SELECT COUNT(*) n FROM booking_claims').first()).n, initial.n);
await run.db
  .prepare("UPDATE tenants SET name='Intentional recovery fixture change' WHERE id='t_atlas'")
  .run();
await run.mf.dispose();
const restoreStart = performance.now();
await cp(snapshot, restored, { recursive: true });
run = await runtime({ persist: restored, secret, seed: false });
assert.equal(
  (await run.db.prepare("SELECT name FROM tenants WHERE id='t_atlas'").first()).name,
  'Snapshot fixture',
);
assert.equal((await run.db.prepare('SELECT COUNT(*) n FROM booking_claims').first()).n, initial.n);
assert.equal((await run.db.prepare('SELECT COUNT(*) n FROM bookings').first()).n, 2);
assert.deepEqual(await captureRows(run.db), expected);
assert.equal((await run.db.prepare('PRAGMA foreign_key_check').all()).results.length, 0);
const restoredOwner = await login(run.mf, run.db);
assert.equal(
  (await restoredOwner.api('/merchant/customers/demo_customer_atlas/loyalty')).data
    .balance_centimes,
  120,
);
await run.mf.dispose();
const report = {
  result: 'PASS',
  scope: 'synthetic local D1 only; closed-runtime snapshot and fresh-directory restore',
  bookings: 2,
  claims: initial.n,
  financial_and_outbox_tables:
    'exact snapshot equality; payment, refund and 120-centime balance verified',
  backup_ms: backupMs,
  restore_and_verify_ms: Math.round(performance.now() - restoreStart),
  snapshot_directory: snapshot,
  live_time_travel: 'NOT_TESTED',
};
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/recovery.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
