import { runtime } from './runtime.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
await mkdir('.wrangler/demo', { recursive: true });
const secretPath = '.wrangler/demo/app-secret';
let secret;
try { secret = await readFile(secretPath, 'utf8'); } catch { secret = randomBytes(32).toString('hex'); await writeFile(secretPath, secret, { mode: 0o600 }); }
const { mf } = await runtime({ persist: '.wrangler/demo/d1', port: Number(process.env.PORT || 8787), environment: 'development', secret });
await mf.ready;
console.log(`SalonOS local demo: http://localhost:${process.env.PORT || 8787}\nSynthetic fixtures only. Providers are MOCK. Stop with Ctrl+C.`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await mf.dispose(); process.exit(); });
