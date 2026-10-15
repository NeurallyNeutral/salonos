import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { runtime } from './runtime.mjs';
import { demoFixtures } from './demo-fixtures.mjs';
const { mf, db } = await runtime();
await demoFixtures(db);
try {
  const samples = [];
  for (let i = 0; i < 20; i++) {
    const start = performance.now(),
      response = await mf.dispatchFetch(
        'http://localhost/storefront/' + (i % 2 ? 'maison-sable' : 'atelier-atlas'),
      );
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.ok(Buffer.byteLength(body) < 32000);
    samples.push(performance.now() - start);
  }
  const raw =
    (await readFile('web/app.txt', 'utf8')) +
    (await readFile('web/launch.txt', 'utf8')) +
    (await readFile('web/app.css', 'utf8'));
  const gzipBytes = gzipSync(raw).length,
    p95 = Math.round(samples.sort((a, b) => a - b)[18]);
  assert.ok(gzipBytes < 50000, 'First party UI exceeds 50KB gzip budget');
  assert.ok(p95 < 3000, 'Local storefront p95 exceeds 3s budget');
  const report = {
    result: 'PASS',
    scope: 'local synthetic Worker; not production or mobile-network SLA',
    samples: 20,
    p95_ms: p95,
    ui_gzip_bytes: gzipBytes,
    budgets: { local_p95_ms: 3000, ui_gzip_bytes: 50000, storefront_json_bytes: 32000 },
  };
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/performance.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await mf.dispose();
}
