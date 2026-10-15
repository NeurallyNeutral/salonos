import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { runtime } from './runtime.mjs';
import { client } from '../tests/helpers.mjs';
const key = () => randomUUID().replaceAll('-', ''),
  persist = '.wrangler/v2-scenario/' + randomUUID(),
  secret = randomUUID() + randomUUID();
let run = await runtime({ persist, secret });
const samples = [],
  slugs = [];
try {
  for (let i = 0; i < 5; i++) {
    const started = performance.now(),
      api = client(run.mf, { 'CF-Connecting-IP': 'synthetic-' + i }),
      email = 'automated-' + i + '@example.invalid',
      mode = i % 2 ? 'appointments' : 'catalog_inquiry',
      slug = 'synthetic-' + i;
    assert.equal((await api('/signup-api/request', { email })).status, 200);
    await api('/dev/process', {});
    const { token } = await run.db
      .prepare('SELECT token FROM mock_mail WHERE recipient=?')
      .bind(email)
      .first();
    const verified = await api('/signup-api/consume', { token });
    assert.equal(verified.status, 200);
    const cookie = verified.headers.get('set-cookie').split(';')[0],
      session = await client(run.mf, { Cookie: cookie })('/merchant/session'),
      merchant = client(run.mf, { Cookie: cookie, 'X-CSRF-Token': session.data.csrf });
    const launch = (await merchant('/merchant/launch')).data;
    assert.equal(
      (
        await merchant(
          '/merchant/launch',
          {
            revision: launch.revision,
            name: 'Commerce synthétique ' + i,
            slug,
            business_mode: mode,
            template: mode === 'appointments' ? 'studio' : 'boutique',
            palette: i % 2 ? 'forest' : 'clay',
            contact_phone: '+212600000000',
            locality: 'Rabat · Fiction',
            headline: 'Votre lancement',
            policy_text: 'Démo synthétique, aucune vente réelle.',
          },
          'PUT',
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await merchant(
          '/merchant/launch/offer',
          {
            name: 'Offre synthétique',
            price_centimes: 12000,
            duration_min: 30,
            start_min: 540,
            end_min: 1080,
          },
          'POST',
          { 'Idempotency-Key': key() },
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await merchant(
          '/merchant/launch/publish',
          { confirm_ownership: true, confirm_policies: true },
          'POST',
          { 'Idempotency-Key': key() },
        )
      ).status,
      200,
    );
    const store = (await api('/storefront/' + slug)).data;
    assert.equal(store.whatsapp_url, 'https://wa.me/212600000000');
    assert.ok(
      (await merchant('/merchant/connectors')).data.connectors.every(
        (c) => !c.live_provider_verified,
      ),
    );
    if (mode === 'catalog_inquiry') {
      assert.equal(
        (
          await api(
            '/storefront/' + slug + '/inquiries',
            {
              item_id: store.items[0].id,
              name: 'Client fictif ' + i,
              phone: '+21260000007' + i,
              consent_contact: true,
              source: 'instagram',
            },
            'POST',
            { 'Idempotency-Key': key() },
          )
        ).status,
        201,
      );
      assert.equal((await merchant('/merchant/inquiries')).data.inquiries.length, 1);
    }
    samples.push({
      merchant: i + 1,
      mode,
      automated_setup_ms: Math.round(performance.now() - started),
      founder_actions_in_script: 0,
    });
    slugs.push(slug);
  }
  await run.mf.dispose();
  run = await runtime({ persist, secret, seed: false });
  for (const slug of slugs) assert.equal((await client(run.mf)('/storefront/' + slug)).status, 200);
  const sorted = samples.map((s) => s.automated_setup_ms).sort((a, b) => a - b);
  await mkdir('artifacts', { recursive: true });
  const report = {
    result: 'PASS',
    scope: 'five AUTOMATED synthetic merchants; not independent human usability evidence',
    samples,
    automated_median_ms: sorted[2],
    human_median_setup_minutes: null,
    human_trials: 'BLOCKED — owner must recruit five first-time humans',
    restart_persistence: 'PASS',
    live_messages: 0,
    external_deployments: 0,
  };
  await writeFile('artifacts/v2-onboarding.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await run.mf.dispose();
}
