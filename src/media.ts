import { Hono } from 'hono';
import qrcode from 'qrcode-generator';
import { merchant } from './auth';
import { App, Row, owner, stmt, hash, hmac, equal, now, fail, integer, limit, audit } from './core';
import { choice } from './storefront';
import { imageDimensions } from './image-validation';
export const media = new Hono<App>();
merchant.get('/launch/qr.svg', async (c) => {
  const t = await stmt(
    c.env.DB,
    'SELECT slug FROM tenants WHERE id=?',
    c.get('merchant').tenant_id,
  ).first<Row>();
  const qr = qrcode(0, 'M');
  qr.addData(c.env.APP_BASE_URL + '/shop/' + t!.slug + '?source=instagram');
  qr.make();
  c.header('Content-Type', 'image/svg+xml');
  return c.body(qr.createSvgTag({ cellSize: 5, margin: 4, scalable: true }));
});
merchant.post('/assets/ticket', async (c) => {
  const m = owner(c),
    b = await c.req.json<Row>();
  await limit(c, 'assets', 20, 3600000, m.tenant_id);
  if (!c.env.MEDIA) fail(503, 'asset_storage_unavailable');
  if (b.owns_rights !== true) fail(400, 'asset_rights_required');
  const mime = choice(b.mime, ['image/png', 'image/jpeg', 'image/webp']),
    size = integer(b.size, 12, 262144),
    digest = b.sha256;
  if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) fail(400, 'invalid_digest');
  const payload = btoa(
    JSON.stringify({ tenant: m.tenant_id, mime, size, digest, expires: now() + 300000 }),
  );
  return c.json({
    ticket: payload + '.' + (await hmac(c.env.APP_SECRET, 'upload:' + payload)),
    max_bytes: 262144,
  });
});
merchant.post('/assets/upload', async (c) => {
  const m = owner(c),
    b = await c.req.json<Row>();
  if (!c.env.MEDIA) fail(503, 'asset_storage_unavailable');
  if (
    typeof b.ticket !== 'string' ||
    b.ticket.length > 1000 ||
    typeof b.data !== 'string' ||
    b.data.length > 350000
  )
    fail(400, 'invalid_upload');
  const [payload, signature, ...extra] = b.ticket.split('.');
  if (extra.length || !equal(signature || '', await hmac(c.env.APP_SECRET, 'upload:' + payload)))
    fail(403, 'invalid_ticket');
  let p: Row, bytes: Uint8Array;
  try {
    p = JSON.parse(atob(payload));
    bytes = Uint8Array.from(atob(b.data), (v) => v.charCodeAt(0));
  } catch {
    fail(400, 'invalid_upload');
  }
  if (p!.tenant !== m.tenant_id || p!.expires < now()) fail(403, 'invalid_ticket');
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes!))),
    (v) => v.toString(16).padStart(2, '0'),
  ).join('');
  if (bytes!.length !== p!.size || digest !== p!.digest) fail(400, 'upload_mismatch');
  const a = bytes!,
    dimensions = imageDimensions(a, p!.mime);
  if (!dimensions) fail(400, 'invalid_image');
  if (dimensions.some((n) => n < 1 || n > 4096)) fail(400, 'image_too_large');
  const asset = await hash(m.tenant_id + ':' + digest),
    object = m.tenant_id + '/' + digest;
  const total = await stmt(
    c.env.DB,
    'SELECT COUNT(*) n,COALESCE(SUM(size),0) bytes FROM merchant_assets WHERE tenant_id=?',
    m.tenant_id,
  ).first<Row>();
  const existing = await stmt(
    c.env.DB,
    'SELECT id FROM merchant_assets WHERE tenant_id=? AND id=?',
    m.tenant_id,
    asset,
  ).first();
  if (!existing && (total!.n >= 10 || total!.bytes + a.length > 2621440)) fail(409, 'asset_quota');
  await c.env.MEDIA.put(object, a, { httpMetadata: { contentType: p!.mime } });
  await c.env.DB.batch([
    stmt(
      c.env.DB,
      "INSERT OR IGNORE INTO merchant_assets VALUES (?,?,?,?,?,?,'merchant_confirmed_rights',?)",
      asset,
      m.tenant_id,
      object,
      p!.mime,
      a.length,
      digest,
      now(),
    ),
    ...(b.use_as_logo === false
      ? []
      : [
          stmt(
            c.env.DB,
            'UPDATE tenants SET logo_url=?,revision=revision+1 WHERE id=?',
            '/media/' + asset,
            m.tenant_id,
          ),
        ]),
    audit(c.env.DB, m.tenant_id, m.id, 'owned_asset_uploaded', asset),
  ]);
  return c.json({ id: asset, url: '/media/' + asset }, 201);
});
media.get('/:id', async (c) => {
  const asset = await stmt(
    c.env.DB,
    "SELECT a.* FROM merchant_assets a JOIN tenants t ON t.id=a.tenant_id WHERE a.id=? AND t.active=1 AND t.storefront_status='published'",
    c.req.param('id'),
  ).first<Row>();
  if (!asset || !c.env.MEDIA) fail(404, 'not_found');
  const object = await c.env.MEDIA.get(asset.object_key);
  if (!object) fail(404, 'not_found');
  c.header('Content-Type', asset.mime);
  c.header('Content-Disposition', 'inline');
  return c.body(object.body);
});
