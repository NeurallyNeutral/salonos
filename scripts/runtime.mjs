import { Miniflare, Log, LogLevel } from 'miniflare';
import { readFile, readdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { bundle } from './build.mjs';

export async function runtime({
  persist = false,
  port = 0,
  seed = true,
  environment = 'test',
  secret = randomBytes(32).toString('hex'),
  bindings = {},
} = {}) {
  await bundle();
  const mf = new Miniflare({
    modules: true,
    scriptPath: 'dist/worker.mjs',
    compatibilityDate: '2026-07-30',
    host: '127.0.0.1',
    port,
    log: new Log(LogLevel.ERROR),
    d1Databases: ['DB'],
    d1Persist: persist,
    bindings: {
      ENVIRONMENT: environment,
      APP_BASE_URL: port ? `http://localhost:${port}` : 'http://localhost',
      APP_SECRET: secret,
      EMAIL_PROVIDER: 'mock',
      WHATSAPP_PROVIDER: 'mock',
      ...bindings,
    },
  });
  try {
    const db = await mf.getD1Database('DB');
    await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)');
    for (const file of (await readdir('migrations')).sort()) {
      if (await db.prepare('SELECT name FROM schema_migrations WHERE name=?').bind(file).first())
        continue;
      // Each nonempty migration line is one complete SQL statement (including any trigger body).
      // Keep schema + migration marker in one real D1 transaction so failures are retryable.
      const statements = (await readFile(`migrations/${file}`, 'utf8'))
        .split(/\r?\n/)
        .filter((line) => line.trim() && !line.trim().startsWith('--'));
      await db.batch([
        ...statements.map((sql) => db.prepare(sql)),
        db.prepare('INSERT INTO schema_migrations VALUES (?)').bind(file),
      ]);
    }
    if (
      seed &&
      !(await db
        .prepare("SELECT name FROM schema_migrations WHERE name='fixtures:base-v1'")
        .first())
    ) {
      const statements = (await readFile('fixtures/seed.sql', 'utf8'))
        .split(/\r?\n/)
        .filter((line) => line.trim() && !line.trim().startsWith('--'));
      await db.batch([
        ...statements.map((sql) => db.prepare(sql)),
        db.prepare("INSERT INTO schema_migrations VALUES ('fixtures:base-v1')"),
      ]);
    }
    return { mf, db, secret };
  } catch (error) {
    await mf.dispose();
    throw error;
  }
}
