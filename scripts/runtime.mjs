import { Miniflare, Log, LogLevel } from 'miniflare';
import { readFile, readdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { bundle } from './build.mjs';

export async function runtime({ persist = false, port = 0, seed = true, environment = 'test', secret = randomBytes(32).toString('hex') } = {}) {
  await bundle();
  const mf = new Miniflare({ modules: true, scriptPath: 'dist/worker.mjs', compatibilityDate: '2026-07-30', host: '127.0.0.1', port,
    log: new Log(LogLevel.ERROR), d1Databases: ['DB'], d1Persist: persist,
    bindings: { ENVIRONMENT: environment, APP_BASE_URL: port ? `http://localhost:${port}` : 'http://localhost', APP_SECRET: secret, EMAIL_PROVIDER: 'mock', WHATSAPP_PROVIDER: 'mock' } });
  const db = await mf.getD1Database('DB');
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)');
  for (const file of (await readdir('migrations')).sort()) {
    if (await db.prepare('SELECT name FROM schema_migrations WHERE name=?').bind(file).first()) continue;
    // exec accepts complete SQL including triggers; migrations are trusted local source.
    await db.exec(await readFile(`migrations/${file}`, 'utf8'));
    await db.prepare('INSERT INTO schema_migrations VALUES (?)').bind(file).run();
  }
  if (seed) await db.exec(await readFile('fixtures/seed.sql', 'utf8'));
  return { mf, db, secret };
}
