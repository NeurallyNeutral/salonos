import { merchant } from './auth';
import { Row, stmt, rows, owner, integer, id, now, audit, local, fail } from './core';
import { plain } from './storefront';
merchant.get('/launch-metrics', async (c) => {
  const tid = c.get('merchant').tenant_id,
    db = c.env.DB,
    t = await stmt(db, 'SELECT * FROM tenants WHERE id=?', tid).first<Row>();
  const inquiry = await stmt(
    db,
    "SELECT COUNT(*) inquiries,COALESCE(SUM(status='fulfilled'),0) fulfilled FROM inquiries WHERE tenant_id=?",
    tid,
  ).first<Row>();
  const commerce = await stmt(
    db,
    'SELECT COALESCE(SUM(amount_centimes),0) paid FROM commerce_payments WHERE tenant_id=?',
    tid,
  ).first<Row>();
  const refunds = await stmt(
    db,
    'SELECT COALESCE(SUM(cash_centimes),0) refunded FROM commerce_refunds WHERE tenant_id=?',
    tid,
  ).first<Row>();
  const sources = await rows(
    db,
    "SELECT source,COUNT(*) count,'booking' type FROM bookings WHERE tenant_id=? GROUP BY source UNION ALL SELECT source,COUNT(*) count,'inquiry' type FROM inquiries WHERE tenant_id=? GROUP BY source",
    tid,
    tid,
  );
  return c.json({
    dataset: t!.is_demo || local(c) ? 'synthetic' : 'live',
    events: await rows(
      db,
      'SELECT kind,COUNT(*) count,MIN(created_at) first_at FROM launch_events WHERE tenant_id=? GROUP BY kind',
      tid,
    ),
    setup_elapsed_ms:
      t!.first_published_at && t!.onboarding_started_at
        ? t!.first_published_at - t!.onboarding_started_at
        : null,
    setup_measurement:
      'elapsed time from email request, includes pauses; not a human usability trial',
    sources,
    ...inquiry,
    commerce_merchant_reported_paid_centimes: commerce!.paid,
    commerce_refunded_centimes: refunds!.refunded,
    processor_verified_value: null,
    attributable_new_customers: null,
    support: await stmt(
      db,
      'SELECT COUNT(*) recorded_interventions,COALESCE(SUM(minutes),0) recorded_minutes FROM support_interventions WHERE tenant_id=?',
      tid,
    ).first(),
    support_measurement: 'merchant-recorded interventions only; no inference of unreported support',
    repeat_customers: (await stmt(
      db,
      "SELECT COUNT(*) n FROM (SELECT customer_id FROM (SELECT customer_id FROM inquiries WHERE tenant_id=? AND status='fulfilled' UNION ALL SELECT customer_id FROM bookings WHERE tenant_id=? AND status='completed') GROUP BY customer_id HAVING COUNT(*)>1)",
      tid,
      tid,
    ).first<Row>())!.n,
  });
});
merchant.post('/retention-settings', async (c) => {
  const m = owner(c),
    b = await c.req.json<Row>(),
    rate = integer(b.loyalty_bps, 0, 200, 100);
  if (rate > 0 && b.understands_merchant_funded_terms !== true) fail(400, 'loyalty_terms_required');
  const review = b.review_url || null;
  if (review) {
    let url: URL;
    try {
      url = new URL(review);
    } catch {
      fail(400, 'invalid_review_url');
    }
    if (
      url!.protocol !== 'https:' ||
      url!.username ||
      url!.password ||
      !['g.page', 'search.google.com', 'www.google.com', 'maps.google.com'].includes(url!.hostname)
    )
      fail(400, 'invalid_review_url');
  }
  await c.env.DB.batch([
    stmt(
      c.env.DB,
      'UPDATE tenants SET loyalty_bps=?,loyalty_terms_accepted_at=CASE WHEN ?>0 THEN ? ELSE loyalty_terms_accepted_at END,review_url=?,reviews_enabled=1,revision=revision+1 WHERE id=?',
      rate,
      rate,
      now(),
      review,
      m.tenant_id,
    ),
    audit(c.env.DB, m.tenant_id, m.id, 'retention_terms_updated'),
  ]);
  return c.json({ ok: true, automatic_marketing: 'unchanged_requires_consent_and_connection' });
});
merchant.get('/inquiries/:id/review-prompt', async (c) => {
  const tid = c.get('merchant').tenant_id,
    t = await stmt(
      c.env.DB,
      'SELECT review_url,reviews_enabled,name FROM tenants WHERE id=?',
      tid,
    ).first<Row>(),
    i = await stmt(
      c.env.DB,
      'SELECT i.*,c.suppressed FROM inquiries i JOIN customers c ON c.tenant_id=i.tenant_id AND c.id=i.customer_id WHERE i.tenant_id=? AND i.id=?',
      tid,
      c.req.param('id'),
    ).first<Row>();
  if (!i) fail(404, 'not_found');
  const count = await stmt(
    c.env.DB,
    "SELECT COUNT(*) n FROM inquiries WHERE tenant_id=? AND customer_id=? AND status='fulfilled' AND id!=? AND fulfilled_at<=?",
    tid,
    i.customer_id,
    i.id,
    i.fulfilled_at ?? 0,
  ).first<Row>();
  const eligible = !!(
    t!.reviews_enabled &&
    t!.review_url &&
    i.status === 'fulfilled' &&
    !count!.n &&
    !i.suppressed
  );
  return c.json({
    eligible,
    automatic_send: false,
    contact_consent_required: true,
    text: eligible
      ? 'Merci pour votre visite chez ' +
        t!.name +
        '. Si vous souhaitez partager votre expérience honnête, vous pouvez laisser un avis ici : ' +
        t!.review_url +
        '. Tous les retours sont les bienvenus.'
      : null,
    policy: 'all eligible completed first visits; no satisfaction filter, reward or star request',
  });
});
merchant.post('/support-interventions', async (c) => {
  const m = owner(c),
    b = await c.req.json<Row>();
  await c.env.DB.batch([
    stmt(
      c.env.DB,
      'INSERT INTO support_interventions VALUES (?,?,?,?,?)',
      id(),
      m.tenant_id,
      integer(b.minutes, 0, 10080),
      plain(b.reason, 200),
      now(),
    ),
    audit(c.env.DB, m.tenant_id, m.id, 'support_intervention_recorded'),
  ]);
  return c.json({ ok: true }, 201);
});
merchant.get('/plan-usage', async (c) => {
  const tid = c.get('merchant').tenant_id,
    db = c.env.DB;
  return c.json({
    collection: 'disabled',
    subscription: await stmt(
      db,
      'SELECT s.*,p.display_name,p.monthly_price_centimes FROM tenant_subscription_status s LEFT JOIN plan_definitions p ON p.id=s.plan WHERE s.tenant_id=?',
      tid,
    ).first(),
    quotas: await rows(
      db,
      'SELECT q.feature,q.maximum FROM plan_quotas q JOIN tenant_subscription_status s ON s.plan=q.plan_id WHERE s.tenant_id=?',
      tid,
    ),
    usage: await stmt(
      db,
      'SELECT (SELECT COUNT(*) FROM catalog_items WHERE tenant_id=?) catalog_items,(SELECT COUNT(*) FROM services WHERE tenant_id=?) services,(SELECT COUNT(*) FROM merchant_assets WHERE tenant_id=?) assets,(SELECT COUNT(*) FROM notification_attempts a JOIN notification_outbox o ON o.id=a.outbox_id WHERE o.tenant_id=?) message_attempts',
      tid,
      tid,
      tid,
      tid,
    ).first(),
  });
});
