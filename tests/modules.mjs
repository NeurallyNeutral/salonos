import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
export async function moduleUnderTest(name) {
  const out = path.resolve('.wrangler/test-modules/' + name + '.mjs');
  await build({
    entryPoints: ['src/' + name + '.ts'],
    outfile: out,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
  });
  return import(pathToFileURL(out).href + '?v=' + Date.now());
}
