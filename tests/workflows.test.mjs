import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {runtime} from '../scripts/runtime.mjs';import {client,login} from './helpers.mjs';
test('M4 customer records, truthful counts, cross-tenant CSV and spreadsheet escaping',async()=>{
 const {mf,db}=await runtime();try{
  const api=client(mf),a=await login(mf,db),b=await login(mf,db,'rivage@example.invalid'),date=new Date(Date.now()+86400000).toISOString().slice(0,10);
  const slot=(await api('/public/atelier-atlas/availability?service_id=s_atlas&date='+date)).data.slots[0];
  const booking=await api('/public/atelier-atlas/bookings',{offer:slot.offer,name:'=HYPERLINK("evil")',phone:'+212600000003'},'POST',{'Idempotency-Key':randomUUID().replaceAll('-','')});assert.equal(booking.status,201);
  const customer=(await a.api('/merchant/customers')).data.customers[0];assert.equal((await b.api('/merchant/customers')).data.customers.length,0);assert.equal((await b.api('/merchant/customers/'+customer.id,{name:'hijacked'},'PATCH')).status,404);
  const csv=await mf.dispatchFetch('http://localhost/merchant/export.csv',{headers:{Cookie:a.cookie}});assert.equal(csv.status,200);assert.match(await csv.text(),/"'=HYPERLINK/);
  const otherCsv=await mf.dispatchFetch('http://localhost/merchant/export.csv',{headers:{Cookie:b.cookie}});assert.doesNotMatch(await otherCsv.text(),/HYPERLINK|212600000003/);
  const m=(await a.api('/merchant/metrics')).data;assert.equal(m.processed_bookings,1);assert.equal(m.completed_visits,0);assert.equal(m.attendance_denominator,0);assert.equal(m.booked_value_centimes,12000);assert.equal(m.processor_verified_value,null);
  assert.equal((await a.api('/merchant/bookings/'+booking.data.id+'/attendance',{status:'completed'})).status,409);
  await a.api('/merchant/customers/'+customer.id,{suppressed:true},'PATCH');assert.equal((await a.api('/merchant/customers')).data.customers[0].suppressed,1);
  assert.equal((await mf.dispatchFetch('http://localhost/merchant/export.csv')).status,401);
 }finally{await mf.dispose();}
});
