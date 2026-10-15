import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { merchant } from './auth';
import {
  App,
  Env,
  Row,
  stmt,
  rows,
  email,
  token,
  hash,
  hmac,
  equal,
  now,
  id,
  owner,
  phone,
  integer,
  fail,
  limit,
  seal,
  unsealApp,
  audit,
  local,
} from './core';
import { plain, choice, storeData, idem } from './storefront';
export const signup = new Hono<App>();
signup.post('/request', async (c) => {
  if (!local(c) && c.env.SIGNUP_ENABLED !== 'true') fail(503, 'signup_disabled');
  await limit(c, 'signup-ip', 5, 3600000);
  const b = await c.req.json<Row>(),
    address = email(b.email);
  await limit(c, 'signup-email', 2, 3600000, await hash(address));
  if (
    !b.website &&
    !(await stmt(c.env.DB, 'SELECT id FROM merchant_users WHERE email=?', address).first())
  ) {
    const raw = token(),
      challenge = await hash(raw),
      delivery = id();
    await c.env.DB.batch([
      stmt(
        c.env.DB,
        'INSERT INTO signup_challenges(hash,email,expires_at,created_at) VALUES (?,?,?,?)',
        challenge,
        address,
        now() + 600000,
        now(),
      ),
      stmt(
        c.env.DB,
        'INSERT INTO signup_deliveries(id,challenge_hash,payload_cipher,due_at) VALUES (?,?,?,?)',
        delivery,
        challenge,
        await seal(c.env.APP_SECRET, {
          recipient: address,
          token: raw,
          login_url: c.env.APP_BASE_URL + '/signup#' + raw,
        }),
        now(),
      ),
    ]);
  }
  return c.json({
    ok: true,
    message: 'Si cette adresse est éligible, un lien de vérification sera envoyé.',
  });
});
signup.post('/consume', async (c) => {
  if (!local(c) && c.env.SIGNUP_ENABLED !== 'true') fail(503, 'signup_disabled');
  await limit(c, 'signup-consume', 20, 600000);
  const raw = (await c.req.json<Row>()).token;
  if (typeof raw !== 'string' || !/^[a-f0-9]{64}$/.test(raw)) fail(401, 'invalid_signup');
  const hashed = await hash(raw),
    challenge = await stmt(
      c.env.DB,
      'SELECT email,created_at FROM signup_challenges WHERE hash=? AND used_at IS NULL AND expires_at>?',
      hashed,
      now(),
    ).first<Row>();
  if (!challenge) fail(401, 'invalid_signup');
  const tenant = id(),
    user = id(),
    magic = token(),
    session = token();
  try {
    await c.env.DB.batch([
      stmt(
        c.env.DB,
        "INSERT INTO tenants(id,slug,name,storefront_status,reminders_enabled,reviews_enabled,onboarding_started_at,is_demo) VALUES (?,?,?,'draft',0,1,?,?)",
        tenant,
        'draft-' + tenant,
        'Mon commerce',
        challenge.created_at,
        local(c) ? 1 : 0,
      ),
      stmt(c.env.DB, 'INSERT INTO provision_claims VALUES (?,?)', hashed, tenant),
      stmt(
        c.env.DB,
        "INSERT INTO merchant_users VALUES (?,?,?,'owner',1)",
        user,
        tenant,
        challenge.email,
      ),
      stmt(
        c.env.DB,
        'INSERT INTO magic_links VALUES (?,?,?,NULL)',
        await hash(magic),
        user,
        now() + 600000,
      ),
      stmt(
        c.env.DB,
        'INSERT INTO sessions VALUES (?,?,?,?)',
        await hash(session),
        user,
        now() + 43200000,
        await hash(magic),
      ),
      stmt(c.env.DB, 'INSERT INTO tenant_subscription_status(tenant_id) VALUES (?)', tenant),
      stmt(
        c.env.DB,
        'INSERT INTO launch_events VALUES (?,?,?,?,?)',
        id(),
        tenant,
        'tenant_created',
        'created',
        now(),
      ),
      audit(c.env.DB, tenant, user, 'self_provisioned'),
    ]);
  } catch (error) {
    if (/invalid_signup|constraint/i.test(String(error))) fail(401, 'invalid_signup');
    throw error;
  }
  setCookie(c, 'salonos_session', session, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: 43200,
  });
  return c.json({ ok: true, next: '/launch' });
});
export async function processSignup(env: Env, request: typeof fetch = fetch) {
  await stmt(
    env.DB,
    "UPDATE signup_deliveries SET state='failed_retryable' WHERE state='leased' AND lease_until<?",
    now(),
  ).run();
  const jobs = await rows(
    env.DB,
    "SELECT d.* FROM signup_deliveries d JOIN signup_challenges c ON c.hash=d.challenge_hash WHERE d.state IN ('pending','failed_retryable') AND d.due_at<=? AND c.expires_at>? AND c.used_at IS NULL LIMIT 10",
    now(),
    now(),
  );
  for (const job of jobs) {
    const leased = await stmt(
      env.DB,
      "UPDATE signup_deliveries SET state='leased',lease_until=?,attempts=attempts+1 WHERE id=? AND state IN ('pending','failed_retryable') RETURNING id",
      now() + 60000,
      job.id,
    ).first();
    if (!leased) continue;
    const p = await unsealApp(env, job.payload_cipher);
    let outcome = 'failed_retryable',
      provider: string | null = null,
      reason = 'provider_disabled';
    try {
      if (env.EMAIL_PROVIDER === 'mock' && ['test', 'development'].includes(env.ENVIRONMENT)) {
        await stmt(
          env.DB,
          'INSERT OR IGNORE INTO mock_mail VALUES (?,?,?,?)',
          job.id,
          p.recipient,
          p.token,
          now(),
        ).run();
        outcome = 'provider_accepted';
        provider = 'mock_' + job.id;
        reason = 'mock_acceptance_only';
      } else if (env.EMAIL_PROVIDER === 'resend' && env.RESEND_API_KEY && env.EMAIL_FROM) {
        const response = await request('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + env.RESEND_API_KEY,
            'Content-Type': 'application/json',
            'Idempotency-Key': job.id,
          },
          body: JSON.stringify({
            from: env.EMAIL_FROM,
            to: [p.recipient],
            subject: 'SalonOS — Vérifiez votre adresse',
            text: 'Créer votre commerce : ' + p.login_url + '\nCe lien expire dans 10 minutes.',
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (response.ok) {
          const result = (await response.json()) as Row;
          if (typeof result.id === 'string') {
            outcome = 'provider_accepted';
            provider = result.id;
            reason = 'acceptance_not_delivery';
          }
        } else if (response.status < 500 && response.status !== 429) {
          outcome = 'failed_final';
          reason = 'provider_rejected';
        }
      }
    } catch {
      reason = 'provider_unavailable';
    }
    await stmt(
      env.DB,
      'UPDATE signup_deliveries SET state=?,provider_id=?,reason=?,due_at=? WHERE id=?',
      outcome,
      provider,
      reason,
      now() + Math.min(300000, 30000 * 2 ** job.attempts),
      job.id,
    ).run();
  }
  return { processed: jobs.length };
}
export function slugValue(value: unknown) {
  const s = plain(value, 60);
  if (
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(s) ||
    s.length < 3 ||
    /^(admin|api|auth|salonos|support|official|google|meta|whatsapp|instagram|vercel|cloudflare|demo|draft)(-|$)/.test(
      s,
    )
  )
    fail(400, 'invalid_slug');
  return s;
}
merchant.get('/launch', async (c) => {
  const t = await stmt(
    c.env.DB,
    'SELECT * FROM tenants WHERE id=?',
    c.get('merchant').tenant_id,
  ).first<Row>();
  return c.json({
    ...(await storeData(c.env.DB, t!)),
    revision: t!.revision,
    first_published_at: t!.first_published_at,
    onboarding_started_at: t!.onboarding_started_at,
    loyalty_terms_accepted_at: t!.loyalty_terms_accepted_at,
  });
});
merchant.put('/launch', async (c) => {
  const m = owner(c),
    b = await c.req.json<Row>(),
    db = c.env.DB;
  await limit(c, 'launch-write', 60, 60000, m.id);
  const mode = choice(b.business_mode, ['appointments', 'catalog_inquiry']),
    slug = slugValue(b.slug),
    name = plain(b.name, 100),
    template = choice(b.template, ['atelier', 'studio', 'boutique']),
    palette = choice(b.palette, ['forest', 'clay', 'ink']);
  const old = await stmt(
    db,
    'SELECT business_mode FROM tenants WHERE id=?',
    m.tenant_id,
  ).first<Row>();
  if (old!.business_mode !== mode) {
    const history = await stmt(
      db,
      'SELECT (SELECT COUNT(*) FROM bookings WHERE tenant_id=?)+(SELECT COUNT(*) FROM inquiries WHERE tenant_id=?) n',
      m.tenant_id,
      m.tenant_id,
    ).first<Row>();
    if (history!.n) fail(409, 'mode_has_activity');
  }
  try {
    const changed = await db.batch([
      stmt(
        db,
        'UPDATE tenants SET slug=?,name=?,business_mode=?,template=?,palette=?,headline=?,description=?,contact_phone=?,locality=?,policy_text=?,revision=revision+1 WHERE id=? AND revision=? RETURNING revision',
        slug,
        name,
        mode,
        template,
        palette,
        plain(b.headline, 150, true),
        plain(b.description, 600, true),
        b.contact_phone ? phone(b.contact_phone) : null,
        plain(b.locality, 120, true),
        plain(b.policy_text, 1000, true),
        m.tenant_id,
        integer(b.revision, 1, 10000000),
      ),
      audit(db, m.tenant_id, m.id, 'launch_draft_saved'),
    ]);
    if (!changed[0].results.length) fail(409, 'stale_draft');
  } catch (error) {
    if (/UNIQUE constraint/i.test(String(error))) fail(409, 'slug_taken');
    throw error;
  }
  return c.json({ ok: true });
});
merchant.post('/launch/publish', async (c) => {
  const m = owner(c),
    db = c.env.DB,
    b = await c.req.json<Row>();
  await limit(c, 'publish', 10, 600000, m.id);
  idem(c);
  if (b.confirm_ownership !== true || b.confirm_policies !== true)
    fail(400, 'publication_confirmation_required');
  const t = await stmt(db, 'SELECT * FROM tenants WHERE id=?', m.tenant_id).first<Row>();
  slugValue(t!.slug);
  const result = await db.batch([
    stmt(
      db,
      "UPDATE tenants SET storefront_status='published',first_published_at=COALESCE(first_published_at,?),revision=revision+CASE WHEN storefront_status='published' THEN 0 ELSE 1 END WHERE id=? AND contact_phone IS NOT NULL AND policy_text!='' AND ((business_mode='catalog_inquiry' AND EXISTS(SELECT 1 FROM catalog_items WHERE tenant_id=tenants.id AND active=1)) OR (business_mode='appointments' AND EXISTS(SELECT 1 FROM services s JOIN service_resources a ON a.tenant_id=s.tenant_id AND a.service_id=s.id JOIN resources r ON r.tenant_id=a.tenant_id AND r.id=a.resource_id JOIN weekly_hours h ON h.tenant_id=r.tenant_id AND h.resource_id=r.id WHERE s.tenant_id=tenants.id AND s.active=1 AND r.active=1))) RETURNING slug,business_mode,first_published_at",
      now(),
      m.tenant_id,
    ),
    stmt(
      db,
      "INSERT OR IGNORE INTO launch_events SELECT ?,id,'first_publish','first_publish',first_published_at FROM tenants WHERE id=? AND first_published_at IS NOT NULL",
      id(),
      m.tenant_id,
    ),
    audit(db, m.tenant_id, m.id, 'publication_requested'),
  ]);
  if (!result[0].results.length) fail(409, 'setup_incomplete');
  const r = result[0].results[0] as Row;
  return c.json({
    ok: true,
    url: c.env.APP_BASE_URL + '/shop/' + r.slug,
    bio_url: c.env.APP_BASE_URL + '/shop/' + r.slug + '?source=instagram',
    first_published_at: r.first_published_at,
  });
});
merchant.post('/launch/unpublish', async (c) => {
  const m = owner(c);
  await c.env.DB.batch([
    stmt(
      c.env.DB,
      "UPDATE tenants SET storefront_status='unpublished',revision=revision+1 WHERE id=?",
      m.tenant_id,
    ),
    audit(c.env.DB, m.tenant_id, m.id, 'unpublished'),
  ]);
  return c.json({ ok: true });
});
merchant.post('/launch/pause', async (c) => {
  const m = owner(c),
    b = await c.req.json<Row>();
  if (typeof b.paused !== 'boolean') fail(400, 'invalid_boolean');
  await c.env.DB.batch([
    stmt(
      c.env.DB,
      'UPDATE tenants SET paused=?,revision=revision+1 WHERE id=?',
      Number(b.paused),
      m.tenant_id,
    ),
    audit(c.env.DB, m.tenant_id, m.id, 'pause_changed'),
  ]);
  return c.json({ ok: true });
});
merchant.post('/launch/previews', async (c) => {
  const m = owner(c),
    b = await c.req.json<Row>();
  if (b.authorized_business_content !== true) fail(400, 'preview_authorization_required');
  const t = await stmt(c.env.DB, 'SELECT * FROM tenants WHERE id=?', m.tenant_id).first<Row>(),
    raw = token();
  await c.env.DB.batch([
    stmt(
      c.env.DB,
      'INSERT INTO prospect_previews VALUES (?,?,?,?,?)',
      await hash(raw),
      m.tenant_id,
      JSON.stringify(await storeData(c.env.DB, t!)),
      now() + 86400000,
      now(),
    ),
    audit(c.env.DB, m.tenant_id, m.id, 'prospect_preview_created'),
  ]);
  return c.json({ url: c.env.APP_BASE_URL + '/preview#' + raw, expires_in_hours: 24 }, 201);
});
export const preview = new Hono<App>();
merchant.post('/launch/offer', async (c) => {
  const m = owner(c),
    db = c.env.DB,
    b = await c.req.json<Row>(),
    key = idem(c);
  const name = plain(b.name, 100),
    price = integer(b.price_centimes, 0, 10000000),
    t = await stmt(db, 'SELECT business_mode FROM tenants WHERE id=?', m.tenant_id).first<Row>();
  const mode = t!.business_mode,
    duration = mode === 'appointments' ? integer(b.duration_min, 5, 240, 5) : 0,
    opening = mode === 'appointments' ? integer(b.start_min, 0, 1435, 5) : 0,
    closing = mode === 'appointments' ? integer(b.end_min, opening + 5, 1440, 5) : 0;
  const requestHash = await hash(JSON.stringify({ name, price, mode, duration, opening, closing }));
  const replay = async () => {
    const old = await stmt(
      db,
      'SELECT * FROM setup_operations WHERE tenant_id=? AND idempotency_key=?',
      m.tenant_id,
      key,
    ).first<Row>();
    if (old && old.request_hash !== requestHash) fail(409, 'idempotency_mismatch');
    return old;
  };
  const old = await replay();
  if (old) return c.json({ id: old.subject });
  const subject = id(),
    resource = 'setup:' + m.tenant_id,
    q = [
      stmt(
        db,
        'INSERT INTO setup_operations(tenant_id,idempotency_key,request_hash,subject,business_mode) VALUES (?,?,?,?,?)',
        m.tenant_id,
        key,
        requestHash,
        subject,
        mode,
      ),
    ];
  if (mode === 'catalog_inquiry')
    q.push(
      stmt(
        db,
        'INSERT INTO catalog_items(id,tenant_id,name,price_centimes) VALUES (?,?,?,?)',
        subject,
        m.tenant_id,
        name,
        price,
      ),
    );
  else {
    q.push(
      stmt(
        db,
        'INSERT OR IGNORE INTO resources(id,tenant_id,name) VALUES (?,?,?)',
        resource,
        m.tenant_id,
        'Équipe principale',
      ),
      stmt(
        db,
        'INSERT INTO services(id,tenant_id,name,duration_min,price_centimes) VALUES (?,?,?,?,?)',
        subject,
        m.tenant_id,
        name,
        duration,
        price,
      ),
      stmt(db, 'INSERT INTO service_resources VALUES (?,?,?)', m.tenant_id, subject, resource),
    );
    for (let day = 0; day < 7; day++)
      q.push(
        stmt(
          db,
          'INSERT OR IGNORE INTO weekly_hours VALUES (?,?,?,?,?,?)',
          resource + ':' + day,
          m.tenant_id,
          resource,
          day,
          opening,
          closing,
        ),
      );
  }
  q.push(
    stmt(db, 'UPDATE tenants SET revision=revision+1 WHERE id=?', m.tenant_id),
    audit(db, m.tenant_id, m.id, 'onboarding_offer_added', subject),
  );
  try {
    await db.batch(q);
  } catch (error) {
    const duplicate = await replay();
    if (duplicate) return c.json({ id: duplicate.subject });
    throw error;
  }
  return c.json({ id: subject }, 201);
});
preview.post('/', async (c) => {
  await limit(c, 'preview-read', 60);
  const raw = (await c.req.json<Row>()).token;
  if (typeof raw !== 'string' || !/^[a-f0-9]{64}$/.test(raw)) fail(404, 'not_found');
  const r = await stmt(
    c.env.DB,
    'SELECT snapshot FROM prospect_previews WHERE hash=? AND expires_at>?',
    await hash(raw),
    now(),
  ).first<Row>();
  if (!r) fail(404, 'not_found');
  return c.json({ preview: true, booking_disabled: true, ...JSON.parse(r.snapshot) });
});
