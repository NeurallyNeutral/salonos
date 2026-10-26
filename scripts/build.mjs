import { build, transform } from 'esbuild';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
export async function bundle() {
  await transform(await readFile('web/app.txt', 'utf8'), { loader: 'js', target: 'es2022' });
  await transform(await readFile('web/launch.txt', 'utf8'), { loader: 'js', target: 'es2022' });
  await build({
    entryPoints: ['src/index.ts'],
    outfile: 'dist/worker.mjs',
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    loader: { '.html': 'text', '.css': 'text', '.txt': 'text' },
  });
  for (const mode of ['merchant', 'customer']) {
    await mkdir('dist/guided-demo/demo/' + mode, { recursive: true });
    await copyFile('web/demo.html', 'dist/guided-demo/demo/' + mode + '/index.html');
  }
  await copyFile('web/demo.css', 'dist/guided-demo/demo.css');
  await copyFile('web/demo.txt', 'dist/guided-demo/demo.js');
}
if (process.argv[1]?.endsWith('build.mjs')) await bundle();
