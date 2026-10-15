import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { runtime } from '../scripts/runtime.mjs';
import { client, login } from './helpers.mjs';
export async function signupOwner(
  mf,
  db,
  address = 'new-owner@example.invalid',
  ip = 'signup-test',
) {
  const api = client(mf, { 'CF-Connecting-IP': ip });
  assert.equal((await api('/signup-api/request', { email: address })).status, 200);
  await api('/dev/process', {});
  const { token } = await db
    .prepare('SELECT token FROM mock_mail WHERE recipient=? ORDER BY created_at DESC LIMIT 1')
    .bind(address)
    .first();
  const consumed = await api('/signup-api/consume', { token });
  assert.equal(consumed.status, 200);
  const cookie = consumed.headers.get('set-cookie').split(';')[0];
  const session = await client(mf, { Cookie: cookie })('/merchant/session');
  return {
    api: client(mf, { Cookie: cookie, 'X-CSRF-Token': session.data.csrf }),
    cookie,
    token,
    tenant: session.data.merchant.tenant_id,
  };
}
export async function configure(
  owner,
  { mode = 'catalog_inquiry', slug = 'nouveau-commerce' } = {},
) {
  const launch = (await owner.api('/merchant/launch')).data;
  return owner.api(
    '/merchant/launch',
    {
      revision: launch.revision,
      name: 'Commerce fictif',
      slug,
      business_mode: mode,
      template: mode === 'appointments' ? 'atelier' : 'boutique',
      palette: 'clay',
      headline: 'Bienvenue',
      description: 'Fiction',
      contact_phone: '+212600000000',
      locality: 'Rabat',
      policy_text: 'Contactez-nous pour les conditions et vos données.',
    },
    'PUT',
  );
}
test('V2-C verified provisioning is atomic, anti-abuse, resumable and publication requires a ready business', async () => {
  const { mf, db } = await runtime();
  try {
    const owner = await signupOwner(mf, db),
      other = await login(mf, db),
      publicApi = client(mf);
    assert.equal((await publicApi('/signup-api/consume', { token: owner.token })).status, 401);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM tenants').first()).n, 3);
    const t = await db.prepare('SELECT * FROM tenants WHERE id=?').bind(owner.tenant).first();
    assert.equal(t.storefront_status, 'draft');
    assert.equal(t.reminders_enabled, 0);
    assert.equal(t.loyalty_bps, 0);
    assert.equal((await publicApi('/storefront/' + t.slug)).status, 404);
    assert.equal((await configure(owner)).status, 200);
    assert.equal(
      (
        await owner.api(
          '/merchant/launch/publish',
          { confirm_ownership: true, confirm_policies: true },
          'POST',
          { 'Idempotency-Key': randomUUID().replaceAll('-', '') },
        )
      ).status,
      409,
    );
    await owner.api('/merchant/catalog', { name: 'Article fictif', price_centimes: 12000 });
    const pub = () =>
      owner.api(
        '/merchant/launch/publish',
        { confirm_ownership: true, confirm_policies: true },
        'POST',
        { 'Idempotency-Key': randomUUID().replaceAll('-', '') },
      );
    const parallel = await Promise.all([pub(), pub()]);
    assert.ok(parallel.every((r) => r.status === 200));
    assert.equal(parallel[0].data.first_published_at, parallel[1].data.first_published_at);
    assert.equal(
      (
        await db
          .prepare(
            "SELECT COUNT(*) n FROM launch_events WHERE tenant_id=? AND kind='first_publish'",
          )
          .bind(owner.tenant)
          .first()
      ).n,
      1,
    );
    assert.equal((await publicApi('/storefront/nouveau-commerce')).status, 200);
    assert.equal(
      (await client(mf, { Cookie: owner.cookie })('/merchant/launch')).data.tenant.slug,
      'nouveau-commerce',
    );
    const stale = await owner.api(
      '/merchant/launch',
      { ...(await owner.api('/merchant/launch')).data.tenant, revision: 1 },
      'PUT',
    );
    assert.equal(stale.status, 409);
    const current = (await owner.api('/merchant/launch')).data;
    assert.equal(
      (
        await owner.api(
          '/merchant/launch',
          { ...current.tenant, revision: current.revision, slug: 'admin' },
          'PUT',
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await owner.api(
          '/merchant/launch',
          { ...current.tenant, revision: current.revision, name: '<img src=x>' },
          'PUT',
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await owner.api(
          '/merchant/launch',
          { ...current.tenant, revision: current.revision, slug: 'atelier-atlas' },
          'PUT',
        )
      ).status,
      409,
    );
    assert.equal(
      (await client(mf, { Cookie: owner.cookie })('/merchant/launch/unpublish', {})).status,
      403,
    );
    assert.equal((await other.api('/merchant/launch')).data.tenant.slug, 'atelier-atlas');
    const shared = await owner.api('/merchant/launch/previews', {
      authorized_business_content: true,
    });
    const token = shared.data.url.split('#')[1],
      preview = await publicApi('/preview-api', { token });
    assert.equal(preview.status, 200);
    assert.equal(preview.data.booking_disabled, true);
    assert.ok(!JSON.stringify(preview.data).includes('new-owner@example.invalid'));
    await owner.api('/merchant/launch/unpublish', {});
    assert.equal((await publicApi('/storefront/nouveau-commerce')).status, 404);
    assert.equal((await publicApi('/preview-api', { token })).status, 200);
    const qr = await mf.dispatchFetch('http://localhost/merchant/launch/qr.svg', {
      headers: { Cookie: owner.cookie },
    });
    assert.equal(qr.status, 200);
    assert.match(await qr.text(), /<svg/);
  } finally {
    await mf.dispose();
  }
});
test('V2-C simultaneous verification has one winner, expired links fail, production signup defaults closed', async () => {
  const { mf, db } = await runtime();
  try {
    const api = client(mf);
    await api('/signup-api/request', { email: 'race@example.invalid' });
    await api('/dev/process', {});
    const { token } = await db
      .prepare("SELECT token FROM mock_mail WHERE recipient='race@example.invalid'")
      .first();
    const r = await Promise.all(
      Array.from({ length: 10 }, () => api('/signup-api/consume', { token })),
    );
    assert.equal(r.filter((x) => x.status === 200).length, 1);
    assert.equal(r.filter((x) => x.status === 401).length, 9);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM provision_claims').first()).n, 1);
    await api('/signup-api/request', { email: 'expire@example.invalid' });
    await api('/dev/process', {});
    const expired = await db
      .prepare("SELECT token FROM mock_mail WHERE recipient='expire@example.invalid'")
      .first();
    await db.prepare('UPDATE signup_challenges SET expires_at=1 WHERE used_at IS NULL').run();
    assert.equal((await api('/signup-api/consume', { token: expired.token })).status, 401);
    assert.equal((await api('/signup-api/consume', { token: 'x'.repeat(64) })).status, 401);
    for (let i = 0; i < 3; i++)
      await api('/signup-api/request', { email: 'limit' + i + '@example.invalid' });
    assert.equal(
      (await api('/signup-api/request', { email: 'limited@example.invalid' })).status,
      429,
    );
  } finally {
    await mf.dispose();
  }
  const prod = await runtime({ environment: 'production' });
  try {
    assert.equal(
      (await client(prod.mf)('/signup-api/request', { email: 'never@example.invalid' })).status,
      503,
    );
    assert.equal((await client(prod.mf)('/dev/inbox')).status, 404);
  } finally {
    await prod.mf.dispose();
  }
});
test('V2-C signed owned image uploads reject foreign tickets, markup, tampering and missing rights', async () => {
  const { mf, db } = await runtime();
  try {
    const owner = await login(mf, db),
      other = await login(mf, db, 'rivage@example.invalid');
    const data =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      bytes = Buffer.from(data, 'base64'),
      sha256 = createHash('sha256').update(bytes).digest('hex');
    const body = { mime: 'image/png', size: bytes.length, sha256, owns_rights: true };
    assert.equal(
      (await owner.api('/merchant/assets/ticket', { ...body, owns_rights: false })).status,
      400,
    );
    assert.equal(
      (await owner.api('/merchant/assets/ticket', { ...body, mime: 'image/svg+xml' })).status,
      400,
    );
    const { ticket } = (await owner.api('/merchant/assets/ticket', body)).data;
    assert.equal((await other.api('/merchant/assets/upload', { ticket, data })).status, 403);
    assert.equal(
      (await owner.api('/merchant/assets/upload', { ticket: ticket + 'x', data })).status,
      403,
    );
    assert.equal(
      (
        await owner.api('/merchant/assets/upload', {
          ticket,
          data: Buffer.from('fake').toString('base64'),
        })
      ).status,
      400,
    );
    const uploaded = await owner.api('/merchant/assets/upload', { ticket, data });
    assert.equal(uploaded.status, 201);
    assert.equal((await mf.dispatchFetch('http://localhost' + uploaded.data.url)).status, 200);
    const svg = Buffer.from('<svg onload="alert(1)"></svg>'),
      malicious = (
        await owner.api('/merchant/assets/ticket', {
          ...body,
          size: svg.length,
          sha256: createHash('sha256').update(svg).digest('hex'),
        })
      ).data;
    assert.equal(
      (
        await owner.api('/merchant/assets/upload', {
          ticket: malicious.ticket,
          data: svg.toString('base64'),
        })
      ).status,
      400,
    );
  } finally {
    await mf.dispose();
  }
});
