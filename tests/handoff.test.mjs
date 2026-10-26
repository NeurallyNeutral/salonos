import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('clean implementation handoff preserves backend and removes competing design missions', () => {
  const api = fs.readFileSync('src/index.ts', 'utf8');
  const design = fs.readFileSync('spec/01_DESIGN_TOKENS.md', 'utf8');
  const screens = fs.readFileSync('spec/02_SCREEN_CONTRACTS.md', 'utf8');
  const states = fs.readFileSync('spec/03_STATE_AND_COPY.md', 'utf8');

  assert.match(api, /app\.route\('\/merchant'/);
  assert.match(design, /Instrument Serif/);
  assert.match(screens, /E-mail/);
  assert.match(states, /DEMO_BOOKING_CONFIRMED/);
  assert.equal(fs.existsSync('CODEX_START_PROMPT.txt'), false);
  assert.equal(fs.existsSync('docs/CODEX_MISSION.md'), false);
  assert.equal(fs.existsSync('reference/interactive_demo/index.html'), false);
  assert.equal(fs.existsSync('wrangler.toml'), false);
  assert.doesNotMatch(api, /api\/reset|api\/state/);
});
