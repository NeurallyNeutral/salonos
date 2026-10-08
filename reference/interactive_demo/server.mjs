import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8787);
const seed = () => ({
  tenant: { id:'t_baddie', slug:'baddie-spot', name:'Baddie Spot', paused:false },
  services: [
    { id:'s_lobe', name:'Piercing lobe', duration_min:20, price_mad:60 },
    { id:'s_helix', name:'Piercing helix', duration_min:25, price_mad:90 },
    { id:'s_lash', name:'Lash clusters', duration_min:50, price_mad:120 }
  ],
  bookings: [],
  events: []
});
let db = seed();

function json(res, status, body){
  const data = JSON.stringify(body, null, 2);
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(data),'access-control-allow-origin':'*'});
  res.end(data);
}
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>s+=c);req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}});req.on('error',reject)})}
function addEvent(kind, subject, detail){db.events.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),kind,subject,detail})}
function slots(date){return ['10:00','10:30','11:00','12:00','14:00','15:00','16:30','17:30'].map(time=>({date,time,available:true}))}

const server = http.createServer(async (req,res)=>{
  const u = new URL(req.url, `http://${req.headers.host}`);
  if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'});return res.end()}
  try{
    if(u.pathname==='/api/health') return json(res,200,{ok:true,service:'salonos-full-demo-api',runtime:'node',time:new Date().toISOString()});
    if(u.pathname==='/api/state' && req.method==='GET') return json(res,200,db);
    if(u.pathname==='/api/reset' && req.method==='POST'){db=seed();addEvent('reset','platform','Demo API reset');return json(res,200,{ok:true})}
    if(u.pathname==='/api/baddie-spot/services' && req.method==='GET') return json(res,200,{results:db.services});
    if(u.pathname==='/api/baddie-spot/availability' && req.method==='GET') return json(res,200,{date:u.searchParams.get('date'),results:slots(u.searchParams.get('date')||new Date().toISOString().slice(0,10))});
    if(u.pathname==='/api/baddie-spot/book' && req.method==='POST'){
      if(db.tenant.paused) return json(res,409,{error:'booking_paused'});
      const b=await body(req); const svc=db.services.find(s=>s.id===b.service_id); if(!svc) return json(res,400,{error:'invalid_service'});
      const booking={id:crypto.randomUUID(),service_id:svc.id,starts_at:b.starts_at,customer_name:b.customer_name,customer_phone:b.customer_phone,source:b.source||'direct',status:'confirmed',manage_token:crypto.randomBytes(24).toString('hex')};
      db.bookings.push(booking);addEvent('booking_created',booking.id,`service=${svc.id}; source=${booking.source}`);return json(res,201,{ok:true,booking});
    }
    const m=u.pathname.match(/^\/api\/bookings\/([^/]+)\/status$/);
    if(m && req.method==='POST'){const b=db.bookings.find(x=>x.id===m[1]);if(!b)return json(res,404,{error:'not_found'});const p=await body(req);b.status=p.status;addEvent('booking_status_changed',b.id,b.status);return json(res,200,{ok:true,booking:b})}
    if(u.pathname==='/api/cron/run' && req.method==='POST'){addEvent('cron_run','reminders','Demo cron scan completed');return json(res,200,{ok:true,queued:db.bookings.filter(b=>b.status==='confirmed').length})}
    if(u.pathname.startsWith('/api/')) return json(res,404,{error:'not_found'});
    const index=fs.readFileSync(path.join(__dirname,'index.html'));
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-length':index.length});res.end(index);
  } catch(err){json(res,500,{error:'internal_error',message:String(err.message||err)})}
});
server.listen(port,()=>console.log(`SalonOS full product demo: http://localhost:${port}`));
