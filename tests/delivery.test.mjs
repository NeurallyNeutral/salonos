import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,createHmac} from 'node:crypto';import {runtime} from '../scripts/runtime.mjs';import {client,login} from './helpers.mjs';
const date=new Date(Date.now()+86400000).toISOString().slice(0,10);
async function book(api,consent={consent_whatsapp:true}){const slot=(await api('/public/atelier-atlas/availability?service_id=s_atlas&date='+date)).data.slots[0];return (await api('/public/atelier-atlas/bookings',{offer:slot.offer,name:'Démo',phone:'+212600000001',email:'client@example.invalid',...consent},'POST',{'Idempotency-Key':randomUUID().replaceAll('-','')})).data;}
test('M3 duplicate processors, downtime/backoff, acceptance vs delivery, signed receipt replay',async()=>{
 const secret='local-test-webhook-secret', {mf,db}=await runtime({bindings:{META_APP_SECRET:secret,META_VERIFY_TOKEN:'test-verify'}});try{
  const api=client(mf);await book(api);await db.prepare("INSERT INTO mock_behavior VALUES ('whatsapp','retryable')").run();
  await Promise.all(Array.from({length:5},()=>api('/dev/process',{})));
  let job=await db.prepare("SELECT * FROM notification_outbox WHERE kind='confirmation'").first();assert.equal(job.attempts,1);assert.equal(job.state,'failed_retryable');assert.equal(job.accepted_at,null);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM mock_deliveries').first()).n,0);
  await db.prepare("UPDATE mock_behavior SET outcome='ok'").run();await db.prepare('UPDATE notification_outbox SET due_at=0 WHERE id=?').bind(job.id).run();
  await Promise.all(Array.from({length:5},()=>api('/dev/process',{})));job=await db.prepare('SELECT * FROM notification_outbox WHERE id=?').bind(job.id).first();assert.equal(job.state,'provider_accepted');assert.equal(job.delivered_at,null);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM mock_deliveries').first()).n,1);
  const payload={entry:[{changes:[{value:{statuses:[{id:job.provider_id,status:'delivered'}]}}]}]},raw=JSON.stringify(payload),sig='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
  assert.equal((await api('/webhooks/meta',payload,'POST',{'x-hub-signature-256':'bad'})).status,403);
  for(let i=0;i<3;i++)assert.equal((await api('/webhooks/meta',payload,'POST',{'x-hub-signature-256':sig})).status,200);
  assert.equal((await db.prepare('SELECT state FROM notification_outbox WHERE id=?').bind(job.id).first()).state,'delivered');assert.equal((await db.prepare('SELECT COUNT(*) n FROM webhook_events').first()).n,1);
  assert.equal((await mf.dispatchFetch('http://localhost/webhooks/meta?hub.mode=subscribe&hub.verify_token=test-verify&hub.challenge=123')).status,200);
 }finally{await mf.dispose();}
});
test('M3 consent suppression, safe email fallback, uncertain outcome, expired leases and tenant-scoped queue',async()=>{
 const {mf,db}=await runtime();try{
  const api=client(mf),owner=await login(mf,db);const first=await book(api,{});await api('/dev/process',{});
  assert.equal((await db.prepare("SELECT state FROM notification_outbox WHERE booking_id=? AND kind='confirmation'").bind(first.id).first()).state,'suppressed');
  await db.prepare("INSERT INTO mock_behavior VALUES ('whatsapp','final')").run();const second=await book(api,{consent_email:true,consent_whatsapp:true});await api('/dev/process',{});await api('/dev/process',{});
  const fallback=await db.prepare("SELECT * FROM notification_outbox WHERE booking_id=? AND channel='email'").bind(second.id).first();assert.equal(fallback.state,'provider_accepted');assert.match(fallback.event_key,/fallback-email/);
  await db.prepare("UPDATE mock_behavior SET outcome='uncertain'").run();const third=await book(api);await api('/dev/process',{});await api('/dev/process',{});
  const uncertain=await db.prepare("SELECT * FROM notification_outbox WHERE booking_id=? AND kind='confirmation'").bind(third.id).first();assert.equal(uncertain.state,'uncertain');assert.equal(uncertain.attempts,1);
  assert.equal((await owner.api('/merchant/notifications/'+uncertain.id+'/retry',{})).status,409);
  await db.prepare("UPDATE notification_outbox SET state='leased',lease_until=0 WHERE id=?").bind(uncertain.id).run();await api('/dev/process',{});assert.equal((await db.prepare('SELECT state FROM notification_outbox WHERE id=?').bind(uncertain.id).first()).state,'uncertain');
  const alerts=(await owner.api('/merchant/notifications')).data.alerts;assert.ok(alerts.length>=1);
 }finally{await mf.dispose();}
});
test('M3 production exposes no mock inbox and rejects unsigned webhooks',async()=>{
 const {mf}=await runtime({environment:'production'});try{const api=client(mf);assert.equal((await api('/dev/inbox')).status,404);assert.equal((await api('/dev/messages')).status,404);assert.equal((await api('/dev/process',{})).status,404);assert.equal((await api('/webhooks/resend',{})).status,403);}finally{await mf.dispose();}
});
