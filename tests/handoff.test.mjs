import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('clean implementation handoff preserves backend and removes competing design missions', () => {
  assert.match(fs.readFileSync('src/index.ts','utf8'), /app\.route\('\/merchant'/);
  assert.match(fs.readFileSync('spec/01_DESIGN_TOKENS.md','utf8'), /Instrument Serif/);
  assert.match(fs.readFileSync('spec/02_SCREEN_CONTRACTS.md','utf8'), /E-mail/);
  assert.match(fs.readFileSync('spec/03_STATE_AND_COPY.md','utf8'), /DEMO_BOOKING_CONFIRMED/);
  assert.equal(fs.existsSync('CODEX_START_PROMPT.txt'), false);
  assert.equal(fs.existsSync('docs/CODEX_MISSION.md'), false);
  assert.equal(fs.existsSync('reference/interactive_demo/index.html'), false);
  assert.equal(fs.existsSync('wrangler.toml'), false);
  assert.doesNotMatch(fs.readFileSync('src/index.ts','utf8'), /api\/reset|api\/state/);
});
