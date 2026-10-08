import { Env, Row, id, stmt, now, seal, hmac } from './core';
export async function expireCredits(env:Env,tenantId:string|null=null){await stmt(env.DB,"INSERT OR IGNORE INTO loyalty_ledger(id,tenant_id,customer_id,payment_id,kind,amount_centimes,reference_id,event_key,created_at) SELECT 'expire:'||id,tenant_id,customer_id,payment_id,'expire',-remaining,id,'expire:'||id,? FROM loyalty_lots WHERE expires_at IS NOT NULL AND expires_at<=? AND remaining>0 AND (? IS NULL OR tenant_id=?)",now(),now(),tenantId,tenantId).run();}
export async function retentionMessage(env:Env,t:Row,b:Row,kind:string,eventKey:string,due=now()) {
  const customer=(await stmt(env.DB,'SELECT * FROM customers WHERE tenant_id=? AND id=?',t.id,b.customer_id).first<Row>())!;
  const channel=b.consent_whatsapp?'whatsapp':'email',consent=b.consent_whatsapp||b.consent_email;
  const payload=await seal(env.APP_SECRET,{recipient:channel==='whatsapp'?customer.phone:customer.email,fallback_recipient:channel==='whatsapp'&&b.consent_email?customer.email:null,tenant_name:t.name,review_url:t.review_url,booking_url:env.APP_BASE_URL+'/book/'+t.slug,unsubscribe_url:env.APP_BASE_URL+'/unsubscribe#'+customer.id+'.'+await hmac(env.APP_SECRET,'unsubscribe:'+customer.id)});
  return stmt(env.DB,"INSERT OR IGNORE INTO notification_outbox(id,tenant_id,booking_id,customer_id,kind,channel,event_key,payload_cipher,state,due_at,expires_at,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE ?!='review' OR EXISTS(SELECT 1 FROM reviews_prompt_events WHERE tenant_id=? AND customer_id=? AND booking_id=?)",id(),t.id,b.id,b.customer_id,kind,channel,eventKey,payload,consent&&b.consent_marketing&&t.marketing_enabled?'pending':'suppressed',due,due+7*86400000,now(),kind,t.id,b.customer_id,b.id);
}
export async function completedMessages(env:Env,t:Row,b:Row) {
  const q:D1PreparedStatement[]=[];
  // No satisfaction input, review reward or positive-only branch exists.
  if(t.reviews_enabled&&t.review_url&&t.marketing_enabled&&b.consent_marketing){
    q.push(stmt(env.DB,"INSERT OR IGNORE INTO reviews_prompt_events SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM bookings WHERE tenant_id=? AND customer_id=? AND status='completed' AND id!=?)",t.id,b.customer_id,b.id,now(),t.id,b.customer_id,b.id));
    const message=await retentionMessage(env,t,b,'review','review:first:'+b.customer_id);q.push(message);
  }
  if(t.rebooking_days>0)q.push(await retentionMessage(env,t,b,'rebooking','rebooking:'+b.id,now()+t.rebooking_days*86400000));
  return q;
}
