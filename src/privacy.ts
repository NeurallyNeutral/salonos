import { Env, Row, stmt, rows, now, token, hash, seal, audit, id } from './core';
export async function eraseCustomer(
  env: Env,
  tenantId: string,
  customerId: string,
  actor: string,
  retentionOnly = false,
) {
  const db = env.DB,
    empty = await seal(env.APP_SECRET, {}),
    revoked = await hash(token());
  const guard = id();
  try {
    await db.batch([
      ...(retentionOnly
        ? [
            stmt(
              db,
              'INSERT INTO retention_guards VALUES (?,?,?,?)',
              guard,
              tenantId,
              customerId,
              now(),
            ),
          ]
        : []),
      stmt(
        db,
        "DELETE FROM booking_claims WHERE tenant_id=? AND booking_id IN (SELECT id FROM bookings WHERE tenant_id=? AND customer_id=? AND status='confirmed')",
        tenantId,
        tenantId,
        customerId,
      ),
      stmt(
        db,
        "UPDATE bookings SET contact_email=NULL,manage_hash=?,manage_expires=0,response_cipher='',revision=revision+1,status=CASE WHEN status='confirmed' THEN 'cancelled' ELSE status END,consent_email=0,consent_whatsapp=0,consent_marketing=0 WHERE tenant_id=? AND customer_id=?",
        revoked,
        tenantId,
        customerId,
      ),
      stmt(
        db,
        "UPDATE notification_outbox SET payload_cipher=?,state=CASE WHEN state IN ('pending','leased','failed_retryable') THEN 'suppressed' ELSE state END,reason='privacy_erasure' WHERE tenant_id=? AND customer_id=?",
        empty,
        tenantId,
        customerId,
      ),
      stmt(
        db,
        'UPDATE mock_deliveries SET payload_cipher=? WHERE outbox_id IN (SELECT id FROM notification_outbox WHERE tenant_id=? AND customer_id=?)',
        empty,
        tenantId,
        customerId,
      ),
      stmt(
        db,
        "UPDATE customers SET name='Client anonymisé',phone='deleted:'||id,email=NULL,suppressed=1,unsubscribe_hash=NULL,unsubscribe_cipher=NULL WHERE tenant_id=? AND id=?",
        tenantId,
        customerId,
      ),
      audit(db, tenantId, actor, 'customer_anonymized', customerId),
      stmt(
        db,
        "UPDATE inquiries SET note='',variant='',consent_contact=1,consent_marketing=0,status=CASE WHEN status IN ('new','contacted') THEN 'cancelled' ELSE status END WHERE tenant_id=? AND customer_id=?",
        tenantId,
        customerId,
      ),
      ...(retentionOnly ? [stmt(db, 'DELETE FROM retention_guards WHERE id=?', guard)] : []),
    ]);
    return true;
  } catch (error) {
    if (retentionOnly && String(error).includes('customer_recently_active')) return false;
    throw error;
  }
}
export async function retentionSweep(env: Env, tenantId: string | null = null) {
  const customers = await rows(
    env.DB,
    "SELECT c.id,c.tenant_id FROM customers c JOIN tenants t ON t.id=c.tenant_id WHERE t.retention_days>0 AND c.phone NOT LIKE 'deleted:%' AND (? IS NULL OR t.id=?) AND MAX(c.created_at,COALESCE((SELECT MAX(b.ends_at) FROM bookings b WHERE b.tenant_id=c.tenant_id AND b.customer_id=c.id),0),COALESCE((SELECT MAX(MAX(i.created_at,COALESCE(i.fulfilled_at,0))) FROM inquiries i WHERE i.tenant_id=c.tenant_id AND i.customer_id=c.id),0))<?-t.retention_days*86400000 LIMIT 25",
    tenantId,
    tenantId,
    now(),
  );
  let count = 0;
  for (const c of customers)
    if (await eraseCustomer(env, c.tenant_id, c.id, 'retention_job', true)) count++;
  return count;
}
export async function cleanupOperationalData(env: Env) {
  const db = env.DB;
  await db.batch([
    stmt(db, 'DELETE FROM sessions WHERE expires_at<?', now()),
    stmt(
      db,
      'DELETE FROM magic_links WHERE expires_at<? AND hash NOT IN (SELECT magic_hash FROM sessions)',
      now() - 86400000,
    ),
    stmt(db, 'DELETE FROM mock_mail WHERE created_at<?', now() - 86400000),
    stmt(db, 'DELETE FROM rate_limits WHERE expires_at<?', now()),
    stmt(db, 'DELETE FROM prospect_previews WHERE expires_at<?', now()),
    stmt(
      db,
      "UPDATE signup_challenges SET email='expired:'||hash WHERE expires_at<?",
      now() - 86400000,
    ),
    stmt(
      db,
      'UPDATE signup_deliveries SET payload_cipher=? WHERE challenge_hash IN (SELECT hash FROM signup_challenges WHERE expires_at<?)',
      await seal(env.APP_SECRET, {}),
      now() - 86400000,
    ),
  ]);
}
