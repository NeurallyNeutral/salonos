import fs from 'node:fs';
import path from 'node:path';
const must = [
  'AGENTS.md',
  'docs/CODEX_MISSION.md',
  'docs/ARCHITECTURE.md',
  'docs/ACCEPTANCE_TESTS.md',
  'docs/LOYALTY_AND_REVIEWS.md',
  'docs/EXTERNAL_DEPENDENCIES.md',
  'reference/worker_scaffold/src/index.ts',
  'reference/interactive_demo/index.html',
  'reference/interactive_demo/server.mjs',
  'src/index.ts',
  'CODEX_START_PROMPT.txt',
];
for (const f of must) {
  if (!fs.existsSync(path.resolve(f))) throw new Error(`Missing ${f}`);
}
const live = fs.readFileSync('src/index.ts', 'utf8');
if (live.includes("'/api/reset'") || live.includes("'/api/state'"))
  throw new Error('Unsafe demo API route in live Worker');
console.log(
  `HANDOFF PACKAGE CHECK: PASS (${must.length} essential files found; unsafe debug route names absent from starter)`,
);
console.log('NOTE: This does NOT validate the future production application.');
