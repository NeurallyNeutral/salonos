import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import { App, Env, fail, local, rows, unseal, hmac, equal, stmt, audit } from './core';
import { auth, merchant } from './auth';
import './config';
import { publicApi, manageApi } from './bookings';
import { webhooks, processOutbox } from './delivery';
import { messageText } from './providers';
import './workflows';
import './loyalty';
import html from '../web/index.html';
import css from '../web/app.css';
import javascript from '../web/app.txt';

const app = new Hono<App>();
app.use('*',bodyLimit({maxSize:16384,onError:c=>c.json({error:'body_too_large'},413)}));
app.use('*',async(c,next)=>{
  c.header('X-Content-Type-Options','nosniff');c.header('Referrer-Policy','no-referrer');c.header('X-Frame-Options','DENY');c.header('Cache-Control','no-store');
  c.header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if (!['GET','HEAD'].includes(c.req.method) && !c.req.path.startsWith('/webhooks/')) {
    if(c.req.header('Origin')!==new URL(c.env.APP_BASE_URL).origin) fail(403,'invalid_origin');
    if(!c.req.header('Content-Type')?.startsWith('application/json')) fail(400,'json_required');
  }
  await next();
});
app.onError((err,c)=>{ if(err instanceof HTTPException) return c.json({error:err.message},err.status); if(err instanceof SyntaxError) return c.json({error:'invalid_json'},400); console.error(JSON.stringify({event:'request_failed',request_id:crypto.randomUUID()}));return c.json({error:'internal_error'},500); });
app.notFound(c=>c.json({error:'not_found'},404));
app.get('/health',c=>c.json({ok:true,service:'SalonOS'}));
app.get('/ready',async c=>{try {await c.env.DB.prepare('SELECT id FROM tenants LIMIT 1').first();return c.json({ok:true,environment:c.env.ENVIRONMENT});}catch{return c.json({ok:false},503);}});
app.route('/auth',auth);app.route('/merchant',merchant);
app.route('/public',publicApi);app.route('/manage-api',manageApi);
app.route('/webhooks',webhooks);
app.post('/unsubscribe',async c=>{const b=await c.req.json();if(typeof b.customer_id!=='string'||typeof b.signature!=='string'||!equal(b.signature,await hmac(c.env.APP_SECRET,'unsubscribe:'+b.customer_id)))fail(404,'not_found');await stmt(c.env.DB,'UPDATE customers SET suppressed=1 WHERE id=?',b.customer_id).run();return c.json({ok:true});});
app.post('/dev/process',async c=>{if(!local(c))fail(404,'not_found');return c.json(await processOutbox(c.env));});
app.get('/dev/messages',async c=>{if(!local(c))fail(404,'not_found');const messages=await rows(c.env.DB,'SELECT d.*,o.kind,o.state FROM mock_deliveries d JOIN notification_outbox o ON o.id=d.outbox_id ORDER BY d.created_at DESC LIMIT 100');return c.json({mode:'MOCK',messages:await Promise.all(messages.map(async m=>({...m,payload_cipher:undefined,text:messageText(m,await unseal(c.env.APP_SECRET,m.payload_cipher))})))});});
app.get('/dev/inbox',async c=>{if(!local(c)) fail(404,'not_found');return c.json({mode:'MOCK — local uniquement',mail:await rows(c.env.DB,'SELECT * FROM mock_mail ORDER BY created_at DESC LIMIT 50')});});
app.get('/app-config',c=>c.json({local:local(c),locale:'fr'}));
app.get('/app.css',c=>{c.header('Content-Type','text/css; charset=utf-8');return c.body(css);});
app.get('/app.js',c=>{c.header('Content-Type','application/javascript; charset=utf-8');return c.body(javascript);});
for(const path of ['/','/login','/dashboard','/manual','/manage','/inbox','/privacy','/unsubscribe','/book/:slug'])app.get(path,c=>c.html(html));
export default {fetch:app.fetch,async scheduled(_event:ScheduledEvent,env:Env,_ctx:ExecutionContext) {await processOutbox(env);}};
