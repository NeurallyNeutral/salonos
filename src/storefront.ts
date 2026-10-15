import { Hono } from 'hono';
import { merchant } from './auth';
import {
  App,
  Row,
  Ctx,
  stmt,
  rows,
  str,
  integer,
  flag,
  phone,
  email,
  id,
  now,
  hash,
  limit,
  owner,
  fail,
  audit,
} from './core';

export const storefront = new Hono<App>();
export function plain(value: unknown, max = 120, empty = false): string {
  if (empty && (value === '' || value == null)) return '';
  const text = str(value, max);
  if (/[<>\u0000-\u001f]/.test(text)) fail(400, 'invalid_text');
  return text;
}
export function choice(value: unknown, allowed: string[]): string {
  if (typeof value !== 'string' || !allowed.includes(value)) fail(400, 'invalid_choice');
  return value;
}
export function idem(c: Ctx): string {
  const key = str(c.req.header('Idempotency-Key'), 100);
  if (!/^[a-zA-Z0-9_-]{32,100}$/.test(key)) fail(400, 'invalid_idempotency_key');
  return key;
}
export async function storeData(db: D1Database, t: Row) {
  return {
    tenant: Object.fromEntries(
      [
        'slug',
        'name',
        'timezone',
        'business_mode',
        'storefront_status',
        'template',
        'palette',
        'headline',
        'description',
        'contact_phone',
        'locality',
        'policy_text',
        'paused',
        'loyalty_bps',
        'review_url',
        'is_demo',
        'logo_url',
      ].map((k) => [k, t[k]]),
    ),
    whatsapp_url: t.contact_phone ? 'https://wa.me/' + t.contact_phone.slice(1) : null,
    items: await rows(
      db,
      'SELECT id,name,description,variant,price_centimes,availability FROM catalog_items WHERE tenant_id=? AND active=1',
      t.id,
    ),
    services: await rows(
      db,
      'SELECT id,name,duration_min,price_centimes FROM services WHERE tenant_id=? AND active=1',
      t.id,
    ),
    automation: {
      whatsapp: 'DISCONNECTED',
      note: 'Le lien WhatsApp ouvre une conversation à votre initiative. Il ne programme aucun rappel.',
    },
  };
}
storefront.get('/:slug', async (c) => {
  const t = await stmt(
    c.env.DB,
    "SELECT * FROM tenants WHERE slug=? AND active=1 AND storefront_status='published'",
    c.req.param('slug'),
  ).first<Row>();
  if (!t) fail(404, 'not_found');
  return c.json(await storeData(c.env.DB, t));
});
merchant.get('/catalog', async (c) =>
  c.json({
    items: await rows(
      c.env.DB,
      'SELECT * FROM catalog_items WHERE tenant_id=? ORDER BY name',
      c.get('merchant').tenant_id,
    ),
  }),
);
merchant.post('/catalog', async (c) => {
  const m = owner(c),
    b = await c.req.json<Row>(),
    key = id();
  const t = await stmt(
    c.env.DB,
    'SELECT business_mode FROM tenants WHERE id=?',
    m.tenant_id,
  ).first<Row>();
  if (t?.business_mode !== 'catalog_inquiry') fail(409, 'mode_unavailable');
  await c.env.DB.batch([
    stmt(
      c.env.DB,
      'INSERT INTO catalog_items(id,tenant_id,name,description,variant,price_centimes,availability) VALUES (?,?,?,?,?,?,?)',
      key,
      m.tenant_id,
      plain(b.name, 100),
      plain(b.description, 600, true),
      plain(b.variant, 100, true),
      integer(b.price_centimes, 0, 10000000),
      choice(b.availability ?? 'ask', ['ask', 'available', 'unavailable']),
    ),
    audit(c.env.DB, m.tenant_id, m.id, 'catalog_created', key),
  ]);
  return c.json({ id: key }, 201);
});
merchant.patch('/catalog/:id', async (c) => {
  const m = owner(c),
    b = await c.req.json<Row>(),
    key = c.req.param('id');
  const item = await stmt(
    c.env.DB,
    'SELECT * FROM catalog_items WHERE tenant_id=? AND id=?',
    m.tenant_id,
    key,
  ).first<Row>();
  if (!item) fail(404, 'not_found');
  const v = { ...item, ...b };
  await c.env.DB.batch([
    stmt(
      c.env.DB,
      'UPDATE catalog_items SET name=?,description=?,variant=?,price_centimes=?,availability=?,active=? WHERE tenant_id=? AND id=?',
      plain(v.name, 100),
      plain(v.description, 600, true),
      plain(v.variant, 100, true),
      integer(v.price_centimes, 0, 10000000),
      choice(v.availability, ['ask', 'available', 'unavailable']),
      flag(v.active),
      m.tenant_id,
      key,
    ),
    audit(c.env.DB, m.tenant_id, m.id, 'catalog_updated', key),
  ]);
  return c.json({ ok: true });
});
storefront.post('/:slug/inquiries', async (c) => {
  await limit(c, 'inquiry-ip', 30, 600000);
  const t = await stmt(
    c.env.DB,
    "SELECT * FROM tenants WHERE slug=? AND active=1 AND business_mode='catalog_inquiry' AND storefront_status='published'",
    c.req.param('slug'),
  ).first<Row>();
  if (!t) fail(404, 'not_found');
  const b = await c.req.json<Row>(),
    key = idem(c),
    itemId = str(b.item_id),
    quantity = integer(b.quantity ?? 1, 1, 20);
  const name = plain(b.name, 100),
    mobile = phone(b.phone),
    address = b.email ? email(b.email) : null,
    note = plain(b.note, 600, true),
    variant = plain(b.variant, 100, true);
  if (b.consent_contact !== true) fail(400, 'contact_consent_required');
  const marketing = flag(b.consent_marketing ?? false),
    source = choice(b.source ?? 'direct', ['direct', 'instagram', 'google', 'referral']);
  await limit(c, 'inquiry-phone:' + t.id, 10, 600000, await hash(mobile));
  const requestHash = await hash(
    JSON.stringify({ itemId, quantity, name, mobile, address, note, variant, marketing, source }),
  );
  const replay = async () => {
    const old = await stmt(
      c.env.DB,
      'SELECT id,request_hash FROM inquiries WHERE tenant_id=? AND idempotency_key=?',
      t.id,
      key,
    ).first<Row>();
    if (old && old.request_hash !== requestHash) fail(409, 'idempotency_mismatch');
    return old;
  };
  const old = await replay();
  if (old) return c.json({ id: old.id, status: 'received', payment_status: 'not_paid' });
  const item = await stmt(
    c.env.DB,
    'SELECT * FROM catalog_items WHERE tenant_id=? AND id=? AND active=1',
    t.id,
    itemId,
  ).first<Row>();
  if (!item) fail(404, 'not_found');
  const inquiry = id(),
    customer = id();
  try {
    await c.env.DB.batch([
      stmt(
        c.env.DB,
        'INSERT OR IGNORE INTO customers(id,tenant_id,name,phone,email,created_at) VALUES (?,?,?,?,?,?)',
        customer,
        t.id,
        name,
        mobile,
        address,
        now(),
      ),
      stmt(
        c.env.DB,
        'INSERT INTO inquiries(id,tenant_id,item_id,customer_id,variant,quantity,price_centimes,note,source,consent_contact,consent_marketing,created_at,idempotency_key,request_hash) VALUES (?,?,?,(SELECT id FROM customers WHERE tenant_id=? AND phone=?),?,?,?,?,?,1,?,?,?,?)',
        inquiry,
        t.id,
        itemId,
        t.id,
        mobile,
        variant,
        quantity,
        item.price_centimes * quantity,
        note,
        source,
        marketing,
        now(),
        key,
        requestHash,
      ),
    ]);
  } catch (error) {
    const duplicate = await replay();
    if (duplicate)
      return c.json({ id: duplicate.id, status: 'received', payment_status: 'not_paid' });
    if (/inquiry_unavailable|constraint/i.test(String(error))) fail(409, 'inquiry_unavailable');
    throw error;
  }
  return c.json({ id: inquiry, status: 'received', payment_status: 'not_paid' }, 201);
});
merchant.get('/inquiries', async (c) =>
  c.json({
    inquiries: await rows(
      c.env.DB,
      'SELECT i.*,c.name,c.phone,c.email,p.name item_name FROM inquiries i JOIN customers c ON c.tenant_id=i.tenant_id AND c.id=i.customer_id JOIN catalog_items p ON p.tenant_id=i.tenant_id AND p.id=i.item_id WHERE i.tenant_id=? ORDER BY i.created_at DESC LIMIT 100',
      c.get('merchant').tenant_id,
    ),
  }),
);
merchant.patch('/inquiries/:id', async (c) => {
  const m = c.get('merchant'),
    b = await c.req.json<Row>(),
    status = choice(b.status, ['new', 'contacted', 'fulfilled', 'cancelled']);
  const result = await stmt(
    c.env.DB,
    "UPDATE inquiries SET status=?,fulfilled_at=CASE WHEN ?='fulfilled' THEN COALESCE(fulfilled_at,?) ELSE fulfilled_at END WHERE tenant_id=? AND id=? AND (status!='fulfilled' OR ?='fulfilled') RETURNING id",
    status,
    status,
    now(),
    m.tenant_id,
    c.req.param('id'),
    status,
  ).first();
  if (!result) fail(409, 'inquiry_conflict');
  await audit(c.env.DB, m.tenant_id, m.id, 'inquiry_' + status, c.req.param('id')).run();
  return c.json({ ok: true });
});
