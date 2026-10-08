import { build, transform } from 'esbuild';
import { readFile } from 'node:fs/promises';
export async function bundle() {
  await transform(await readFile('web/app.txt','utf8'),{loader:'js',target:'es2022'});
  await build({ entryPoints: ['src/index.ts'], outfile: 'dist/worker.mjs', bundle: true, format: 'esm', platform: 'browser', target: 'es2022', loader: { '.html': 'text', '.css': 'text', '.txt': 'text' } });
}
if (process.argv[1]?.endsWith('build.mjs')) await bundle();
