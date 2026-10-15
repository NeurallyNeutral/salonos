import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import prettier from 'prettier';

const fix = process.argv.includes('--write');
const problems = [];
for (const root of ['src', 'scripts', 'tests', 'web']) {
  for (const relative of await readdir(root, { recursive: true })) {
    const file = path.join(root, relative);
    if (!/\.(ts|mjs|css|html)$/.test(file) && !file.endsWith('.txt')) continue;
    const source = await readFile(file, 'utf8');
    const options = { ...(await prettier.resolveConfig(file)), filepath: file };
    if (file.endsWith('.txt')) options.parser = 'babel';
    const formatted = await prettier.format(source, options);
    if (source !== formatted) {
      if (fix) await writeFile(file, formatted);
      else problems.push(file);
    }
  }
}
if (problems.length) throw Error('Run node scripts/lint.mjs --write: ' + problems.join(', '));
console.log('Source syntax/formatting: PASS');
