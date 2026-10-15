import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const types = [
  'business_submission',
  'consented_referral',
  'public_search',
  'directory',
  'authorized_official_api',
  'synthetic',
];
export function canonical(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port)
    throw Error('Invalid public business URL');
  url.hash = '';
  url.search = '';
  url.hostname = url.hostname.replace(/^www\./, '');
  url.pathname = url.pathname.replace(/\/$/, '') || '/';
  return url.href;
}
export function validateLead(input) {
  const lead = { ...input };
  if (
    !types.includes(lead.source_type) ||
    typeof lead.business_display_name !== 'string' ||
    lead.business_display_name.length > 100 ||
    /[<>]/.test(lead.business_display_name)
  )
    throw Error('Invalid lead');
  if (!['appointments', 'catalog_inquiry'].includes(lead.booking_mode)) throw Error('Invalid mode');
  if (!lead.source_terms || lead.source_terms.length > 500) throw Error('Source terms required');
  if (lead.source_type === 'consented_referral' && !lead.consent_evidence)
    throw Error('Referral consent required');
  if (lead.source_type === 'authorized_official_api' && !lead.authorization_evidence)
    throw Error('Official API authorization required');
  lead.source_url = canonical(lead.source_url);
  if (lead.website_or_instagram_url)
    lead.website_or_instagram_url = canonical(lead.website_or_instagram_url);
  if (lead.launch_evidence_url) lead.launch_evidence_url = canonical(lead.launch_evidence_url);
  for (const key of ['discovered_at', 'first_seen_at', 'launch_evidence_date'])
    if (lead[key] && !Number.isFinite(Date.parse(lead[key]))) throw Error('Invalid evidence date');
  if (lead.suppression_reason) lead.outreach_status = 'suppressed';
  else lead.outreach_status = 'human_review_required';
  lead.human_verification = lead.human_verification === true;
  lead.launch_confidence =
    lead.launch_evidence_url && lead.launch_evidence_date && lead.human_verification
      ? 'evidence_recorded'
      : 'unverified';
  return lead;
}
export function scoreLead(input, at = Date.now()) {
  const l = validateLead(input),
    rationale = [];
  let score = 0;
  const days = l.launch_evidence_date
    ? (at - Date.parse(l.launch_evidence_date)) / 86400000
    : Infinity;
  if (l.suppression_reason) return { score: 0, rationale: ['Suppressed; no outreach permitted'] };
  if (l.human_verification && l.launch_evidence_url && days >= 0 && days <= 90) {
    score += 35;
    rationale.push('Human-checked launch evidence within 90 days');
  }
  if (l.booking_mode === 'appointments') {
    score += 20;
    rationale.push('Appointment workflow matches launch product');
  } else if (l.catalog_quote_fit === true) {
    score += 15;
    rationale.push('Catalog inquiry fit explicitly recorded');
  }
  if (l.currently_has_website_or_booking_link === false) {
    score += 15;
    rationale.push('No current booking/site link recorded');
  }
  if (l.multiple_services === true) {
    score += 10;
    rationale.push('Multiple service offering recorded');
  }
  if (l.inquiry_pressure_evidence) {
    score += 10;
    rationale.push('Inquiry pressure rationale supplied; not measured revenue');
  }
  if (l.permitted_contact === true) {
    score += 10;
    rationale.push('Appropriately permitted business contact recorded');
  }
  rationale.push('Follower count and first-seen date do not prove launch date or sales');
  return { score, rationale };
}
export function importLeads(db, inputs, at = Date.now()) {
  if (!Array.isArray(inputs) || inputs.length > 1000)
    throw Error('Batch must have at most 1000 candidates');
  const leads = inputs.map(validateLead);
  db.exec(
    'CREATE TABLE IF NOT EXISTS discovery_leads(source_url TEXT PRIMARY KEY,record TEXT NOT NULL,score INTEGER NOT NULL,rationale TEXT NOT NULL,suppressed INTEGER NOT NULL)',
  );
  db.exec('BEGIN IMMEDIATE');
  try {
    const upsert = db.prepare(
      'INSERT INTO discovery_leads VALUES (?,?,?,?,?) ON CONFLICT(source_url) DO UPDATE SET record=CASE WHEN discovery_leads.suppressed=1 THEN discovery_leads.record ELSE excluded.record END,score=CASE WHEN discovery_leads.suppressed=1 THEN 0 ELSE excluded.score END,rationale=CASE WHEN discovery_leads.suppressed=1 THEN discovery_leads.rationale ELSE excluded.rationale END,suppressed=MAX(discovery_leads.suppressed,excluded.suppressed)',
    );
    for (const lead of leads) {
      const scored = scoreLead(lead, at);
      upsert.run(
        lead.source_url,
        JSON.stringify(lead),
        scored.score,
        JSON.stringify(scored.rationale),
        Number(!!lead.suppression_reason),
      );
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return db
    .prepare(
      'SELECT record,score,rationale FROM discovery_leads WHERE suppressed=0 ORDER BY score DESC,source_url LIMIT 10',
    )
    .all()
    .map((r) => ({
      ...JSON.parse(r.record),
      score: r.score,
      rationale: JSON.parse(r.rationale),
      outreach_suggestion: 'Human review only. No send authorized.',
      template: r.record.includes('"booking_mode":"appointments"') ? 'appointments' : 'boutique',
    }));
}
async function run() {
  const file = process.argv.indexOf('--file'),
    synthetic = file === -1;
  if (!synthetic && !process.argv.includes('--authorized-source'))
    throw Error('Owner must explicitly authorize imported source data with --authorized-source');
  const path = synthetic ? 'fixtures/discovery-synthetic.json' : process.argv[file + 1];
  const inputs = JSON.parse(await readFile(path, 'utf8'));
  if (synthetic && inputs.some((l) => l.source_type !== 'synthetic'))
    throw Error('Dry run accepts synthetic fixtures only');
  await mkdir('.wrangler/discovery', { recursive: true });
  await mkdir('artifacts', { recursive: true });
  const db = new DatabaseSync(synthetic ? ':memory:' : '.wrangler/discovery/authorized.sqlite');
  try {
    const leads = importLeads(db, inputs),
      report = {
        mode: synthetic ? 'SYNTHETIC_DRY_RUN' : 'AUTHORIZED_IMPORT',
        network_requests: 0,
        messages_sent: 0,
        merchants_activated: 0,
        qualified_claim: 'ranked candidates, not verified sales opportunities',
        leads,
      };
    await writeFile('artifacts/discovery-report.json', JSON.stringify(report, null, 2));
    console.log(
      JSON.stringify({
        mode: report.mode,
        candidates: inputs.length,
        shortlist: leads.length,
        messages_sent: 0,
        report: 'artifacts/discovery-report.json',
      }),
    );
  } finally {
    db.close();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await run();
