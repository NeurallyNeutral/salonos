import assert from 'node:assert/strict';
export function client(mf, headers={}) { return async (path, body, method=body===undefined?'GET':'POST', extra={})=>{
  const r=await mf.dispatchFetch('http://localhost'+path,{method,headers:{Origin:'http://localhost',...(body===undefined?{}:{'Content-Type':'application/json'}),...headers,...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
  let data;try{data=await r.json();}catch{data=null;}return {status:r.status,data,headers:r.headers};
};}
export async function login(mf,db,address='atlas@example.invalid'){
  const api=client(mf);assert.equal((await api('/auth/request',{email:address})).status,200);
  assert.equal((await api('/dev/process',{})).status,200);
  const {token}=await db.prepare('SELECT token FROM mock_mail WHERE recipient=? ORDER BY created_at DESC LIMIT 1').bind(address).first();
  const result=await api('/auth/consume',{token});assert.equal(result.status,200);
  const cookie=result.headers.get('set-cookie').split(';')[0];const session=await client(mf,{Cookie:cookie})('/merchant/session');
  return {api:client(mf,{Cookie:cookie,'X-CSRF-Token':session.data.csrf}),cookie,csrf:session.data.csrf,token};
}
