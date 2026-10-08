import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {runtime} from '../scripts/runtime.mjs';import {client,login} from './helpers.mjs';
const key=()=>randomUUID().replaceAll('-','');
async function visit(api,owner,db,phone='+212600000011',complete=true){const date=new Date(Date.now()+86400000).toISOString().slice(0,10),slot=(await api('/public/atelier-atlas/availability?service_id=s_atlas&date='+date)).data.slots[0];const book=await api('/public/atelier-atlas/bookings',{offer:slot.offer,name:'Cliente Fidélité Fictive',phone,email:'loyalty@example.invalid',consent_email:true,consent_marketing:true},'POST',{'Idempotency-Key':key()});assert.equal(book.status,201);
 // Trusted test fixture: move the visit into the past, then exercise real merchant attendance/payment APIs.
 const start=Math.floor((Date.now()-7200000)/300000)*300000;await db.batch([db.prepare('DELETE FROM booking_claims WHERE booking_id=?').bind(book.data.id),db.prepare('UPDATE bookings SET starts_at=?,ends_at=?,occupied_until=? WHERE id=?').bind(start,start+1200000,start+1200000,book.data.id)]);
 if(complete)assert.equal((await owner.api('/merchant/bookings/'+book.data.id+'/attendance',{status:'completed',satisfaction:1})).status,200);
 return await db.prepare('SELECT * FROM bookings WHERE id=?').bind(book.data.id).first();}
