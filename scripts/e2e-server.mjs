import { runtime } from './runtime.mjs';
import { demoFixtures } from './demo-fixtures.mjs';
const { mf, db } = await runtime({ port: 8790, environment: 'development' });
await demoFixtures(db);
await mf.ready;
console.log('E2E Worker/D1: http://localhost:8790');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    await mf.dispose();
    process.exit();
  });
