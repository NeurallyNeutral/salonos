import { createHash, randomBytes } from 'node:crypto';
// Explicitly synthetic, out-of-band fixtures. Never executed by deployed Worker code.
export async function demoFixtures(db) {
  for (const suffix of ['atlas', 'rivage']) {
    const bid = 'demo_past_' + suffix;
    if (await db.prepare('SELECT id FROM bookings WHERE id=?').bind(bid).first()) continue;
    const tid = 't_' + suffix,
      cid = 'demo_customer_' + suffix,
      tenant = await db.prepare('SELECT revision FROM tenants WHERE id=?').bind(tid).first();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      start = Date.parse(yesterday + 'T10:00:00Z'),
      end = start + 1200000;
    await db.batch([
      db
        .prepare(
          'INSERT OR IGNORE INTO customers(id,tenant_id,name,phone,email,created_at) VALUES (?,?,?,?,?,?)',
        )
        .bind(
          cid,
          tid,
          'Visite Démo ' + suffix,
          suffix === 'atlas' ? '+212600000101' : '+212600000102',
          suffix + '-client@example.invalid',
          Date.now(),
        ),
      db
        .prepare(
          "INSERT INTO bookings(id,tenant_id,customer_id,service_id,resource_id,starts_at,ends_at,occupied_until,price_centimes,source,manage_hash,manage_expires,config_revision,idempotency_key,request_hash,response_cipher,consent_email,consent_whatsapp,consent_marketing,consent_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,'manual',?,?,?,?,?,'',1,1,1,?,?)",
        )
        .bind(
          bid,
          tid,
          cid,
          's_' + suffix,
          'r_' + suffix,
          start,
          end,
          end,
          12000,
          createHash('sha256').update(randomBytes(32)).digest('hex'),
          Date.now(),
          tenant.revision,
          'fixture_' + suffix,
          'synthetic_fixture',
          Date.now(),
          Date.now(),
        ),
      db
        .prepare(
          'WITH RECURSIVE cells(t) AS (SELECT ? UNION ALL SELECT t+300000 FROM cells WHERE t+300000<?) INSERT INTO booking_claims SELECT ?,?,t,? FROM cells',
        )
        .bind(start, end, tid, 'r_' + suffix, bid),
    ]);
  }
}
