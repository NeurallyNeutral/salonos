import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { runtime } from './runtime.mjs';
const secretPath = '.wrangler/demo/app-secret',
  current = await readFile(secretPath, 'utf8'),
  pending = await readFile(secretPath + '.previous', 'utf8').catch(() => null),
  previous = pending || current,
  next = pending ? current : randomBytes(32).toString('hex');
try {
  const response = await fetch('http://localhost:8787/health', {
    signal: AbortSignal.timeout(500),
  });
  if (response.ok) throw Error('Stop the local demo before rotating its key.');
} catch (error) {
  if (error.message.startsWith('Stop')) throw error;
}
if (!pending) {
  await writeFile(secretPath + '.previous', previous, { mode: 0o600 });
  await writeFile(secretPath, next, { mode: 0o600 });
}
const { mf, db } = await runtime({
  persist: '.wrangler/demo/d1',
  seed: false,
  secret: next,
  bindings: { APP_SECRET_PREVIOUS: previous },
});
try {
  const output = path.resolve('.wrangler/key-rotation.mjs');
  await build({
    entryPoints: ['src/key-rotation.ts'],
    outfile: output,
    bundle: true,
    format: 'esm',
    platform: 'browser',
  });
  const { reencryptStoredKeys } = await import(pathToFileURL(output));
  console.log(
    await reencryptStoredKeys({ DB: db, APP_SECRET: next, APP_SECRET_PREVIOUS: previous }),
  );
  console.log(
    'Local key rotation/re-encryption complete. Previous key retained for recovery. Archive it securely with any older encrypted backup before retiring it. A repeated command resumes this rotation.',
  );
} finally {
  await mf.dispose();
}
