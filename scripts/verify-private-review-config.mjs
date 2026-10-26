import { readFile } from 'node:fs/promises';

const path = process.argv[2];
if (!path)
  throw Error('Usage: node scripts/verify-private-review-config.mjs wrangler.private-review.toml');
const source = await readFile(path, 'utf8');
for (const [label, expression] of [
  ['unresolved value', /CHANGE_ME|00000000-0000-0000-0000-000000000001/i],
  ['localhost URL', /localhost|127\.0\.0\.1/i],
  ['non-production environment', /ENVIRONMENT\s*=\s*"(?!production")/],
  ['development provider', /(?:EMAIL_PROVIDER|WHATSAPP_PROVIDER)\s*=\s*"mock"/],
  ['public workers.dev endpoint', /workers_dev\s*=\s*true/],
])
  if (expression.test(source)) throw Error('Private-review configuration rejected: ' + label);
if (!/APP_BASE_URL\s*=\s*"https:\/\//.test(source)) throw Error('HTTPS APP_BASE_URL required');
if (!/workers_dev\s*=\s*false/.test(source)) throw Error('workers_dev must be false');
if (!/database_id\s*=\s*"[0-9a-f-]{36}"/i.test(source)) throw Error('Real isolated D1 ID required');
console.log(
  'Private-review config static checks: PASS. Verify Cloudflare Access and secrets manually before owner deployment.',
);
