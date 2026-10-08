import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('handoff has a safe bootstrap and milestone instructions', () => {
 const api=fs.readFileSync('src/index.ts','utf8');
 const mission=fs.readFileSync('docs/CODEX_MISSION.md','utf8');
 assert.match(api, /not_implemented/);
 assert.match(mission, /M6/);
 assert.doesNotMatch(api, /api\/reset|api\/state/);
});
