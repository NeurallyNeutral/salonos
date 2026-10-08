import { Env, Row, stmt, rows, fail, hmac, equal, now } from './core';
export const CELL=300000;
export const displayTime=(time:number,zone:string)=>new Intl.DateTimeFormat('fr-MA',{timeZone:zone,dateStyle:'medium',timeStyle:'short'}).format(time);
const formatters=new Map<string,Intl.DateTimeFormat>();
export function localParts(time:number,zone:string) {
  let f=formatters.get(zone);if(!f){f=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});formatters.set(zone,f);}
  const p=Object.fromEntries(f.formatToParts(time).map(v=>[v.type,v.value]));const date=`${p.year}-${p.month}-${p.day}`;
  return {date,minute:Number(p.hour)*60+Number(p.minute),weekday:new Date(date+'T12:00:00Z').getUTCDay()};
}
export async function tenantBySlug(env:Env,slug:string):Promise<Row>{const t=await stmt(env.DB,'SELECT * FROM tenants WHERE slug=? AND active=1',slug).first<Row>();if(!t) fail(404,'not_found');return t;}
export async function schedule(env:Env,t:Row,serviceId:string) {
  const service=await stmt(env.DB,'SELECT * FROM services WHERE tenant_id=? AND id=? AND active=1',t.id,serviceId).first<Row>();if(!service) fail(400,'invalid_service');
  const resources=await rows(env.DB,'SELECT r.* FROM resources r JOIN service_resources sr ON sr.tenant_id=r.tenant_id AND sr.resource_id=r.id WHERE r.tenant_id=? AND sr.service_id=? AND r.active=1',t.id,serviceId);
  const hours=await rows(env.DB,'SELECT * FROM weekly_hours WHERE tenant_id=?',t.id);return {service,resources,hours};
}
export function fits(t:Row,s:Row,hours:Row[],resource:string,start:number,clock=now()):boolean {
  if(!Number.isSafeInteger(start)||start%CELL||start<clock+t.cutoff_min*60000||start>clock+t.horizon_days*86400000)return false;
  const first=localParts(start,t.timezone);
  for(let cell=start;cell<start+(s.duration_min+s.buffer_min)*60000;cell+=CELL){const p=localParts(cell,t.timezone),last=localParts(cell+CELL-1,t.timezone);if(p.date!==first.date||last.date!==first.date||!hours.some(h=>h.resource_id===resource&&h.weekday===p.weekday&&p.minute>=h.start_min&&last.minute<h.end_min))return false;}
  return true;
}
export async function offers(env:Env,t:Row,serviceId:string,date:string,manual=false) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)fail(400,'invalid_date');
  if(t.paused&&!manual)return [];
  const {service,resources,hours}=await schedule(env,t,serviceId),midnight=Date.parse(date+'T00:00:00Z');
  if(midnight<now()-86400000||midnight>now()+(t.horizon_days+1)*86400000)return [];
  const lower=midnight-14*3600000,upper=midnight+38*3600000;
  const claims=await rows(env.DB,'SELECT resource_id,slot_utc FROM booking_claims WHERE tenant_id=? AND slot_utc BETWEEN ? AND ?',t.id,lower,upper);
  const occupied=new Set(claims.map(r=>r.resource_id+':'+r.slot_utc));
  const blocked=await rows(env.DB,'SELECT * FROM blackouts WHERE tenant_id=? AND starts_at<? AND ends_at>?',t.id,upper,lower);
  const result=[];
  for(const resource of resources)for(let start=lower;start<upper;start+=CELL){
    if(localParts(start,t.timezone).date!==date||!fits(t,service,hours,resource.id,start))continue;
    const end=start+(service.duration_min+service.buffer_min)*60000;
    if(blocked.some(b=>(!b.resource_id||b.resource_id===resource.id)&&b.starts_at<end&&b.ends_at>start))continue;
    let clash=false;for(let cell=start;cell<end;cell+=CELL)if(occupied.has(resource.id+':'+cell)){clash=true;break;}if(clash)continue;
    const payload={tenant_id:t.id,service_id:serviceId,resource_id:resource.id,starts_at:start,revision:t.revision,expires_at:now()+600000,manual};
    const data=btoa(JSON.stringify(payload)),signature=await hmac(env.APP_SECRET,'offer:'+data);
    result.push({starts_at:start,ends_at:start+service.duration_min*60000,resource_id:resource.id,resource_name:resource.name,label:new Intl.DateTimeFormat('fr-MA',{timeZone:t.timezone,hour:'2-digit',minute:'2-digit',timeZoneName:'shortOffset'}).format(start),offer:data+'.'+signature});
  }
  return result.sort((a,b)=>a.starts_at-b.starts_at);
}
export async function verifyOffer(env:Env,t:Row,value:unknown,manual=false) {
  if(typeof value!=='string'||value.length>2000)fail(400,'invalid_offer');const [data,signature]=value.split('.');if(!signature||!equal(signature,await hmac(env.APP_SECRET,'offer:'+data)))fail(400,'invalid_offer');
  let p:Row;try{p=JSON.parse(atob(data));}catch{fail(400,'invalid_offer');}
  if(p.tenant_id!==t.id||p.expires_at<now()||p.revision!==t.revision||(!manual&&p.manual)||(!manual&&t.paused))fail(409,'stale_offer');
  const {service,resources,hours}=await schedule(env,t,p.service_id);if(!resources.some(r=>r.id===p.resource_id)||!fits(t,service,hours,p.resource_id,p.starts_at))fail(409,'unavailable');
  const end=p.starts_at+(service.duration_min+service.buffer_min)*60000;
  if(await stmt(env.DB,'SELECT id FROM blackouts WHERE tenant_id=? AND (resource_id IS NULL OR resource_id=?) AND starts_at<? AND ends_at>?',t.id,p.resource_id,end,p.starts_at).first())fail(409,'unavailable');return {p,service,end};
}