const pay=(owner,b,amount=12000,extra={},k=key())=>owner.api('/merchant/bookings/'+b.id+'/payments',{actual_payment_received:true,amount_centimes:amount,...extra},'POST',{'Idempotency-Key':k});
const refund=(owner,p,cash,credit=0,k=key())=>owner.api('/merchant/payments/'+p+'/refunds',{cash_centimes:cash,credit_centimes:credit,reason:'Remboursement demandé et enregistré'},'POST',{'Idempotency-Key':k});
test('M5 actual payment only, 1%/2% integer grants, cap, exactly-once, proportional refunds, immutable history',async()=>{
 const {mf,db}=await runtime();try{const api=client(mf),a=await login(mf,db),other=await login(mf,db,'rivage@example.invalid');await a.api('/merchant/settings',{loyalty_bps:100},'PATCH');const b=await visit(api,a,db,undefined,false);
 assert.equal((await pay(a,b)).status,409);assert.equal((await db.prepare('SELECT COUNT(*) n FROM loyalty_ledger').first()).n,0);await a.api('/merchant/bookings/'+b.id+'/attendance',{status:'completed'});
 assert.equal((await a.api('/merchant/bookings/'+b.id+'/payments',{amount_centimes:12000},'POST',{'Idempotency-Key':key()})).status,400);
 const k=key(),results=await Promise.all(Array.from({length:12},()=>pay(a,b,12000,{},k)));assert.equal(results.filter(r=>r.status===201).length,1);assert.ok(results.every(r=>[200,201].includes(r.status)),JSON.stringify(results));const payment=results[0].data.id;
 assert.equal((await a.api('/merchant/customers/'+b.customer_id+'/loyalty')).data.balance_centimes,120);
 assert.equal((await other.api('/merchant/customers/'+b.customer_id+'/loyalty')).status,404);assert.equal((await refund(other,payment,6000)).status,404);
 const rk=key();assert.equal((await refund(a,payment,6000,0,rk)).status,201);assert.equal((await refund(a,payment,6000,0,rk)).status,200);assert.equal((await a.api('/merchant/customers/'+b.customer_id+'/loyalty')).data.balance_centimes,60);
 assert.equal((await refund(a,payment,3000)).status,201);assert.equal((await a.api('/merchant/customers/'+b.customer_id+'/loyalty')).data.balance_centimes,30);assert.equal((await refund(a,payment,3001)).status,409);await refund(a,payment,3000);assert.equal((await a.api('/merchant/customers/'+b.customer_id+'/loyalty')).data.balance_centimes,0);
 await assert.rejects(db.prepare('UPDATE loyalty_ledger SET amount_centimes=999').run(),/append_only/);await assert.rejects(db.prepare('DELETE FROM payment_records').run(),/append_only/);
 await a.api('/merchant/settings',{loyalty_bps:200},'PATCH');const b2=await visit(api,a,db);await pay(a,b2);assert.equal((await a.api('/merchant/customers/'+b2.customer_id+'/loyalty')).data.balance_centimes,240);
 await a.api('/merchant/settings',{loyalty_cap:100},'PATCH');const b3=await visit(api,a,db);await pay(a,b3);assert.equal((await a.api('/merchant/customers/'+b3.customer_id+'/loyalty')).data.balance_centimes,340);
 const metrics=(await a.api('/merchant/metrics')).data;assert.equal(metrics.merchant_reported_paid_centimes,36000);assert.equal(metrics.refunded_centimes,12000);assert.equal(metrics.processor_verified_value,null);
 }finally{await mf.dispose();}
});
test('M5 authorized redemption, concurrent balance protection, negative refund balance and credit restoration',async()=>{
 const {mf,db}=await runtime();try{const api=client(mf),a=await login(mf,db);await a.api('/merchant/settings',{loyalty_bps:100},'PATCH');const b1=await visit(api,a,db);const p1=(await pay(a,b1)).data.id;await a.api('/merchant/settings',{loyalty_bps:0},'PATCH');const b2=await visit(api,a,db),b3=await visit(api,a,db);
 assert.equal((await pay(a,b2,11880,{redeemed_centimes:120})).status,409);
 const both=await Promise.all([pay(a,b2,11880,{redeemed_centimes:120,customer_verified_in_person:true}),pay(a,b3,11880,{redeemed_centimes:120,customer_verified_in_person:true})]);assert.equal(both.filter(r=>r.status===201).length,1,JSON.stringify(both));assert.equal(both.filter(r=>r.status===409).length,1);
 assert.equal((await a.api('/merchant/customers/'+b1.customer_id+'/loyalty')).data.balance_centimes,0);
 assert.equal((await refund(a,p1,12000)).status,201);const negative=(await a.api('/merchant/customers/'+b1.customer_id+'/loyalty')).data;assert.equal(negative.balance_centimes,-120);assert.equal(negative.redeemable_centimes,0);
 const p2=both.find(r=>r.status===201).data.id;assert.equal((await refund(a,p2,11880,120)).status,201);assert.equal((await a.api('/merchant/customers/'+b1.customer_id+'/loyalty')).data.balance_centimes,0);
 assert.equal((await db.prepare('SELECT SUM(amount_centimes) n FROM loyalty_allocations').first()).n,120);
 }finally{await mf.dispose();}
});
test('M5 expiry is append-only, first completed visit receives neutral review, never review rewards',async()=>{
 const {mf,db}=await runtime();try{const api=client(mf),a=await login(mf,db);await a.api('/merchant/settings',{loyalty_bps:100,marketing_enabled:true,review_url:'https://g.page/r/demo/review'},'PATCH');const b=await visit(api,a,db);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM loyalty_ledger').first()).n,0);await api('/dev/process',{});const messages=(await api('/dev/messages')).data.messages;const reviews=messages.filter(m=>m.kind==='review');assert.equal(reviews.length,1);assert.match(reviews[0].text,/expérience honnête/);assert.doesNotMatch(reviews[0].text,/étoiles|récompense|réduction|positif/i);
 await visit(api,a,db);await api('/dev/process',{});assert.equal((await db.prepare("SELECT COUNT(*) n FROM notification_outbox WHERE kind='review'").first()).n,1);
 await db.prepare("INSERT INTO loyalty_ledger(id,tenant_id,customer_id,kind,amount_centimes,event_key,expires_at,created_at) VALUES ('aged-fixture','t_atlas',?,'earn',100,'aged-fixture',?,?)").bind(b.customer_id,Date.now()-1,Date.now()-86400000).run();
 const balance=(await a.api('/merchant/customers/'+b.customer_id+'/loyalty')).data;assert.equal(balance.balance_centimes,0);assert.equal(balance.ledger.filter(l=>l.kind==='expire').length,1);await a.api('/merchant/customers/'+b.customer_id+'/loyalty');assert.equal((await db.prepare("SELECT COUNT(*) n FROM loyalty_ledger WHERE kind='expire'").first()).n,1);
 }finally{await mf.dispose();}
});
