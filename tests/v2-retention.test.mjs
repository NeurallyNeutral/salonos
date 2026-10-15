import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { runtime } from '../scripts/runtime.mjs';
import { client, login } from './helpers.mjs';
const key = () => randomUUID().replaceAll('-', '');
test('V2-D fulfilled commerce pays/earns once, integer refund/redeem authorization, neutral reviews and truthful metrics', async () => {
  const { mf, db } = await runtime();
  try {
    await db
      .prepare(
        "UPDATE tenants SET business_mode='catalog_inquiry',onboarding_started_at=1 WHERE id='t_rivage'",
      )
      .run();
    const owner = await login(mf, db, 'rivage@example.invalid'),
      other = await login(mf, db),
      api = client(mf);
    assert.equal(
      (await owner.api('/merchant/settings', { loyalty_bps: 200 }, 'PATCH')).status,
      400,
    );
    assert.equal(
      (
        await owner.api('/merchant/retention-settings', {
          loyalty_bps: 200,
          understands_merchant_funded_terms: false,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await owner.api('/merchant/retention-settings', {
          loyalty_bps: 200,
          understands_merchant_funded_terms: true,
          review_url: 'https://g.page/example/review',
        })
      ).status,
      200,
    );
    const item = (await owner.api('/merchant/catalog', { name: 'Fiction', price_centimes: 12000 }))
      .data.id;
    async function inquiry(phone = '+212600000066') {
      const r = await api(
        '/storefront/studio-rivage/inquiries',
        { item_id: item, name: 'Client commerce fictif', phone, consent_contact: true },
        'POST',
        { 'Idempotency-Key': key() },
      );
      assert.equal(r.status, 201);
      return r.data.id;
    }
    const first = await inquiry(),
      paymentKey = key();
    const pay = (bid, body, idem = key()) =>
      owner.api('/merchant/inquiries/' + bid + '/payments', body, 'POST', {
        'Idempotency-Key': idem,
      });
    const body = { actual_payment_received: true, amount_centimes: 12000 };
    assert.equal((await pay(first, body)).status, 409);
    await owner.api('/merchant/inquiries/' + first, { status: 'fulfilled' }, 'PATCH');
    assert.equal((await pay(first, { amount_centimes: 12000 })).status, 400);
    const payments = await Promise.all(
      Array.from({ length: 8 }, () => pay(first, body, paymentKey)),
    );
    assert.equal(payments.filter((r) => r.status === 201).length, 1);
    assert.ok(payments.every((r) => [200, 201].includes(r.status)));
    const payment = payments[0].data.id,
      customer = (await owner.api('/merchant/inquiries')).data.inquiries[0].customer_id;
    assert.equal(
      (await owner.api('/merchant/customers/' + customer + '/loyalty')).data.balance_centimes,
      240,
    );
    assert.equal((await other.api('/merchant/inquiries/' + first + '/payments')).status, 404);
    assert.equal((await pay(first, body)).status, 409);
    const review = (await owner.api('/merchant/inquiries/' + first + '/review-prompt')).data;
    assert.equal(review.eligible, true);
    assert.match(review.text, /expérience honnête/);
    assert.equal(review.automatic_send, false);
    assert.ok(!/étoile|récompense/.test(review.text));
    const next = await inquiry();
    await owner.api('/merchant/inquiries/' + next, { status: 'fulfilled' }, 'PATCH');
    assert.equal(
      (
        await pay(next, {
          actual_payment_received: true,
          amount_centimes: 11800,
          redeemed_centimes: 200,
        })
      ).status,
      409,
    );
    const nextPayment = await pay(next, {
      actual_payment_received: true,
      amount_centimes: 11800,
      redeemed_centimes: 200,
      customer_verified_in_person: true,
    });
    assert.equal(nextPayment.status, 201);
    assert.equal(
      (await owner.api('/merchant/inquiries/' + next + '/review-prompt')).data.eligible,
      false,
    );
    const refundBody = { cash_centimes: 6000, credit_centimes: 0, reason: 'Correction fictive' },
      refundKey = key();
    const refund = () =>
      owner.api('/merchant/commerce-payments/' + payment + '/refunds', refundBody, 'POST', {
        'Idempotency-Key': refundKey,
      });
    assert.equal((await refund()).status, 201);
    assert.equal((await refund()).status, 200);
    assert.equal(
      (await owner.api('/merchant/customers/' + customer + '/loyalty')).data.balance_centimes,
      156,
    );
    await assert.rejects(
      db.prepare('UPDATE commerce_payments SET amount_centimes=1 WHERE id=?').bind(payment).run(),
      /append_only/,
    );
    await assert.rejects(db.prepare('DELETE FROM commerce_refunds').run(), /append_only/);
    const metrics = (await owner.api('/merchant/launch-metrics')).data;
    assert.equal(metrics.inquiries, 2);
    assert.equal(metrics.commerce_merchant_reported_paid_centimes, 23800);
    assert.equal(metrics.commerce_refunded_centimes, 6000);
    assert.equal(metrics.processor_verified_value, null);
    assert.equal(metrics.attributable_new_customers, null);
    assert.equal(metrics.dataset, 'synthetic');
    assert.equal(metrics.repeat_customers, 1);
    assert.equal((await owner.api('/merchant/plan-usage')).data.collection, 'disabled');
    assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, []);
  } finally {
    await mf.dispose();
  }
});
