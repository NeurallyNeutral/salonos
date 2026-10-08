import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { App, Row, email, token, hash, hmac, equal, now, id, stmt, fail, local, limit } from './core';

export const auth = new Hono<App>();
auth.post('/request', async c => {
  await limit(c, 'login-ip', 10, 600000);
  const address = email((await c.req.json()).email);
  await limit(c, 'login-email:' + await hash(address), 3, 600000);
  const user = await stmt(c.env.DB, 'SELECT u.id FROM merchant_users u JOIN tenants t ON t.id=u.tenant_id WHERE u.email=? AND u.active=1 AND t.active=1', address).first<Row>();
  if (user) {
    const raw = token();
    await stmt(c.env.DB, 'INSERT INTO magic_links VALUES (?,?,?,NULL)', await hash(raw), user.id, now() + 600000).run();
    if (local(c)) await stmt(c.env.DB, 'INSERT INTO mock_mail VALUES (?,?,?,?)', id(), address, raw, now()).run();
    // M3 supplies durable live delivery; fail closed while it is unconfigured.
  }
  return c.json({ ok: true, message: 'Si ce compte existe, un lien de connexion sera envoyé.' });
});
auth.post('/consume', async c => {
  await limit(c, 'login-consume', 20, 600000);
  const raw = (await c.req.json()).token;
  if (typeof raw !== 'string' || !/^[a-f0-9]{64}$/.test(raw)) fail(401, 'invalid_magic');
  const magic = await hash(raw), session = token();
  const link = await stmt(c.env.DB, 'SELECT user_id FROM magic_links WHERE hash=? AND used_at IS NULL AND expires_at>?', magic, now()).first<Row>();
  if (!link) fail(401, 'invalid_magic');
  try { await stmt(c.env.DB, 'INSERT INTO sessions VALUES (?,?,?,?)', await hash(session), link.user_id, now() + 43200000, magic).run(); } catch { fail(401, 'invalid_magic'); }
  setCookie(c, 'salonos_session', session, { httpOnly: true, secure: true, sameSite: 'Strict', path: '/', maxAge: 43200 });
  return c.json({ ok: true });
});

export const merchant = new Hono<App>();
merchant.use('*', async (c, next) => {
  const raw = getCookie(c, 'salonos_session') || '';
  const m = await stmt(c.env.DB, 'SELECT u.id,u.tenant_id,u.email,u.role FROM sessions s JOIN merchant_users u ON u.id=s.user_id JOIN tenants t ON t.id=u.tenant_id WHERE s.hash=? AND s.expires_at>? AND u.active=1 AND t.active=1', await hash(raw), now()).first<Row>();
  if (!m) fail(401, 'unauthorized');
  c.set('merchant', m); c.set('rawSession', raw);
  if (!['GET','HEAD'].includes(c.req.method) && !equal(c.req.header('X-CSRF-Token') || '', await hmac(c.env.APP_SECRET, 'csrf:' + raw))) fail(403, 'csrf_required');
  await next();
});
merchant.get('/session', async c => c.json({ merchant: c.get('merchant'), csrf: await hmac(c.env.APP_SECRET, 'csrf:' + c.get('rawSession')) }));
merchant.post('/logout', async c => { await stmt(c.env.DB, 'DELETE FROM sessions WHERE hash=?', await hash(c.get('rawSession'))).run(); deleteCookie(c, 'salonos_session', { path: '/', secure: true }); return c.json({ ok: true }); });
