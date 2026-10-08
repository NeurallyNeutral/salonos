import { Env, rows, stmt, seal, unsealApp, unsealProvider, audit } from './core';
// Operator-only maintenance entry point, deliberately not mounted as an HTTP route.
// Both old and new keys must be present during the pass. Compare-and-set prevents
// concurrent privacy erasure from being overwritten with re-encrypted old PII.
export async function reencryptStoredKeys(env: Env) {
  let changed = 0;
  for (const { table, column } of [
    { table: 'notification_outbox', column: 'payload_cipher' },
    { table: 'mock_deliveries', column: 'payload_cipher' },
    { table: 'bookings', column: 'response_cipher' },
    { table: 'customers', column: 'unsubscribe_cipher' },
  ]) {
    let cursor = '';
    for (;;) {
      const batch = await rows(
        env.DB,
        `SELECT id,${column} value FROM ${table} WHERE id>? ORDER BY id LIMIT 100`,
        cursor,
      );
      if (!batch.length) break;
      for (const row of batch) {
        cursor = row.id;
        if (!row.value) continue;
        const value = await seal(env.APP_SECRET, await unsealApp(env, row.value));
        const result = await stmt(
          env.DB,
          `UPDATE ${table} SET ${column}=? WHERE id=? AND ${column}=?`,
          value,
          row.id,
          row.value,
        ).run();
        changed += result.meta.changes;
      }
    }
  }
  if (env.PROVIDER_KEK) {
    for (const connection of await rows(env.DB, 'SELECT * FROM tenant_provider_connections')) {
      const value = await seal(
        env.PROVIDER_KEK,
        await unsealProvider(env, connection.config_cipher),
      );
      await stmt(
        env.DB,
        'UPDATE tenant_provider_connections SET config_cipher=? WHERE tenant_id=? AND channel=? AND config_cipher=?',
        value,
        connection.tenant_id,
        connection.channel,
        connection.config_cipher,
      ).run();
    }
  }
  for (const tenant of await rows(env.DB, 'SELECT id FROM tenants'))
    await audit(env.DB, tenant.id, 'authenticated_operator', 'stored_keys_reencrypted').run();
  return { reencrypted_records: changed };
}
