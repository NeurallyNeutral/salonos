import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import { App, Env, fail, local, rows } from './core';
import { auth, merchant } from './auth';
import './config';

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
app.get('/dev/inbox',async c=>{if(!local(c)) fail(404,'not_found');return c.json({mode:'MOCK — local uniquement',mail:await rows(c.env.DB,'SELECT * FROM mock_mail ORDER BY created_at DESC LIMIT 50')});});
app.get('/',c=>c.text('SalonOS — interface en cours de construction'));
export default {fetch:app.fetch,async scheduled(_event:ScheduledEvent,_env:Env,_ctx:ExecutionContext) {}};
