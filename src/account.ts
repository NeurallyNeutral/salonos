import { merchant } from './auth';
import { Env, Row, stmt, rows, owner, id, now, hash, seal, fail, audit } from './core';
import { eraseCustomer } from './privacy';
merchant.get('/account/export', async (c) => {
  const m = owner(c),
    db = c.env.DB,
    result: Row = {
      exported_at: now(),
      payment_verification: 'merchant_reported',
      processor_verified_value: null,
    };
  for (const [table, columns] of Object.entries({
    tenants:
      'id,slug,name,timezone,business_mode,storefront_status,template,palette,headline,description,contact_phone,locality,policy_text,loyalty_bps,review_url,is_demo,first_published_at',
    services: 'id,name,duration_min,buffer_min,price_centimes,active',
    resources: 'id,name,active',
    weekly_hours: 'resource_id,weekday,start_min,end_min',
    customers: 'id,name,phone,email,suppressed,created_at',
    bookings:
      'id,customer_id,service_id,resource_id,starts_at,ends_at,status,source,price_centimes,created_at',
    catalog_items: 'id,name,description,variant,price_centimes,availability,active',
    inquiries:
      'id,item_id,customer_id,variant,quantity,price_centimes,note,source,status,consent_contact,consent_marketing,created_at,fulfilled_at',
    payment_records:
      'id,booking_id,customer_id,amount_centimes,redeemed_centimes,earned_centimes,verification,created_at',
    refund_records: 'id,payment_id,cash_centimes,credit_centimes,reason,created_at',
    commerce_payments:
      'id,inquiry_id,customer_id,amount_centimes,redeemed_centimes,earned_centimes,verification,created_at',
    commerce_refunds: 'id,payment_id,cash_centimes,credit_centimes,reason,created_at',
    loyalty_ledger: 'id,customer_id,kind,amount_centimes,reference_id,expires_at,created_at',
    launch_events: 'kind,created_at',
    notification_outbox: 'id,kind,channel,state,accepted_at,delivered_at,created_at',
  }))
    result[table] = await rows(
      db,
      'SELECT ' +
        columns +
        ' FROM ' +
        table +
        ' WHERE ' +
        (table === 'tenants' ? 'id' : 'tenant_id') +
        '=?',
      m.tenant_id,
    );
  await audit(db, m.tenant_id, m.id, 'tenant_export').run();
  c.header('Content-Disposition', 'attachment; filename="salonos-commerce.json"');
  return c.json(result);
});
merchant.post('/account/delete', async (c) => {
  const m = owner(c),
    b = await c.req.json<Row>();
  if (b.confirm_delete !== true) fail(400, 'deletion_confirmation_required');
  await c.env.DB.batch([
    stmt(
      c.env.DB,
      "INSERT OR IGNORE INTO account_deletions VALUES (?,'pending',?)",
      m.tenant_id,
      now(),
    ),
    stmt(
      c.env.DB,
      "UPDATE tenants SET active=0,storefront_status='unpublished',paused=1,marketing_enabled=0,reminders_enabled=0,revision=revision+1 WHERE id=?",
      m.tenant_id,
    ),
    stmt(
      c.env.DB,
      'DELETE FROM sessions WHERE user_id IN (SELECT id FROM merchant_users WHERE tenant_id=?)',
      m.tenant_id,
    ),
    stmt(c.env.DB, 'DELETE FROM prospect_previews WHERE tenant_id=?', m.tenant_id),
    stmt(
      c.env.DB,
      "UPDATE tenant_provider_connections SET enabled=0,config_cipher='' WHERE tenant_id=?",
      m.tenant_id,
    ),
    stmt(
      c.env.DB,
      "UPDATE notification_outbox SET state='suppressed',reason='account_deleted' WHERE tenant_id=? AND state IN ('pending','leased','failed_retryable')",
      m.tenant_id,
    ),
    audit(c.env.DB, m.tenant_id, m.id, 'account_deletion_requested'),
  ]);
  try {
    await finishAccountDeletions(c.env, m.tenant_id);
  } catch {
    console.error(JSON.stringify({ event: 'account_deletion_pending_retry' }));
  }
  const status = await stmt(
    c.env.DB,
    'SELECT state FROM account_deletions WHERE tenant_id=?',
    m.tenant_id,
  ).first<Row>();
  return c.json(
    {
      state: status!.state,
      financial_history: 'anonymized records retained under applicable retention policy',
    },
    202,
  );
});
export async function finishAccountDeletions(env: Env, tenant: string | null = null) {
  const jobs = await rows(
    env.DB,
    "SELECT tenant_id FROM account_deletions WHERE state='pending' AND (? IS NULL OR tenant_id=?) LIMIT 5",
    tenant,
    tenant,
  );
  for (const job of jobs) {
    const tid = job.tenant_id,
      customers = await rows(
        env.DB,
        "SELECT id FROM customers WHERE tenant_id=? AND phone NOT LIKE 'deleted:%' LIMIT 100",
        tid,
      );
    for (const c of customers) await eraseCustomer(env, tid, c.id, 'account_deletion_job');
    if (
      (await stmt(
        env.DB,
        "SELECT COUNT(*) n FROM customers WHERE tenant_id=? AND phone NOT LIKE 'deleted:%'",
        tid,
      ).first<Row>())!.n
    )
      continue;
    const assets = await rows(
      env.DB,
      'SELECT object_key FROM merchant_assets WHERE tenant_id=?',
      tid,
    );
    if (assets.length && !env.MEDIA) continue;
    for (const a of assets) await env.MEDIA!.delete(a.object_key);
    await env.DB.batch([
      stmt(env.DB, 'DELETE FROM catalog_item_assets WHERE tenant_id=?', tid),
      stmt(env.DB, 'DELETE FROM merchant_assets WHERE tenant_id=?', tid),
      stmt(
        env.DB,
        "UPDATE merchant_users SET email='deleted:'||id||'@example.invalid',active=0 WHERE tenant_id=?",
        tid,
      ),
      stmt(
        env.DB,
        "UPDATE tenants SET name='Commerce supprimé',slug=?,description='',headline='',contact_phone=NULL,locality='',policy_text='',logo_url=NULL,review_url=NULL WHERE id=?",
        'deleted-' + tid,
        tid,
      ),
      stmt(
        env.DB,
        'UPDATE signup_deliveries SET payload_cipher=? WHERE challenge_hash IN (SELECT challenge_hash FROM provision_claims WHERE tenant_id=?)',
        await seal(env.APP_SECRET, {}),
        tid,
      ),
      stmt(
        env.DB,
        "UPDATE signup_challenges SET email='deleted:'||hash WHERE hash IN (SELECT challenge_hash FROM provision_claims WHERE tenant_id=?)",
        tid,
      ),
      stmt(env.DB, "UPDATE account_deletions SET state='completed' WHERE tenant_id=?", tid),
      audit(env.DB, tid, 'account_deletion_job', 'account_anonymized'),
    ]);
  }
}
merchant.post('/launch/previews/revoke', async (c) => {
  const m = owner(c);
  await c.env.DB.batch([
    stmt(c.env.DB, 'DELETE FROM prospect_previews WHERE tenant_id=?', m.tenant_id),
    audit(c.env.DB, m.tenant_id, m.id, 'previews_revoked'),
  ]);
  return c.json({ ok: true });
});
