import { build } from 'esbuild';
export async function bundle() {
  await build({ entryPoints: ['src/index.ts'], outfile: 'dist/worker.mjs', bundle: true, format: 'esm', platform: 'browser', target: 'es2022', loader: { '.html': 'text', '.css': 'text', '.txt': 'text' } });
}
if (process.argv[1]?.endsWith('build.mjs')) await bundle();
