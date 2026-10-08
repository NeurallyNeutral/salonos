import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split('\n');
const forbidden = files.filter(
  (f) =>
    /(^|\/)(node_modules|dist|\.wrangler|backups|artifacts|test-results|playwright-report)\//.test(
      f,
    ) ||
    (/(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example')) ||
    /\.(sqlite|db|zip)$/.test(f) ||
    f.endsWith('.dev.vars'),
);
if (forbidden.length) throw Error('Forbidden tracked artifacts: ' + forbidden.join(', '));
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  if (
    /-----BEGIN [A-Z ]*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|sk_live_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}/.test(
      text,
    )
  )
    throw Error('Potential credential in ' + file);
  if (file.startsWith('src/') && /from ['"]node:|from ['"].*reference\//.test(text))
    throw Error('Unsafe runtime import in ' + file);
}
console.log('SOURCE SAFETY: PASS (tracked files, credential patterns and runtime boundaries)');
