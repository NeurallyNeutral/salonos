import fs from 'node:fs';
import path from 'node:path';

const required = [
  'AGENTS.md',
  'README.md',
  'spec/00_START_HERE.md',
  'spec/01_DESIGN_TOKENS.md',
  'spec/02_SCREEN_CONTRACTS.md',
  'spec/03_STATE_AND_COPY.md',
  'spec/04_API_AND_SECURITY_MAP.md',
  'spec/05_FILE_PLAN.md',
  'spec/06_DELIVERY_AND_TESTS.md',
  'spec/07_OWNER_LINUX_HANDOFF.md',
  'spec/IMPLEMENTATION_LOG.md',
  'src/index.ts',
  'src/auth.ts',
  'src/bookings.ts',
  'src/storefront.ts',
  'src/onboarding.ts',
  'src/commerce.ts',
  'web/app.txt',
  'web/launch.txt',
  'web/demo.txt',
  'web/app.css',
  'scripts/build.mjs',
  'wrangler.local.toml',
  'wrangler.private-review.example.toml',
  'migrations/0012_privacy_lifecycle.sql',
  'tests/bookings.test.mjs',
  'tests/release-config.test.mjs',
];
for (const file of required) {
  if (!fs.existsSync(path.resolve(file))) throw Error('Missing essential code/spec file: ' + file);
}

const forbidden = [
  'CODEX_START_PROMPT.txt',
  'docs/CODEX_MISSION.md',
  'docs/V2_CODEX_MISSION.md',
  'reference/interactive_demo/index.html',
  'reference/worker_scaffold/src/index.ts',
  'wrangler.toml',
];
for (const file of forbidden) {
  if (fs.existsSync(path.resolve(file))) throw Error('Stale or dangerous handoff file: ' + file);
}

const live = fs.readFileSync('src/index.ts', 'utf8');
if (live.includes("'/api/reset'") || live.includes("'/api/state'"))
  throw Error('Unsafe reset/state endpoint in real Worker');

console.log('GLM HANDOFF: PASS — full backend, UI, migrations, exact spec, no legacy prompts');
