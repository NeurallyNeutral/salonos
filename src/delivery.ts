import { Hono } from 'hono';
import { merchant } from './auth';
import {
  App,
  Env,
  Row,
  stmt,
  rows,
  now,
  id,
  unsealApp,
  seal,
  hmac,
  equal,
  hash,
  str,
  flag,
  owner,
  fail,
  audit,
  local,
} from './core';
import { sendProvider, messageText } from './providers';
import { expireCredits } from './retention';
export async function reconcile(env: Env, tenantId: string | null = null) {
  const events = await rows(
    env.DB,
    "SELECT e.* FROM webhook_events e JOIN notification_outbox o ON o.provider_id=e.provider_id AND o.channel=CASE WHEN e.provider='meta' THEN 'whatsapp' ELSE 'email' END WHERE e.reconciled=0 AND (? IS NULL OR o.tenant_id=?) ORDER BY e.received_at LIMIT 100",
    tenantId,
    tenantId,
  );
  for (const e of events) {
    const channel = e.provider === 'meta' ? 'whatsapp' : 'email';
    const job = await stmt(
      env.DB,
      'SELECT * FROM notification_outbox WHERE channel=? AND provider_id=? AND (? IS NULL OR tenant_id=?)',
      channel,
      e.provider_id,
      tenantId,
      tenantId,
    ).first<Row>();
    if (!job) continue;
    const terminal = e.state === 'delivered';
    await env.DB.batch([
      stmt(
        env.DB,
        "UPDATE notification_outbox SET state=CASE WHEN state='delivered' OR (state='failed_final' AND ?='provider_accepted') THEN state ELSE ? END,delivered_at=CASE WHEN ? THEN COALESCE(delivered_at,?) ELSE delivered_at END,reason=CASE WHEN ?='failed_final' AND state!='delivered' THEN 'receipt_failed' ELSE reason END WHERE id=?",
        e.state,
        e.state,
        terminal ? 1 : 0,
        e.received_at,
        e.state,
        job.id,
      ),
      stmt(env.DB, 'UPDATE webhook_events SET reconciled=1 WHERE id=?', e.id),
      stmt(
        env.DB,
        "UPDATE operations_alerts SET resolved_at=? WHERE tenant_id=? AND subject=? AND ? IN ('delivered','provider_accepted')",
        now(),
        job.tenant_id,
        job.id,
        e.state,
      ),
    ]);
  }
}
export async function processOutbox(
  env: Env,
  tenantId: string | null = null,
  send: typeof sendProvider = sendProvider,
) {
  const db = env.DB,
    clock = now();
  await expireCredits(env, tenantId);
  // An interrupted WhatsApp send may already have reached Meta: quarantine, do not resend.
  await stmt(
    db,
    "UPDATE notification_outbox SET state=CASE WHEN channel='whatsapp' THEN 'uncertain' ELSE 'failed_retryable' END,reason='lease_expired' WHERE state='leased' AND lease_until<? AND (? IS NULL OR tenant_id=?)",
    clock,
    tenantId,
    tenantId,
  ).run();
  await stmt(
    db,
    "INSERT OR IGNORE INTO operations_alerts(id,tenant_id,kind,subject,created_at) SELECT 'lease:'||id,tenant_id,'message_uncertain',id,? FROM notification_outbox WHERE state='uncertain' AND reason='lease_expired' AND (? IS NULL OR tenant_id=?)",
    clock,
    tenantId,
    tenantId,
  ).run();
  const due = await rows(
    db,
    "SELECT id FROM notification_outbox WHERE state IN ('pending','failed_retryable') AND due_at<=? AND (? IS NULL OR tenant_id=?) ORDER BY CASE WHEN kind='magic_link' THEN 0 ELSE 1 END,due_at LIMIT 25",
    clock,
    tenantId,
    tenantId,
  );
  let processed = 0;
  for (const candidate of due) {
    const lease = id();
    const job = await stmt(
      db,
      "UPDATE notification_outbox SET state='leased',lease_token=?,lease_until=?,attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,?) WHERE id=? AND state IN ('pending','failed_retryable') AND due_at<=? RETURNING *",
      lease,
      clock + 60000,
      clock,
      candidate.id,
      clock,
    ).first<Row>();
    if (!job) continue;
    processed++;
    const customer = job.customer_id
      ? await stmt(
          db,
          'SELECT suppressed FROM customers WHERE tenant_id=? AND id=?',
          job.tenant_id,
          job.customer_id,
        ).first<Row>()
      : null;
    const t = await stmt(db, 'SELECT * FROM tenants WHERE id=?', job.tenant_id).first<Row>();
    const booking = job.booking_id
      ? await stmt(
          db,
          'SELECT * FROM bookings WHERE tenant_id=? AND id=?',
          job.tenant_id,
          job.booking_id,
        ).first<Row>()
      : null;
    const marketing = ['review', 'loyalty', 'rebooking'].includes(job.kind);
    const suppress =
      job.expires_at <= clock
        ? 'expired'
        : !t?.active
          ? 'tenant_disabled'
          : customer?.suppressed
            ? 'unsubscribed'
            : marketing && (!t?.marketing_enabled || !booking?.consent_marketing)
              ? 'marketing_disabled'
              : !marketing &&
                  booking &&
                  job.kind !== 'cancellation' &&
                  (booking.status !== 'confirmed' ||
                    booking.revision !== Number(job.event_key.split(':')[1]))
                ? 'booking_obsolete'
                : job.kind.startsWith('reminder') && !t?.reminders_enabled
                  ? 'reminder_obsolete'
                  : null;
    if (suppress) {
      await stmt(
        db,
        "UPDATE notification_outbox SET state='suppressed',reason=? WHERE id=? AND lease_token=?",
        suppress,
        job.id,
        lease,
      ).run();
      continue;
    }
    let result;
    let payload: Row = {};
    try {
      payload = await unsealApp(env, job.payload_cipher);
      result = await send(env, job, payload);
    } catch {
      result = { outcome: 'final', reason: 'invalid_provider_configuration' } as const;
    }
    let state =
      result.outcome === 'accepted'
        ? 'provider_accepted'
        : result.outcome === 'retryable'
          ? 'failed_retryable'
          : result.outcome === 'uncertain'
            ? 'uncertain'
            : 'failed_final';
    if (
      state === 'failed_retryable' &&
      (job.attempts >= 6 || clock - job.first_attempt_at > 23 * 3600000)
    )
      state = 'failed_final';
    const q = [
      stmt(
        db,
        "UPDATE notification_outbox SET state=CASE WHEN state IN ('delivered','failed_final','suppressed') THEN state ELSE ? END,provider_id=COALESCE(provider_id,?),reason=CASE WHEN state IN ('delivered','failed_final','suppressed') THEN reason ELSE ? END,accepted_at=COALESCE(accepted_at,?),due_at=?,lease_until=NULL WHERE id=? AND lease_token=?",
        state,
        result.provider_id ?? null,
        result.reason ?? null,
        state === 'provider_accepted' ? now() : null,
        clock + Math.min(3600000, 30000 * 2 ** job.attempts),
        job.id,
        lease,
      ),
      stmt(
        db,
        'INSERT INTO notification_attempts VALUES (?,?,?,?,?,?)',
        id(),
        job.id,
        job.attempts,
        state,
        result.reason ?? null,
        now(),
      ),
    ];
    if (['failed_final', 'uncertain'].includes(state))
      q.push(
        stmt(
          db,
          "INSERT OR IGNORE INTO operations_alerts(id,tenant_id,kind,subject,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM notification_outbox WHERE id=? AND state IN ('failed_final','uncertain'))",
          id(),
          job.tenant_id,
          'message_' + state,
          job.id,
          now(),
          job.id,
        ),
      );
    if (
      state === 'failed_final' &&
      result.outcome === 'final' &&
      job.channel === 'whatsapp' &&
      payload.fallback_recipient
    )
      q.push(
        stmt(
          db,
          "INSERT OR IGNORE INTO notification_outbox(id,tenant_id,booking_id,customer_id,kind,channel,event_key,payload_cipher,due_at,expires_at,created_at) SELECT ?,?,?,?,?,'email',?,?,?,?,? WHERE EXISTS(SELECT 1 FROM notification_outbox WHERE id=? AND state='failed_final' AND provider_id IS NULL)",
          id(),
          job.tenant_id,
          job.booking_id,
          job.customer_id,
          job.kind,
          job.event_key + ':fallback-email',
          await seal(env.APP_SECRET, {
            ...payload,
            recipient: payload.fallback_recipient,
            fallback_recipient: null,
          }),
          now(),
          job.expires_at,
          now(),
          job.id,
        ),
      );
    await db.batch(q);
  }
  await reconcile(env, tenantId);
  return { processed };
}
merchant.get('/notifications', async (c) =>
  c.json({
    messages: await rows(
      c.env.DB,
      'SELECT id,booking_id,kind,channel,state,attempts,reason,due_at,accepted_at,delivered_at FROM notification_outbox WHERE tenant_id=? ORDER BY created_at DESC LIMIT 200',
      c.get('merchant').tenant_id,
    ),
    alerts: await rows(
      c.env.DB,
      'SELECT * FROM operations_alerts WHERE tenant_id=? AND resolved_at IS NULL',
      c.get('merchant').tenant_id,
    ),
  }),
);
merchant.post('/notifications/process', async (c) => {
  owner(c);
  return c.json(await processOutbox(c.env, c.get('merchant').tenant_id));
});
merchant.post('/notifications/:id/retry', async (c) => {
  const m = owner(c),
    db = c.env.DB;
  const job = await stmt(
    db,
    'SELECT * FROM notification_outbox WHERE tenant_id=? AND id=?',
    m.tenant_id,
    c.req.param('id'),
  ).first<Row>();
  if (!job) fail(404, 'not_found');
  if (
    !['failed_retryable', 'failed_final'].includes(job.state) ||
    job.provider_id ||
    job.first_attempt_at < now() - 23 * 3600000 ||
    job.expires_at < now()
  )
    fail(409, 'unsafe_retry');
  const updated = await db.batch([
    stmt(
      db,
      "UPDATE notification_outbox SET state='pending',due_at=? WHERE tenant_id=? AND id=? AND state IN ('failed_retryable','failed_final') AND provider_id IS NULL",
      now(),
      m.tenant_id,
      job.id,
    ),
    audit(db, m.tenant_id, m.id, 'message_retry', job.id),
  ]);
  if (!updated[0].meta.changes) fail(409, 'unsafe_retry');
  return c.json({ ok: true });
});
merchant.put('/providers/:channel', async (c) => {
  const m = owner(c),
    channel = c.req.param('channel'),
    b = await c.req.json<Row>();
  if (!['email', 'whatsapp'].includes(channel)) fail(400, 'invalid_channel');
  if (!c.env.PROVIDER_KEK) fail(503, 'provider_key_missing');
  const config: Row = {};
  if (channel === 'whatsapp') {
    config.access_token = str(b.access_token, 2000);
    config.phone_number_id = str(b.phone_number_id, 40);
    config.api_version = str(b.api_version, 20);
    if (!/^\d+$/.test(config.phone_number_id) || !/^v\d+\.\d+$/.test(config.api_version))
      fail(400, 'invalid_provider');
    config.language = str(b.language ?? 'fr', 10);
    if (!b.templates || typeof b.templates !== 'object') fail(400, 'templates_required');
    config.templates = {};
    for (const [k, v] of Object.entries(b.templates)) {
      if (!/^[a-z0-9_]+$/.test(str(v, 100))) fail(400, 'invalid_template');
      config.templates[k] = v;
    }
  }
  await c.env.DB.batch([
    stmt(
      c.env.DB,
      'INSERT INTO tenant_provider_connections(tenant_id,channel,enabled,config_cipher,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(tenant_id,channel) DO UPDATE SET enabled=excluded.enabled,config_cipher=excluded.config_cipher,updated_at=excluded.updated_at',
      m.tenant_id,
      channel,
      flag(b.enabled),
      await seal(c.env.PROVIDER_KEK, config),
      now(),
    ),
    audit(c.env.DB, m.tenant_id, m.id, 'provider_configured', channel),
  ]);
  return c.json({ ok: true });
});
export const webhooks = new Hono<App>();
webhooks.get('/meta', (c) => {
  if (
    !c.env.META_VERIFY_TOKEN ||
    !equal(c.req.query('hub.verify_token') || '', c.env.META_VERIFY_TOKEN) ||
    c.req.query('hub.mode') !== 'subscribe'
  )
    fail(403, 'invalid_verification');
  return c.text(c.req.query('hub.challenge') || '');
});
webhooks.post('/meta', async (c) => {
  const raw = await c.req.text();
  if (
    !c.env.META_APP_SECRET ||
    !equal(
      c.req.header('x-hub-signature-256') || '',
      'sha256=' + (await hmac(c.env.META_APP_SECRET, raw)),
    )
  )
    fail(403, 'invalid_signature');
  const data = JSON.parse(raw);
  for (const entry of data.entry ?? [])
    for (const change of entry.changes ?? [])
      for (const s of change.value?.statuses ?? []) {
        if (!['sent', 'delivered', 'read', 'failed'].includes(s.status) || typeof s.id !== 'string')
          continue;
        const state = ['delivered', 'read'].includes(s.status)
          ? 'delivered'
          : s.status === 'failed'
            ? 'failed_final'
            : 'provider_accepted';
        // Callback data bridges the acceptance/receipt race and quarantined timeout outcomes.
        if (typeof s.biz_opaque_callback_data === 'string')
          await stmt(
            c.env.DB,
            "UPDATE notification_outbox SET provider_id=? WHERE id=? AND channel='whatsapp' AND provider_id IS NULL AND state IN ('leased','uncertain')",
            s.id,
            s.biz_opaque_callback_data,
          ).run();
        await stmt(
          c.env.DB,
          'INSERT OR IGNORE INTO webhook_events VALUES (?,?,?,?,?,0)',
          await hash('meta:' + s.id + ':' + s.status),
          'meta',
          s.id,
          state,
          now(),
        ).run();
      }
  await reconcile(c.env);
  return c.json({ ok: true });
});
webhooks.post('/resend', async (c) => {
  const raw = await c.req.text(),
    eventId = c.req.header('svix-id') || '',
    timestamp = c.req.header('svix-timestamp') || '',
    signature = c.req.header('svix-signature') || '';
  if (
    !c.env.RESEND_WEBHOOK_SECRET ||
    Math.abs(now() / 1000 - Number(timestamp)) > 300 ||
    !/^\d+$/.test(timestamp)
  )
    fail(403, 'invalid_signature');
  const bytes = Uint8Array.from(atob(c.env.RESEND_WEBHOOK_SECRET.replace(/^whsec_/, '')), (ch) =>
    ch.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    'raw',
    bytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = btoa(
    String.fromCharCode(
      ...new Uint8Array(
        await crypto.subtle.sign(
          'HMAC',
          key,
          new TextEncoder().encode(eventId + '.' + timestamp + '.' + raw),
        ),
      ),
    ),
  );
  if (!signature.split(' ').some((s) => equal(s, 'v1,' + expected))) fail(403, 'invalid_signature');
  const data = JSON.parse(raw),
    state =
      data.type === 'email.delivered'
        ? 'delivered'
        : ['email.bounced', 'email.complained', 'email.failed'].includes(data.type)
          ? 'failed_final'
          : data.type === 'email.sent'
            ? 'provider_accepted'
            : null;
  if (state && typeof data.data?.email_id === 'string')
    await stmt(
      c.env.DB,
      'INSERT OR IGNORE INTO webhook_events VALUES (?,?,?,?,?,0)',
      'resend:' + eventId,
      'resend',
      data.data.email_id,
      state,
      now(),
    ).run();
  await reconcile(c.env);
  return c.json({ ok: true });
});
