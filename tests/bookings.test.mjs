import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { runtime } from '../scripts/runtime.mjs';
import { client, login } from './helpers.mjs';
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const payload = (offer) => ({
  offer,
  name: 'Cliente Démo',
  phone: '+212600000001',
  email: 'client@example.invalid',
  consent_email: true,
});
const key = () => randomUUID().replaceAll('-', '');

test('M6 mixed manual/public buffer contention and concurrent cancel/reschedule preserve occupancy', async () => {
  const { mf, db } = await runtime();
  try {
    const api = client(mf),
      owner = await login(mf, db);
    const short = (
      await api('/public/atelier-atlas/availability?service_id=s_atlas&date=' + tomorrow)
    ).data.slots;
    const long = (await owner.api('/merchant/availability?service_id=s_long&date=' + tomorrow)).data
      .slots;
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        (i % 2 ? owner.api : api)(
          i % 2 ? '/merchant/bookings' : '/public/atelier-atlas/bookings',
          payload(i % 2 ? long[0].offer : short[0].offer),
          'POST',
          { 'Idempotency-Key': key() },
        ),
      ),
    );
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(results.filter((r) => r.status === 409).length, 39);
    const winner = results.find((r) => r.status === 201).data,
      record = await db.prepare('SELECT * FROM bookings WHERE id=?').bind(winner.id).first();
    assert.equal(
      (await db.prepare('SELECT COUNT(*) n FROM booking_claims').first()).n,
      (record.occupied_until - record.starts_at) / 300000,
    );
    const offers = (
      await api(
        '/public/atelier-atlas/availability?service_id=' + record.service_id + '&date=' + tomorrow,
      )
    ).data.slots;
    const manage = client(mf, { Authorization: 'Bearer ' + winner.manage_token });
    const edits = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        manage(
          '/manage-api/' + winner.id + (i % 2 ? '/cancel' : '/reschedule'),
          i % 2 ? {} : { offer: offers[offers.length - 1].offer },
        ),
      ),
    );
    assert.equal(edits.filter((r) => r.status === 200).length, 1);
    assert.ok(edits.every((r) => [200, 404, 409].includes(r.status)));
    const final = await db.prepare('SELECT * FROM bookings WHERE id=?').bind(winner.id).first();
    const claims = (
      await db
        .prepare('SELECT slot_utc FROM booking_claims WHERE booking_id=? ORDER BY slot_utc')
        .bind(winner.id)
        .all()
    ).results;
    assert.equal(
      claims.length,
      final.status === 'cancelled' ? 0 : (final.occupied_until - final.starts_at) / 300000,
    );
    assert.ok(claims.every((cell, i) => cell.slot_utc === final.starts_at + i * 300000));
    assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length, 0);
  } finally {
    await mf.dispose();
  }
});
test('M2 forty contenders: one booking, atomic claims/outbox, idempotent replay', async () => {
  const { mf, db } = await runtime();
  try {
    const api = client(mf),
      slot = (await api('/public/atelier-atlas/availability?service_id=s_atlas&date=' + tomorrow))
        .data.slots[0];
    assert.ok(slot);
    const requests = Array.from({ length: 40 }, () => key());
    const results = await Promise.all(
      requests.map((k) =>
        api('/public/atelier-atlas/bookings', payload(slot.offer), 'POST', {
          'Idempotency-Key': k,
        }),
      ),
    );
    assert.equal(results.filter((r) => r.status === 201).length, 1, JSON.stringify(results));
    assert.equal(results.filter((r) => r.status === 409).length, 39);
    const winner = results.findIndex((r) => r.status === 201),
      book = results[winner].data;
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM bookings').first()).n, 1);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM booking_claims').first()).n, 4);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM customers').first()).n, 1);
    const outbox = (await db.prepare('SELECT COUNT(*) n FROM notification_outbox').first()).n;
    const replay = await api('/public/atelier-atlas/bookings', payload(slot.offer), 'POST', {
      'Idempotency-Key': requests[winner],
    });
    assert.equal(replay.status, 200);
    assert.deepEqual(replay.data, book);
    assert.equal(
      (await db.prepare('SELECT COUNT(*) n FROM notification_outbox').first()).n,
      outbox,
    );
    assert.equal(
      (
        await api(
          '/public/atelier-atlas/bookings',
          { ...payload(slot.offer), name: 'different' },
          'POST',
          { 'Idempotency-Key': requests[winner] },
        )
      ).status,
      409,
    );
    const occupied = (
      await api('/public/atelier-atlas/availability?service_id=s_atlas&date=' + tomorrow)
    ).data.slots;
    assert.ok(!occupied.some((s) => s.starts_at === slot.starts_at));
  } finally {
    await mf.dispose();
  }
});
test('M2 overlap, manual/public conflict, reschedule rollback, token rotation and cancellation', async () => {
  const { mf, db } = await runtime();
  try {
    const api = client(mf),
      owner = await login(mf, db),
      other = await login(mf, db, 'rivage@example.invalid');
    const slots = (
      await api('/public/atelier-atlas/availability?service_id=s_atlas&date=' + tomorrow)
    ).data.slots;
    const a = await api('/public/atelier-atlas/bookings', payload(slots[0].offer), 'POST', {
      'Idempotency-Key': key(),
    });
    assert.equal(a.status, 201);
    const b = await owner.api('/merchant/bookings', payload(slots[1].offer), 'POST', {
      'Idempotency-Key': key(),
    });
    assert.equal(b.status, 409);
    const second = await owner.api(
      '/merchant/bookings',
      { ...payload(slots[8].offer), phone: '+212600000002' },
      'POST',
      { 'Idempotency-Key': key() },
    );
    assert.equal(second.status, 201);
    const manage = client(mf, { Authorization: 'Bearer ' + a.data.manage_token });
    assert.equal((await other.api('/merchant/bookings/' + a.data.id + '/cancel', {})).status, 404);
    assert.equal(
      (await manage('/manage-api/' + a.data.id + '/reschedule', { offer: slots[8].offer })).status,
      409,
    );
    assert.equal(
      (
        await db
          .prepare('SELECT COUNT(*) n FROM booking_claims WHERE booking_id=?')
          .bind(a.data.id)
          .first()
      ).n,
      4,
    );
    const move = await manage('/manage-api/' + a.data.id + '/reschedule', {
      offer: slots[16].offer,
    });
    assert.equal(move.status, 200);
    assert.equal((await manage('/manage-api/' + a.data.id + '/cancel', {})).status, 404);
    assert.equal(
      (
        await client(mf, { Authorization: 'Bearer ' + '0'.repeat(64) })(
          '/manage-api/' + a.data.id + '/cancel',
          {},
        )
      ).status,
      404,
    );
    const fresh = client(mf, { Authorization: 'Bearer ' + move.data.manage_token });
    assert.equal((await fresh('/manage-api/' + a.data.id + '/cancel', {})).status, 200);
    assert.equal(
      (
        await db
          .prepare('SELECT COUNT(*) n FROM booking_claims WHERE booking_id=?')
          .bind(a.data.id)
          .first()
      ).n,
      0,
    );
    const rebook = await api('/public/atelier-atlas/bookings', payload(slots[16].offer), 'POST', {
      'Idempotency-Key': key(),
    });
    assert.equal(rebook.status, 201);
    await db.prepare('UPDATE bookings SET manage_expires=0 WHERE id=?').bind(rebook.data.id).run();
    assert.equal(
      (
        await client(mf, { Authorization: 'Bearer ' + rebook.data.manage_token })(
          '/manage-api/' + rebook.data.id,
        )
      ).status,
      404,
    );
    const long = (
      await api('/public/atelier-atlas/availability?service_id=s_long&date=' + tomorrow)
    ).data.slots;
    assert.ok(!long.some((s) => s.starts_at === slots[7].starts_at));
  } finally {
    await mf.dispose();
  }
});
test('M2 signed slots, horizon, closed hours, blackout, pause, foreign resource and stale configuration', async () => {
  const { mf, db } = await runtime();
  try {
    const api = client(mf),
      owner = await login(mf, db);
    const url = '/public/atelier-atlas/availability?service_id=s_atlas&date=' + tomorrow;
    const slot = (await api(url)).data.slots[0];
    assert.equal(
      (
        await api(
          '/public/atelier-atlas/bookings',
          payload(slot.offer.slice(0, -2) + 'aa'),
          'POST',
          { 'Idempotency-Key': key() },
        )
      ).status,
      400,
    );
    assert.equal(
      (await api('/public/atelier-atlas/availability?service_id=s_rivage&date=' + tomorrow)).status,
      400,
    );
    assert.equal(
      (await api('/public/atelier-atlas/availability?service_id=s_atlas&date=2026-02-31')).status,
      400,
    );
    assert.equal(
      (await api('/public/atelier-atlas/availability?service_id=s_atlas&date=2099-01-01')).data
        .slots.length,
      0,
    );
    assert.equal(
      (
        await owner.api('/merchant/blackouts', {
          starts_at: slot.starts_at,
          ends_at: slot.starts_at + 3600000,
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await api('/public/atelier-atlas/bookings', payload(slot.offer), 'POST', {
          'Idempotency-Key': key(),
        })
      ).status,
      409,
    );
    assert.ok(!(await api(url)).data.slots.some((s) => s.starts_at === slot.starts_at));
    await owner.api('/merchant/settings', { paused: true }, 'PATCH');
    assert.equal((await api(url)).data.slots.length, 0);
    assert.ok(
      (await owner.api('/merchant/availability?service_id=s_atlas&date=' + tomorrow)).data.slots
        .length > 0,
    );
    await owner.api('/merchant/settings', { paused: false }, 'PATCH');
    await owner.api('/merchant/hours', { hours: [] }, 'PUT');
    assert.equal((await api(url)).data.slots.length, 0);
  } finally {
    await mf.dispose();
  }
});
