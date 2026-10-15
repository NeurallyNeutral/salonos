import { merchant } from './auth';
import { Env, Row, stmt, rows, owner, local, fail, now, audit } from './core';
import { choice } from './storefront';
export const connectorCapabilities = {
  email: { purpose: 'email_notifications', automatic: true },
  whatsapp: { purpose: 'official_meta_whatsapp_templates', automatic: true },
  instagram: { purpose: 'instagram_dm', automatic: false, implementation: 'DEFERRED' },
} as const;
export async function connectorReadiness(env: Env, tenant: string) {
  const connections = await rows(
    env.DB,
    'SELECT channel,enabled,updated_at FROM tenant_provider_connections WHERE tenant_id=?',
    tenant,
  );
  const checks = await rows(
    env.DB,
    'SELECT channel,state,checked_at FROM connector_checks WHERE tenant_id=?',
    tenant,
  );
  return Promise.all(
    Object.entries(connectorCapabilities).map(async ([channel, capability]) => {
      const connection = connections.find((r) => r.channel === channel),
        check = checks.find((r) => r.channel === channel);
      const selected =
        channel === 'email'
          ? env.EMAIL_PROVIDER
          : channel === 'whatsapp'
            ? env.WHATSAPP_PROVIDER
            : null;
      const live =
        channel === 'email'
          ? selected === 'resend' && !!env.RESEND_API_KEY && !!env.EMAIL_FROM
          : selected === 'meta' && !!env.PROVIDER_KEK;
      const receipt =
        connection?.enabled && live
          ? await stmt(
              env.DB,
              "SELECT delivered_at FROM notification_outbox WHERE tenant_id=? AND channel=? AND state='delivered' AND provider_id NOT LIKE 'mock_%' AND delivered_at>=? ORDER BY delivered_at DESC LIMIT 1",
              tenant,
              channel,
              connection.updated_at,
            ).first<Row>()
          : null;
      const failed = await stmt(
        env.DB,
        "SELECT reason FROM notification_outbox WHERE tenant_id=? AND channel=? AND state IN ('failed_final','uncertain') AND created_at>=? LIMIT 1",
        tenant,
        channel,
        connection?.updated_at ?? now(),
      ).first<Row>();
      const state =
        channel === 'instagram'
          ? 'DISCONNECTED'
          : receipt
            ? 'CONNECTED'
            : connection?.enabled
              ? failed
                ? 'ERROR'
                : 'TESTING'
              : (check?.state ?? 'DISCONNECTED');
      return {
        channel,
        ...capability,
        state,
        live_provider_verified: !!receipt,
        delivered_at: receipt?.delivered_at ?? null,
        automatic_sends_available: !!receipt && capability.automatic,
        next_steps:
          channel === 'instagram'
            ? [
                'Integration deferred',
                'Owner-approved official permissions and scoped webhook design required',
              ]
            : channel === 'whatsapp'
              ? [
                  'Official Meta account/number onboarding',
                  'Approved templates, consent and merchant billing',
                  'Signed delivered receipt after current connection',
                ]
              : [
                  'Verified sender/domain',
                  'Explicit merchant connection and recipient consent',
                  'Signed delivered receipt after current connection',
                ],
        customer_initiated_link: channel === 'whatsapp',
      };
    }),
  );
}
merchant.get('/connectors', async (c) =>
  c.json({
    connectors: await connectorReadiness(c.env, c.get('merchant').tenant_id),
    openreply: 'DEFERRED — Instagram only, no runtime installed',
  }),
);
merchant.post('/connectors/:channel/mock-check', async (c) => {
  const m = owner(c),
    channel = choice(c.req.param('channel'), ['email', 'whatsapp', 'instagram']);
  if (!local(c)) fail(404, 'not_found');
  await c.env.DB.batch([
    stmt(
      c.env.DB,
      "INSERT INTO connector_checks VALUES (?,?,'TESTING',?) ON CONFLICT(tenant_id,channel) DO UPDATE SET state='TESTING',checked_at=excluded.checked_at",
      m.tenant_id,
      channel,
      now(),
    ),
    audit(c.env.DB, m.tenant_id, m.id, 'connector_fixture_checked', channel),
  ]);
  return c.json({
    state: 'TESTING',
    fixture_only: true,
    live_provider_verified: false,
    messages_sent: 0,
  });
});
merchant.post('/connectors/:channel/disconnect', async (c) => {
  const m = owner(c),
    channel = choice(c.req.param('channel'), ['email', 'whatsapp', 'instagram']);
  await c.env.DB.batch([
    stmt(
      c.env.DB,
      "UPDATE tenant_provider_connections SET enabled=0,config_cipher='',updated_at=? WHERE tenant_id=? AND channel=?",
      now(),
      m.tenant_id,
      channel,
    ),
    stmt(
      c.env.DB,
      'DELETE FROM connector_checks WHERE tenant_id=? AND channel=?',
      m.tenant_id,
      channel,
    ),
    stmt(
      c.env.DB,
      "UPDATE notification_outbox SET state='suppressed',reason='connection_revoked' WHERE tenant_id=? AND channel=? AND kind!='magic_link' AND state IN ('pending','failed_retryable')",
      m.tenant_id,
      channel,
    ),
    audit(c.env.DB, m.tenant_id, m.id, 'connector_revoked', channel),
  ]);
  return c.json({ state: 'DISCONNECTED' });
});
