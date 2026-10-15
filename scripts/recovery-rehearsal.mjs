import assert from 'node:assert/strict';
import { mkdir, cp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { runtime } from './runtime.mjs';
import { demoFixtures } from './demo-fixtures.mjs';
import { login, client } from '../tests/helpers.mjs';
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
    'catalog_items',
    'catalog_item_assets',
    'inquiries',
    'commerce_payments',
    'commerce_refunds',
    'launch_events',
    'signup_challenges',
    'signup_deliveries',
    'provision_claims',
    'merchant_assets',
    'prospect_previews',
    'setup_operations',
    'connector_checks',
    'account_deletions',
    'plan_definitions',
    'plan_quotas',
    'support_interventions',
    'tenant_provider_connections',
    'loyalty_allocations',
  ])
    result[table] = (await db.prepare('SELECT * FROM ' + table).all()).results
      .map((row) => JSON.stringify(row))
      .sort();
  return result;
}
const retail = await login(run.mf, run.db, 'boutique@example.invalid');
await retail.api('/merchant/retention-settings', {
  loyalty_bps: 200,
  understands_merchant_funded_terms: true,
});
const inquiry = await client(run.mf)(
  '/storefront/maison-sable/inquiries',
  {
    item_id: 'item_sac',
    name: 'Client recovery fictif',
    phone: '+212600000069',
    consent_contact: true,
  },
  'POST',
  { 'Idempotency-Key': randomUUID().replaceAll('-', '') },
);
assert.equal(inquiry.status, 201);
assert.equal(
  (await retail.api('/merchant/inquiries/' + inquiry.data.id, { status: 'fulfilled' }, 'PATCH'))
    .status,
  200,
);
const retailPayment = await retail.api(
  '/merchant/inquiries/' + inquiry.data.id + '/payments',
  { actual_payment_received: true, amount_centimes: 12000 },
  'POST',
  { 'Idempotency-Key': randomUUID().replaceAll('-', '') },
);
assert.equal(retailPayment.status, 201);
assert.equal(
  (
    await retail.api(
      '/merchant/commerce-payments/' + retailPayment.data.id + '/refunds',
      { cash_centimes: 6000, credit_centimes: 0, reason: 'Recovery synthétique' },
      'POST',
      { 'Idempotency-Key': randomUUID().replaceAll('-', '') },
    )
  ).status,
  201,
);
const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  ),
  ticket = await owner.api('/merchant/assets/ticket', {
    mime: 'image/png',
    size: image.length,
    sha256: createHash('sha256').update(image).digest('hex'),
    owns_rights: true,
  });
assert.equal(ticket.status, 200);
const uploaded = await owner.api('/merchant/assets/upload', {
  ticket: ticket.data.ticket,
  data: image.toString('base64'),
});
assert.equal(uploaded.status, 201);
await client(run.mf)('/signup-api/request', { email: 'recovery-onboarding@example.invalid' });
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
const restoredImage = await run.mf.dispatchFetch('http://localhost' + uploaded.data.url);
assert.equal(restoredImage.status, 200);
assert.deepEqual(Buffer.from(await restoredImage.arrayBuffer()), image);
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
    '29-table exact snapshot equality; appointments and catalog payments/refunds, loyalty and owned R2 image bytes verified',
  tables: Object.keys(expected).length,
  owned_image_restored: true,
  backup_ms: backupMs,
  restore_and_verify_ms: Math.round(performance.now() - restoreStart),
  snapshot_directory: snapshot,
  live_time_travel: 'NOT_TESTED',
};
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/recovery.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
