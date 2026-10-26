import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('deployment requires explicit private-review config; local defaults cannot deploy implicitly', () => {
  assert.equal(existsSync('wrangler.toml'), false);
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.match(pkg.scripts['db:local'], /--config wrangler\.local\.toml/);

  const local = readFileSync('wrangler.local.toml', 'utf8');
  assert.match(local, /LOCAL DEVELOPMENT ONLY/);
  assert.match(local, /ENVIRONMENT\s*=\s*"development"/);
  assert.match(local, /localhost/);

  const review = readFileSync('wrangler.private-review.example.toml', 'utf8');
  assert.match(review, /workers_dev\s*=\s*false/);
  assert.match(review, /ENVIRONMENT\s*=\s*"production"/);
  assert.match(review, /EMAIL_PROVIDER\s*=\s*"disabled"/);
  assert.match(review, /WHATSAPP_PROVIDER\s*=\s*"disabled"/);
  assert.match(review, /CHANGE_ME_ISOLATED_D1_ID/);
  assert.match(review, /CHANGE_ME_REVIEW_HOST/);
});
