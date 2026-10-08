import { merchant } from './auth';
import { Row, stmt, rows, owner, str, integer, flag, id, fail, audit } from './core';
merchant.get('/config', async c => {
  const tid=c.get('merchant').tenant_id, db=c.env.DB;
  const tenant=await stmt(db,'SELECT * FROM tenants WHERE id=?',tid).first();
  const out:Row={tenant};
  for(const [key,table] of Object.entries({services:'services',resources:'resources',assignments:'service_resources',hours:'weekly_hours',blackouts:'blackouts',subscription:'tenant_subscription_status'})) out[key]=await rows(db,`SELECT * FROM ${table} WHERE tenant_id=?`,tid);
  return c.json(out);
});
merchant.patch('/settings', async c => {
  const m=owner(c),b=await c.req.json<Row>(),changes:Row={};
  for(const [k,v] of Object.entries(b)) {
    if(k==='name') changes[k]=str(v,100);
    else if(k==='timezone') {try{new Intl.DateTimeFormat('fr',{timeZone:str(v)}).format();}catch{fail(400,'invalid_timezone');}changes[k]=v;}
    else if(['paused','marketing_enabled','reminders_enabled'].includes(k)) changes[k]=flag(v);
    else if(k==='cutoff_min') changes[k]=integer(v,0,10080);
    else if(k==='horizon_days') changes[k]=integer(v,1,180);
    else if(k==='loyalty_bps') {if(![0,100,200].includes(v)) fail(400,'invalid_rate');changes[k]=v;}
    else if(['loyalty_cap','loyalty_min_redeem'].includes(k)) changes[k]=integer(v,0,10000000);
    else if(k==='loyalty_expiry_days') changes[k]=integer(v,0,730);
    else if(['logo_url','review_url'].includes(k)) {
      if(!v) changes[k]=null;
      else {let u:URL;try{u=new URL(str(v,500));}catch{fail(400,'invalid_url');}if(u!.protocol!=='https:'||u!.username||u!.password) fail(400,'invalid_url');if(k==='review_url'&&!['g.page','search.google.com','www.google.com','maps.google.com'].includes(u!.hostname)) fail(400,'invalid_review_url');changes[k]=u!.href;}
    } else fail(400,'unknown_setting');
  }
  if(!Object.keys(changes).length) fail(400,'empty_update');
  await c.env.DB.batch([stmt(c.env.DB,`UPDATE tenants SET ${Object.keys(changes).map(k=>`${k}=?`).join(',')},revision=revision+1 WHERE id=?`,...Object.values(changes),m.tenant_id),audit(c.env.DB,m.tenant_id,m.id,'settings_updated')]);return c.json({ok:true});
});
for(const kind of ['services','resources'] as const) {
  merchant.post('/'+kind,async c=>{
    const m=owner(c),b=await c.req.json<Row>(),key=id(),db=c.env.DB,name=str(b.name,100);
    const q=kind==='services'?stmt(db,'INSERT INTO services(id,tenant_id,name,duration_min,buffer_min,price_centimes) VALUES (?,?,?,?,?,?)',key,m.tenant_id,name,integer(b.duration_min,5,240,5),integer(b.buffer_min??0,0,60,5),integer(b.price_centimes,0,10000000)):stmt(db,'INSERT INTO resources(id,tenant_id,name) VALUES (?,?,?)',key,m.tenant_id,name);
    await db.batch([q,stmt(db,'UPDATE tenants SET revision=revision+1 WHERE id=?',m.tenant_id),audit(db,m.tenant_id,m.id,kind+'_created',key)]);return c.json({id:key},201);
  });
  merchant.patch('/'+kind+'/:id',async c=>{
    const m=owner(c),b=await c.req.json<Row>(),key=c.req.param('id'),db=c.env.DB,current=await stmt(db,`SELECT * FROM ${kind} WHERE tenant_id=? AND id=?`,m.tenant_id,key).first<Row>();if(!current) fail(404,'not_found');
    const v={...current,...b},name=str(v.name,100),active=flag(v.active);
    const q=kind==='services'?stmt(db,'UPDATE services SET name=?,active=?,duration_min=?,buffer_min=?,price_centimes=? WHERE tenant_id=? AND id=?',name,active,integer(v.duration_min,5,240,5),integer(v.buffer_min,0,60,5),integer(v.price_centimes,0,10000000),m.tenant_id,key):stmt(db,'UPDATE resources SET name=?,active=? WHERE tenant_id=? AND id=?',name,active,m.tenant_id,key);
    await db.batch([q,stmt(db,'UPDATE tenants SET revision=revision+1 WHERE id=?',m.tenant_id),audit(db,m.tenant_id,m.id,kind+'_updated',key)]);return c.json({ok:true});
  });
}
merchant.put('/assignments',async c=>{
  const m=owner(c),b=await c.req.json<Row>(),db=c.env.DB;if(!Array.isArray(b.assignments)||b.assignments.length>100) fail(400,'invalid_assignments');
  const q=[stmt(db,'DELETE FROM service_resources WHERE tenant_id=?',m.tenant_id)];
  for(const a of b.assignments) q.push(stmt(db,'INSERT INTO service_resources VALUES (?,?,?)',m.tenant_id,str(a.service_id),str(a.resource_id)));
  q.push(stmt(db,'UPDATE tenants SET revision=revision+1 WHERE id=?',m.tenant_id),audit(db,m.tenant_id,m.id,'assignments_updated'));try{await db.batch(q);}catch{fail(400,'invalid_assignments');}return c.json({ok:true});
});
merchant.put('/hours',async c=>{
  const m=owner(c),b=await c.req.json<Row>(),db=c.env.DB;if(!Array.isArray(b.hours)||b.hours.length>70) fail(400,'invalid_hours');
  const q=[stmt(db,'DELETE FROM weekly_hours WHERE tenant_id=?',m.tenant_id)];
  for(const h of b.hours){const start=integer(h.start_min,0,1435,5),end=integer(h.end_min,5,1440,5);if(end<=start) fail(400,'invalid_hours');q.push(stmt(db,'INSERT INTO weekly_hours VALUES (?,?,?,?,?,?)',id(),m.tenant_id,str(h.resource_id),integer(h.weekday,0,6),start,end));}
  q.push(stmt(db,'UPDATE tenants SET revision=revision+1 WHERE id=?',m.tenant_id),audit(db,m.tenant_id,m.id,'hours_updated'));try{await db.batch(q);}catch{fail(400,'invalid_hours');}return c.json({ok:true});
});
merchant.post('/blackouts',async c=>{
  const m=owner(c),b=await c.req.json<Row>(),db=c.env.DB,key=id(),start=integer(b.starts_at,0,9000000000000),end=integer(b.ends_at,start+1,9000000000000);
  try{await db.batch([stmt(db,'INSERT INTO blackouts VALUES (?,?,?,?,?)',key,m.tenant_id,b.resource_id?str(b.resource_id):null,start,end),stmt(db,'UPDATE tenants SET revision=revision+1 WHERE id=?',m.tenant_id),audit(db,m.tenant_id,m.id,'blackout_created',key)]);}catch{fail(400,'invalid_resource');}return c.json({id:key},201);
});
merchant.delete('/blackouts/:id',async c=>{const m=owner(c),db=c.env.DB;await db.batch([stmt(db,'DELETE FROM blackouts WHERE tenant_id=? AND id=?',m.tenant_id,c.req.param('id')),stmt(db,'UPDATE tenants SET revision=revision+1 WHERE id=?',m.tenant_id),audit(db,m.tenant_id,m.id,'blackout_deleted',c.req.param('id'))]);return c.json({ok:true});});
