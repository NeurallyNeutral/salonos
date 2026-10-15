import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { importLeads, scoreLead, validateLead } from '../scripts/discovery.mjs';
const candidate = {
  source_url: 'https://example.invalid/fiction',
  source_type: 'synthetic',
  business_display_name: 'Commerce imaginaire',
  booking_mode: 'appointments',
  source_terms: 'Synthetic fixture; no outbound authorization',
  first_seen_at: '2026-10-15',
  discovered_at: '2026-10-15',
  currently_has_website_or_booking_link: false,
};
test('V2-F separate discovery deduplicates, explains scores, preserves suppression and never infers launch or sales from followers', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const first = scoreLead(candidate, Date.parse('2026-10-15'));
    assert.equal(validateLead(candidate).launch_confidence, 'unverified');
    assert.deepEqual(scoreLead({ ...candidate, followers: 1 }, Date.parse('2026-10-15')), first);
    assert.deepEqual(
      scoreLead({ ...candidate, followers: 100000 }, Date.parse('2026-10-15')),
      first,
    );
    let report = importLeads(db, [
      candidate,
      { ...candidate, source_url: 'https://www.example.invalid/fiction/?utm_source=x#fragment' },
    ]);
    assert.equal(report.length, 1);
    assert.equal(report[0].outreach_status, 'human_review_required');
    importLeads(db, [{ ...candidate, suppression_reason: 'Opted out' }]);
    assert.equal(importLeads(db, [candidate]).length, 0);
    assert.throws(() => validateLead({ ...candidate, source_url: 'javascript:alert(1)' }));
    assert.throws(() => validateLead({ ...candidate, source_type: 'scraped_instagram' }));
    assert.throws(() => validateLead({ ...candidate, source_type: 'consented_referral' }));
    assert.throws(() => importLeads(db, [candidate, { ...candidate, source_type: 'unknown' }]));
    assert.equal(db.prepare('SELECT COUNT(*) n FROM discovery_leads').get().n, 1);
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='customers'").get().n,
      0,
    );
  } finally {
    db.close();
  }
});
