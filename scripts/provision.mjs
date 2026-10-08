import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { runtime } from './runtime.mjs';
const { values } = parseArgs({
  options: {
    local: { type: 'boolean' },
    slug: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string' },
  },
});
if (!values.local)
  throw Error(
    'Only --local provisioning is supported by this script. Live onboarding requires the owner-authenticated Cloudflare operator.',
  );
if (
  !/^[a-z0-9-]{3,60}$/.test(values.slug || '') ||
  !values.name ||
  values.name.length > 100 ||
  !/^\S+@\S+\.\S+$/.test(values.email || '')
)
  throw Error(
    'Required: --local --slug merchant-slug --name "Merchant" --email owner@example.invalid',
  );
const { mf, db } = await runtime({ persist: '.wrangler/demo/d1', seed: false });
try {
  const tid = randomUUID(),
    uid = randomUUID();
  await db.batch([
    db
      .prepare('INSERT INTO tenants(id,slug,name) VALUES (?,?,?)')
      .bind(tid, values.slug, values.name),
    db
      .prepare("INSERT INTO merchant_users VALUES (?,?,?,'owner',1)")
      .bind(uid, tid, values.email.toLowerCase()),
    db.prepare('INSERT INTO tenant_subscription_status(tenant_id) VALUES (?)').bind(tid),
    db
      .prepare('INSERT INTO audit_log VALUES (?,?,?,?,?,?)')
      .bind(
        randomUUID(),
        tid,
        'local_authenticated_operator',
        'tenant_provisioned',
        tid,
        Date.now(),
      ),
  ]);
  console.log(
    'Local tenant provisioned. Sign in through the local mock inbox and configure services, resources, assignments and hours.',
  );
} finally {
  await mf.dispose();
}
