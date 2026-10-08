import { Env, Row, stmt, now, unsealProvider } from './core';
export type Delivery = {
  outcome: 'accepted' | 'retryable' | 'final' | 'uncertain';
  provider_id?: string;
  reason?: string;
};
export function messageText(job: Row, p: Row): string {
  if (!p.recipient) return 'Message effacé à la demande du client.';
  if (job.kind === 'magic_link')
    return `Connexion SalonOS : ${p.login_url}\nCe lien expire dans 10 minutes.`;
  if (job.kind === 'review')
    return `Merci pour votre visite chez ${p.tenant_name}. Si vous souhaitez partager votre expérience honnête, vous pouvez laisser un avis ici : ${p.review_url}. Tous les retours sont les bienvenus.\nSe désinscrire : ${p.unsubscribe_url}`;
  if (job.kind === 'loyalty')
    return `Votre crédit chez ${p.tenant_name} a été mis à jour. Consultez votre commerce pour le détail.\nSe désinscrire : ${p.unsubscribe_url}`;
  if (job.kind === 'rebooking')
    return `Vous pouvez réserver une prochaine visite chez ${p.tenant_name} : ${p.booking_url}\nSe désinscrire : ${p.unsubscribe_url}`;
  const label = new Intl.DateTimeFormat('fr-MA', {
    timeZone: p.timezone,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(p.starts_at);
  return `${p.tenant_name} — ${job.kind === 'cancellation' ? 'Annulation' : job.kind.startsWith('reminder') ? 'Rappel' : 'Rendez-vous'} : ${label}.\nGérer votre rendez-vous : ${p.manage_url}`;
}
export async function sendProvider(
  env: Env,
  job: Row,
  payload: Row,
  request: typeof fetch = fetch,
): Promise<Delivery> {
  const selected = job.channel === 'email' ? env.EMAIL_PROVIDER : env.WHATSAPP_PROVIDER;
  if (selected === 'mock') {
    if (!['test', 'development'].includes(env.ENVIRONMENT))
      return { outcome: 'final', reason: 'mock_forbidden' };
    const behavior = await stmt(
      env.DB,
      'SELECT outcome FROM mock_behavior WHERE channel=?',
      job.channel,
    ).first<Row>();
    if (behavior && behavior.outcome !== 'ok')
      return { outcome: behavior.outcome, reason: 'mock_' + behavior.outcome };
    const provider_id = 'mock_' + job.id;
    await stmt(
      env.DB,
      'INSERT OR IGNORE INTO mock_deliveries VALUES (?,?,?,?,?)',
      provider_id,
      job.id,
      job.channel,
      job.payload_cipher,
      now(),
    ).run();
    if (job.kind === 'magic_link')
      await stmt(
        env.DB,
        'INSERT OR IGNORE INTO mock_mail VALUES (?,?,?,?)',
        job.id,
        payload.recipient,
        payload.token,
        now(),
      ).run();
    return { outcome: 'accepted', provider_id };
  }
  let config: Row = {};
  if (job.kind !== 'magic_link') {
    const connection = await stmt(
      env.DB,
      'SELECT * FROM tenant_provider_connections WHERE tenant_id=? AND channel=?',
      job.tenant_id,
      job.channel,
    ).first<Row>();
    if (!connection?.enabled || !env.PROVIDER_KEK)
      return { outcome: 'retryable', reason: 'provider_disabled' };
    config = await unsealProvider(env, connection.config_cipher);
  }
  if (!payload.recipient) return { outcome: 'final', reason: 'recipient_missing' };
  const text = messageText(job, payload);
  let url: string, headers: Record<string, string>, body: Row;
  if (job.channel === 'email') {
    if (selected !== 'resend' || !env.RESEND_API_KEY || !env.EMAIL_FROM)
      return { outcome: 'retryable', reason: 'provider_disabled' };
    url = 'https://api.resend.com/emails';
    headers = {
      Authorization: 'Bearer ' + env.RESEND_API_KEY,
      'Content-Type': 'application/json',
      'Idempotency-Key': job.id,
    };
    body = {
      from: env.EMAIL_FROM,
      to: [payload.recipient],
      subject: 'SalonOS — ' + (job.kind === 'magic_link' ? 'Connexion' : 'Votre commerce'),
      text,
    };
  } else {
    const template = config.templates?.[job.kind];
    if (
      selected !== 'meta' ||
      !config.access_token ||
      !config.phone_number_id ||
      !config.api_version ||
      !template
    )
      return { outcome: 'retryable', reason: 'template_or_provider_disabled' };
    url = `https://graph.facebook.com/${config.api_version}/${config.phone_number_id}/messages`;
    headers = {
      Authorization: 'Bearer ' + config.access_token,
      'Content-Type': 'application/json',
    };
    body = {
      messaging_product: 'whatsapp',
      to: payload.recipient.replace('+', ''),
      type: 'template',
      biz_opaque_callback_data: job.id,
      template: {
        name: template,
        language: { code: config.language || 'fr' },
        components: [{ type: 'body', parameters: [{ type: 'text', text }] }],
      },
    };
  }
  try {
    const response = await request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      if (response.status === 429) return { outcome: 'retryable', reason: 'rate_limited' };
      if (response.status >= 500)
        return {
          outcome: job.channel === 'email' ? 'retryable' : 'uncertain',
          reason: 'provider_5xx',
        };
      return { outcome: 'final', reason: 'provider_' + response.status };
    }
    const result = (await response.json()) as Row;
    const provider_id = job.channel === 'email' ? result.id : result.messages?.[0]?.id;
    return typeof provider_id === 'string'
      ? { outcome: 'accepted', provider_id }
      : { outcome: 'uncertain', reason: 'missing_provider_id' };
  } catch {
    return {
      outcome: job.channel === 'email' ? 'retryable' : 'uncertain',
      reason: 'network_timeout',
    };
  }
}
