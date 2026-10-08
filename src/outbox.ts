import { Env, Row, id, now, seal, stmt } from './core';
export async function bookingMessages(
  env: Env,
  t: Row,
  b: Row,
  customer: Row,
  manageToken: string,
  kind = 'confirmation',
) {
  const channel = b.consent_whatsapp ? 'whatsapp' : 'email',
    consent = channel === 'whatsapp' ? b.consent_whatsapp : b.consent_email;
  const jobs = [{ kind, due: now() }];
  if (t.reminders_enabled && kind !== 'cancellation')
    for (const hours of [24, 2])
      if (b.starts_at - hours * 3600000 > now())
        jobs.push({ kind: 'reminder_' + hours + 'h', due: b.starts_at - hours * 3600000 });
  const payload = await seal(env.APP_SECRET, {
    recipient: channel === 'whatsapp' ? customer.phone : b.contact_email,
    fallback_recipient: channel === 'whatsapp' && b.consent_email ? b.contact_email : null,
    tenant_name: t.name,
    starts_at: b.starts_at,
    timezone: t.timezone,
    manage_url: env.APP_BASE_URL + '/manage#' + b.id + '.' + manageToken,
  });
  return jobs.map((j) =>
    stmt(
      env.DB,
      'INSERT INTO notification_outbox(id,tenant_id,booking_id,customer_id,kind,channel,event_key,payload_cipher,state,due_at,expires_at,created_at) VALUES (?,?,?,(SELECT customer_id FROM bookings WHERE tenant_id=? AND id=?),?,?,?,?,?,?,?,?)',
      id(),
      t.id,
      b.id,
      t.id,
      b.id,
      j.kind,
      channel,
      `${b.id}:${b.revision}:${j.kind}`,
      payload,
      consent ? 'pending' : 'suppressed',
      j.due,
      kind === 'cancellation' ? now() + 86400000 : b.starts_at,
      now(),
    ),
  );
}
