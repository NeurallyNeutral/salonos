import { Hono } from 'hono';
import {
  App,
  Env,
  Row,
  Ctx,
  stmt,
  rows,
  str,
  phone,
  email,
  flag,
  integer,
  token,
  hash,
  hmac,
  seal,
  unsealApp,
  now,
  id,
  fail,
  limit,
  audit,
} from './core';
import { merchant } from './auth';
import { tenantBySlug, offers, verifyOffer, CELL, displayTime, localParts } from './availability';
import { bookingMessages } from './outbox';
import { completedMessages } from './retention';
export const publicApi = new Hono<App>();
publicApi.get('/:slug', async (c) => {
  const t = await tenantBySlug(c.env, c.req.param('slug'));
  return c.json({
    tenant: {
      name: t.name,
      slug: t.slug,
      timezone: t.timezone,
      local_today: localParts(now(), t.timezone).date,
      paused: t.paused,
      logo_url: t.logo_url,
      loyalty_bps: t.loyalty_bps,
    },
    services: await rows(
      c.env.DB,
      'SELECT id,name,duration_min,buffer_min,price_centimes FROM services WHERE tenant_id=? AND active=1',
      t.id,
    ),
  });
});
publicApi.get('/:slug/availability', async (c) => {
  await limit(c, 'availability', 120);
  const t = await tenantBySlug(c.env, c.req.param('slug'));
  return c.json({
    slots: await offers(c.env, t, str(c.req.query('service_id')), str(c.req.query('date'))),
  });
});
function claim(db: D1Database, b: Row) {
  return stmt(
    db,
    'WITH RECURSIVE slots(x) AS (SELECT ? UNION ALL SELECT x+300000 FROM slots WHERE x+300000<?) INSERT INTO booking_claims SELECT ?,?,x,? FROM slots',
    b.starts_at,
    b.occupied_until,
    b.tenant_id,
    b.resource_id,
    b.id,
  );
}
async function createBooking(c: Ctx, t: Row, manual = false) {
  await limit(c, 'booking:' + t.id, 60);
  const b = await c.req.json<Row>(),
    key = str(c.req.header('Idempotency-Key'), 100);
  if (!/^[a-zA-Z0-9_-]{32,100}$/.test(key)) fail(400, 'invalid_idempotency_key');
  const customer = {
    name: str(b.name, 100),
    phone: phone(b.phone),
    email: b.email ? email(b.email) : null,
  };
  await limit(c, 'booking-phone:' + t.id, 60, 600000, await hash(customer.phone));
  const consent = {
    consent_email: flag(b.consent_email ?? false),
    consent_whatsapp: flag(b.consent_whatsapp ?? false),
    consent_marketing: flag(b.consent_marketing ?? false),
  };
  if (consent.consent_email && !customer.email) fail(400, 'email_required');
  const source = manual
    ? ['manual', 'whatsapp', 'walk_in'].includes(b.source)
      ? b.source
      : 'manual'
    : ['direct', 'instagram', 'google', 'referral'].includes(b.source)
      ? b.source
      : 'direct';
  const requestHash = await hash(JSON.stringify({ offer: b.offer, customer, consent, source }));
  const replay = async () => {
    const r = await stmt(
      c.env.DB,
      'SELECT request_hash,response_cipher FROM bookings WHERE tenant_id=? AND idempotency_key=?',
      t.id,
      key,
    ).first<Row>();
    if (r) {
      if (r.request_hash !== requestHash) fail(409, 'idempotency_mismatch');
      if (!r.response_cipher) fail(409, 'booking_unavailable');
      return unsealApp(c.env, r.response_cipher);
    }
    return null;
  };
  const existing = await replay();
  if (existing) return c.json(existing);
  const { p, service, end } = await verifyOffer(c.env, t, b.offer, manual);
  const bookingId = id(),
    manage = token(),
    customerId = id(),
    created = now();
  const response = {
    id: bookingId,
    manage_token: manage,
    starts_at: p.starts_at,
    display_starts_at: displayTime(p.starts_at, t.timezone),
    notification_status: 'queued_or_suppressed',
  };
  const booking = {
    id: bookingId,
    tenant_id: t.id,
    customer_id: customerId,
    resource_id: p.resource_id,
    starts_at: p.starts_at,
    occupied_until: end,
    revision: 1,
    contact_email: customer.email,
    ...consent,
  };
  const db = c.env.DB;
  try {
    await db.batch([
      stmt(
        db,
        'INSERT OR IGNORE INTO customers(id,tenant_id,name,phone,email,created_at) VALUES (?,?,?,?,?,?)',
        customerId,
        t.id,
        customer.name,
        customer.phone,
        customer.email,
        created,
      ),
      stmt(
        db,
        'INSERT INTO bookings(id,tenant_id,customer_id,service_id,resource_id,starts_at,ends_at,occupied_until,price_centimes,source,manage_hash,manage_expires,config_revision,idempotency_key,request_hash,response_cipher,consent_email,consent_whatsapp,consent_marketing,consent_at,created_at,contact_email) VALUES (?,?,(SELECT id FROM customers WHERE tenant_id=? AND phone=?),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        bookingId,
        t.id,
        t.id,
        customer.phone,
        p.service_id,
        p.resource_id,
        p.starts_at,
        p.starts_at + service.duration_min * 60000,
        end,
        service.price_centimes,
        source,
        await hash(manage),
        end + 30 * 86400000,
        t.revision,
        key,
        requestHash,
        await seal(c.env.APP_SECRET, response),
        consent.consent_email,
        consent.consent_whatsapp,
        consent.consent_marketing,
        created,
        created,
        customer.email,
      ),
      claim(db, booking),
      ...(await bookingMessages(c.env, t, booking, customer, manage)),
      audit(db, t.id, manual ? c.get('merchant').id : 'customer', 'booking_created', bookingId),
    ]);
  } catch (error) {
    const duplicate = await replay();
    if (duplicate) return c.json(duplicate);
    const message = String(error);
    if (/UNIQUE|stale_configuration|constraint/i.test(message)) fail(409, 'slot_taken');
    throw error;
  }
  return c.json(response, 201);
}
publicApi.post('/:slug/bookings', async (c) =>
  createBooking(c, await tenantBySlug(c.env, c.req.param('slug'))),
);
merchant.get('/availability', async (c) => {
  const t = await stmt(
    c.env.DB,
    'SELECT * FROM tenants WHERE id=?',
    c.get('merchant').tenant_id,
  ).first<Row>();
  return c.json({
    slots: await offers(c.env, t!, str(c.req.query('service_id')), str(c.req.query('date')), true),
  });
});
merchant.post('/bookings', async (c) =>
  createBooking(
    c,
    (await stmt(
      c.env.DB,
      'SELECT * FROM tenants WHERE id=?',
      c.get('merchant').tenant_id,
    ).first<Row>())!,
    true,
  ),
);
merchant.get('/bookings', async (c) => {
  const from = Number(c.req.query('from') ?? 0),
    to = Number(c.req.query('to') ?? 9000000000000);
  integer(from, 0, 9000000000000);
  integer(to, from + 1, 9000000000000);
  const offset = integer(Number(c.req.query('offset') ?? 0), 0, 10000000);
  const timezone = (await stmt(
    c.env.DB,
    'SELECT timezone FROM tenants WHERE id=?',
    c.get('merchant').tenant_id,
  ).first<Row>())!.timezone;
  const page = await rows(
    c.env.DB,
    'SELECT b.id,b.customer_id,b.service_id,b.resource_id,b.starts_at,b.ends_at,b.price_centimes,b.status,b.source,b.revision,c.name,c.phone,c.email,s.name service_name FROM bookings b JOIN customers c ON c.tenant_id=b.tenant_id AND c.id=b.customer_id JOIN services s ON s.tenant_id=b.tenant_id AND s.id=b.service_id WHERE b.tenant_id=? AND b.starts_at>=? AND b.starts_at<? ORDER BY b.starts_at,b.id LIMIT 501 OFFSET ?',
    c.get('merchant').tenant_id,
    from,
    to,
    offset,
  );
  return c.json({
    next_offset: page.length > 500 ? offset + 500 : null,
    bookings: page.slice(0, 500).map((b) => ({
      ...b,
      local_date: localParts(b.starts_at, timezone).date,
      display_starts_at: displayTime(b.starts_at, timezone),
    })),
  });
});
export const manageApi = new Hono<App>();
manageApi.use('/:id/*', async (c, next) => {
  await limit(c, 'manage', 60);
  await next();
});
async function managed(c: Ctx) {
  const key = c.req.param('id'),
    raw = c.req.header('Authorization')?.replace(/^Bearer /, '') || '';
  const b = await stmt(
    c.env.DB,
    'SELECT * FROM bookings WHERE id=? AND manage_hash=? AND manage_expires>?',
    key,
    await hash(raw),
    now(),
  ).first<Row>();
  if (!b) fail(404, 'not_found');
  return b;
}
manageApi.get('/:id', async (c) => {
  const b = await managed(c),
    t = (await stmt(
      c.env.DB,
      'SELECT slug,timezone FROM tenants WHERE id=?',
      b.tenant_id,
    ).first<Row>())!;
  return c.json({
    id: b.id,
    display_starts_at: displayTime(b.starts_at, t.timezone),
    starts_at: b.starts_at,
    ends_at: b.ends_at,
    status: b.status,
    service_id: b.service_id,
    revision: b.revision,
    slug: (await stmt(c.env.DB, 'SELECT slug FROM tenants WHERE id=?', b.tenant_id).first<Row>())!
      .slug,
  });
});
async function changeBooking(
  c: Ctx,
  b: Row,
  kind: 'cancel' | 'reschedule' | 'attendance',
  isMerchant: boolean,
) {
  const db = c.env.DB,
    t = (await stmt(db, 'SELECT * FROM tenants WHERE id=?', b.tenant_id).first<Row>())!,
    body = await c.req.json<Row>();
  if (b.status !== 'confirmed') fail(409, 'invalid_status');
  if (!isMerchant && b.starts_at <= now()) fail(409, 'visit_started');
  const q = [
    stmt(
      db,
      'INSERT INTO booking_operations VALUES (?,?,?,?,?,?)',
      id(),
      b.tenant_id,
      b.id,
      b.revision,
      kind,
      now(),
    ),
  ];
  let response: Row = { ok: true };
  const next = { ...b, revision: b.revision + 1 };
  const raw = token();
  if (kind === 'reschedule') {
    const { p, service, end } = await verifyOffer(c.env, t, body.offer, isMerchant);
    if (p.service_id !== b.service_id) fail(400, 'service_change_not_allowed');
    Object.assign(next, {
      resource_id: p.resource_id,
      starts_at: p.starts_at,
      occupied_until: end,
    });
    q.push(
      stmt(db, 'DELETE FROM booking_claims WHERE tenant_id=? AND booking_id=?', b.tenant_id, b.id),
      stmt(
        db,
        'UPDATE bookings SET resource_id=?,starts_at=?,ends_at=?,occupied_until=?,config_revision=?,revision=revision+1,manage_hash=?,manage_expires=? WHERE tenant_id=? AND id=?',
        p.resource_id,
        p.starts_at,
        p.starts_at + service.duration_min * 60000,
        end,
        t.revision,
        await hash(raw),
        end + 30 * 86400000,
        b.tenant_id,
        b.id,
      ),
      claim(db, next),
    );
    response = { ok: true, manage_token: raw };
  } else {
    let status = 'cancelled';
    if (kind === 'attendance') {
      if (!['completed', 'no_show'].includes(body.status)) fail(400, 'invalid_status');
      if (b.ends_at > now()) fail(409, 'visit_not_finished');
      status = body.status;
    }
    q.push(
      stmt(
        db,
        'UPDATE bookings SET status=?,revision=revision+1,manage_hash=? WHERE tenant_id=? AND id=?',
        status,
        await hash(raw),
        b.tenant_id,
        b.id,
      ),
    );
    if (kind === 'cancel')
      q.push(
        stmt(
          db,
          'DELETE FROM booking_claims WHERE tenant_id=? AND booking_id=?',
          b.tenant_id,
          b.id,
        ),
      );
  }
  q.push(
    stmt(
      db,
      "UPDATE notification_outbox SET state='suppressed',reason='booking_changed' WHERE tenant_id=? AND booking_id=? AND state IN ('pending','failed_retryable')",
      b.tenant_id,
      b.id,
    ),
  );
  if (kind !== 'attendance') {
    const customer = (await stmt(
      db,
      'SELECT * FROM customers WHERE tenant_id=? AND id=?',
      b.tenant_id,
      b.customer_id,
    ).first<Row>())!;
    q.push(
      ...(await bookingMessages(
        c.env,
        t,
        next,
        customer,
        raw,
        kind === 'cancel' ? 'cancellation' : 'reschedule',
      )),
    );
  }
  if (kind === 'attendance' && body.status === 'completed')
    q.push(...(await completedMessages(c.env, t, b)));
  q.push(audit(db, b.tenant_id, isMerchant ? c.get('merchant').id : 'customer', kind, b.id));
  try {
    await db.batch(q);
  } catch (error) {
    if (/UNIQUE|stale_booking|stale_configuration/i.test(String(error)))
      fail(409, 'booking_conflict');
    throw error;
  }
  return c.json(response);
}
for (const kind of ['cancel', 'reschedule'] as const)
  manageApi.post('/:id/' + kind, async (c) => changeBooking(c, await managed(c), kind, false));
for (const kind of ['cancel', 'reschedule', 'attendance'] as const)
  merchant.post('/bookings/:id/' + kind, async (c) => {
    const b = await stmt(
      c.env.DB,
      'SELECT * FROM bookings WHERE tenant_id=? AND id=?',
      c.get('merchant').tenant_id,
      c.req.param('id'),
    ).first<Row>();
    if (!b) fail(404, 'not_found');
    return changeBooking(c, b, kind, true);
  });
