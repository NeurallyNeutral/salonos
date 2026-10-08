import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  APP_BASE_URL: string
  EMAIL_FROM: string
  RESEND_API_KEY?: string
  MAGIC_LINK_SECRET?: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/health', (c) => c.json({ ok: true, service: 'salonos-mvp' }))

app.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const tenant = await c.env.DB.prepare(
    `SELECT id, name, slug, pause_bookings FROM tenants WHERE slug = ? AND active = 1`
  ).bind(slug).first<any>()

  if (!tenant) return c.text('Business not found', 404)
  if (tenant.pause_bookings) return c.html(`<h1>${escapeHtml(tenant.name)}</h1><p>Online booking is temporarily paused.</p>`)

  const services = await c.env.DB.prepare(
    `SELECT id, name, description, duration_min, price_mad FROM services WHERE tenant_id = ? AND active = 1 ORDER BY sort_order, name`
  ).bind(tenant.id).all<any>()

  const cards = services.results.map((s: any) => `
    <button class="service" data-service="${s.id}" data-duration="${s.duration_min}">
      <strong>${escapeHtml(s.name)}</strong>
      <span>${s.price_mad ? `${s.price_mad} MAD` : ''} · ${s.duration_min} min</span>
    </button>`).join('')

  return c.html(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(tenant.name)} — Réserver</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;max-width:700px;margin:0 auto;padding:28px;background:#fafafa;color:#111}.service{width:100%;text-align:left;padding:16px;margin:8px 0;border:1px solid #ddd;background:white;border-radius:14px}.service span{display:block;color:#666;margin-top:4px}input,select,button{font:inherit}.muted{color:#666}.box{background:white;border:1px solid #e5e5e5;border-radius:16px;padding:18px;margin-top:18px}
</style></head><body>
<h1>${escapeHtml(tenant.name)}</h1><p class="muted">Choisissez un service pour commencer.</p>
<div class="box">${cards || '<p>Aucun service disponible.</p>'}</div>
<p class="muted">MVP demo: availability + booking form is wired through API routes in the next implementation pass.</p>
</body></html>`)
})

app.get('/api/:slug/services', async (c) => {
  const slug = c.req.param('slug')
  const rows = await c.env.DB.prepare(`
    SELECT s.id, s.name, s.description, s.duration_min, s.price_mad
    FROM services s JOIN tenants t ON t.id=s.tenant_id
    WHERE t.slug=? AND t.active=1 AND s.active=1
    ORDER BY s.sort_order, s.name
  `).bind(slug).all()
  return c.json(rows.results)
})

app.post('/api/:slug/book', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json<any>()

  const tenant = await c.env.DB.prepare(`SELECT id, pause_bookings FROM tenants WHERE slug=? AND active=1`).bind(slug).first<any>()
  if (!tenant) return c.json({ error: 'business_not_found' }, 404)
  if (tenant.pause_bookings) return c.json({ error: 'booking_paused' }, 409)

  const service = await c.env.DB.prepare(`SELECT id, duration_min FROM services WHERE id=? AND tenant_id=? AND active=1`).bind(body.service_id, tenant.id).first<any>()
  if (!service) return c.json({ error: 'invalid_service' }, 400)

  const start = new Date(body.starts_at)
  if (!Number.isFinite(start.getTime())) return c.json({ error: 'invalid_start' }, 400)
  const end = new Date(start.getTime() + service.duration_min * 60_000)

  // Production V1 must recheck generated availability and resource collision transactionally.
  const conflict = await c.env.DB.prepare(`
    SELECT id FROM bookings
    WHERE tenant_id=? AND status='confirmed' AND starts_at < ? AND ends_at > ?
    LIMIT 1
  `).bind(tenant.id, end.toISOString(), start.toISOString()).first()
  if (conflict) return c.json({ error: 'slot_taken' }, 409)

  const id = crypto.randomUUID()
  const manageToken = randomToken()
  const manageHash = await sha256(manageToken)

  await c.env.DB.prepare(`
    INSERT INTO bookings (id, tenant_id, service_id, resource_id, customer_name, customer_phone, customer_email, starts_at, ends_at, source, utm_source, utm_campaign, manage_token_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, tenant.id, service.id, body.resource_id ?? null,
    String(body.customer_name ?? '').trim(), String(body.customer_phone ?? '').trim(), body.customer_email ?? null,
    start.toISOString(), end.toISOString(), body.source ?? 'direct', body.utm_source ?? null, body.utm_campaign ?? null, manageHash
  ).run()

  await c.env.DB.prepare(`INSERT INTO event_log (tenant_id, booking_id, kind, payload_json) VALUES (?, ?, 'booking_created', ?)`)
    .bind(tenant.id, id, JSON.stringify({ source: body.source ?? 'direct' })).run()

  return c.json({ ok: true, booking_id: id, manage_token: manageToken }, 201)
})

app.get('/manage/:slug/bookings', async (c) => {
  // DEMO ONLY: protect with magic-link auth before production.
  const slug = c.req.param('slug')
  const tenant = await c.env.DB.prepare(`SELECT id, name FROM tenants WHERE slug=?`).bind(slug).first<any>()
  if (!tenant) return c.text('Not found', 404)
  const rows = await c.env.DB.prepare(`
    SELECT b.id,b.customer_name,b.customer_phone,b.starts_at,b.status,s.name service_name
    FROM bookings b JOIN services s ON s.id=b.service_id
    WHERE b.tenant_id=? ORDER BY b.starts_at DESC LIMIT 200
  `).bind(tenant.id).all<any>()

  const tr = rows.results.map((b:any)=>`<tr><td>${escapeHtml(b.starts_at)}</td><td>${escapeHtml(b.customer_name)}</td><td>${escapeHtml(b.service_name)}</td><td>${escapeHtml(b.status)}</td></tr>`).join('')
  return c.html(`<meta name="viewport" content="width=device-width,initial-scale=1"><h1>${escapeHtml(tenant.name)} — Bookings</h1><table border="1" cellpadding="8" cellspacing="0"><tr><th>Time</th><th>Client</th><th>Service</th><th>Status</th></tr>${tr}</table>`)
})

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) {
    const now = Date.now()
    const windows = [
      { key: '24h', ms: 24 * 60 * 60 * 1000, column: 'reminder_24h_sent_at' },
      { key: '2h', ms: 2 * 60 * 60 * 1000, column: 'reminder_2h_sent_at' }
    ] as const

    for (const w of windows) {
      const from = new Date(now + w.ms - 7.5 * 60_000).toISOString()
      const to = new Date(now + w.ms + 7.5 * 60_000).toISOString()
      const q = `SELECT id, tenant_id, customer_name, customer_phone, customer_email, starts_at FROM bookings WHERE status='confirmed' AND ${w.column} IS NULL AND starts_at BETWEEN ? AND ? LIMIT 500`
      const due = await env.DB.prepare(q).bind(from, to).all<any>()
      for (const b of due.results) {
        // V1: call Meta utility template when tenant WhatsApp config exists, then email fallback.
        await env.DB.prepare(`UPDATE bookings SET ${w.column}=? WHERE id=? AND ${w.column} IS NULL`).bind(new Date().toISOString(), b.id).run()
        await env.DB.prepare(`INSERT INTO event_log (tenant_id, booking_id, kind, payload_json) VALUES (?, ?, ?, ?)`)
          .bind(b.tenant_id, b.id, `reminder_${w.key}_queued`, JSON.stringify({ starts_at: b.starts_at })).run()
      }
    }
  }
}

function escapeHtml(v: unknown) {
  return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch] as string))
}

function randomToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('')
}
