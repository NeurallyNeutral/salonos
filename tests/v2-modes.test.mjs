import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { runtime } from '../scripts/runtime.mjs';
import { client, login } from './helpers.mjs';
const key = () => randomUUID().replaceAll('-', '');
test('V2-B catalog inquiry is scoped, atomic, replay-safe, mode-gated and never a payment', async () => {
  const { mf, db } = await runtime();
  try {
    await db
      .prepare("UPDATE tenants SET business_mode='catalog_inquiry' WHERE id='t_rivage'")
      .run();
    const retail = await login(mf, db, 'rivage@example.invalid'),
      other = await login(mf, db),
      publicApi = client(mf);
    const item = await retail.api('/merchant/catalog', {
      name: 'Sac fictif',
      price_centimes: 12000,
      variant: 'Sable',
    });
    assert.equal(item.status, 201);
    assert.equal(
      (await other.api('/merchant/catalog/' + item.data.id, { name: 'Étranger' }, 'PATCH')).status,
      404,
    );
    assert.equal(
      (await other.api('/merchant/catalog', { name: 'Invalid', price_centimes: 100 })).status,
      409,
    );
    assert.equal((await publicApi('/public/studio-rivage')).status, 404);
    const body = {
      item_id: item.data.id,
      name: 'Client fictif',
      phone: '+212600000055',
      quantity: 1,
      consent_contact: true,
      source: 'instagram',
    };
    const idem = key();
    const contenders = await Promise.all(
      Array.from({ length: 8 }, () =>
        publicApi('/storefront/studio-rivage/inquiries', body, 'POST', { 'Idempotency-Key': idem }),
      ),
    );
    assert.equal(contenders.filter((r) => r.status === 201).length, 1);
    assert.ok(contenders.every((r) => [200, 201].includes(r.status)));
    assert.equal(new Set(contenders.map((r) => r.data.id)).size, 1);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM inquiries').first()).n, 1);
    assert.equal(
      (
        await db
          .prepare("SELECT COUNT(*) n FROM launch_events WHERE kind='inquiry_created'")
          .first()
      ).n,
      1,
    );
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM loyalty_ledger').first()).n, 0);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM payment_records').first()).n, 0);
    assert.equal((await other.api('/merchant/inquiries')).data.inquiries.length, 0);
    assert.equal((await client(mf)('/merchant/inquiries')).status, 401);
    const inquiry = contenders[0].data.id;
    assert.equal(
      (await other.api('/merchant/inquiries/' + inquiry, { status: 'fulfilled' }, 'PATCH')).status,
      409,
    );
    assert.equal(
      (await retail.api('/merchant/inquiries/' + inquiry, { status: 'fulfilled' }, 'PATCH')).status,
      200,
    );
    assert.equal(
      (
        await publicApi('/storefront/studio-rivage/inquiries', { ...body, quantity: 2 }, 'POST', {
          'Idempotency-Key': idem,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await publicApi(
          '/storefront/studio-rivage/inquiries',
          { ...body, phone: '+212600000056', consent_contact: false },
          'POST',
          { 'Idempotency-Key': key() },
        )
      ).status,
      400,
    );
    const store = (await publicApi('/storefront/studio-rivage')).data;
    assert.ok(!JSON.stringify(store).includes('Client fictif'));
    assert.equal(store.tenant.business_mode, 'catalog_inquiry');
    await db.prepare("UPDATE tenants SET paused=1 WHERE id='t_rivage'").run();
    assert.equal(
      (
        await publicApi(
          '/storefront/studio-rivage/inquiries',
          { ...body, phone: '+212600000057' },
          'POST',
          { 'Idempotency-Key': key() },
        )
      ).status,
      409,
    );
    assert.equal(
      (await db.prepare("SELECT COUNT(*) n FROM customers WHERE phone='+212600000057'").first()).n,
      0,
    );
    assert.equal(
      (await retail.api('/merchant/catalog', { name: '<script>', price_centimes: 10 })).status,
      400,
    );
    assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, []);
  } finally {
    await mf.dispose();
  }
});
