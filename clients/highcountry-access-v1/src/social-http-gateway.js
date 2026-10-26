// Same-origin browser adapter to the existing authenticated High Country runtime.
export function createSocialHttpGateway({baseUrl='',getSession,fetchImpl=fetch}){
 if(typeof getSession!=='function'||typeof fetchImpl!=='function')throw new TypeError('session and transport required');
 const post=async(path,payload)=>{
  const token=await getSession();if(typeof token!=='string'||!token)throw new Error('authenticated session required');
  const r=await fetchImpl(baseUrl+'/social/'+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},credentials:'same-origin',body:JSON.stringify(payload)});
  const body=await r.json();if(!r.ok||body?.ok!==true)throw new Error(body?.error||'social gateway denied');
  return body.result;
 };
 return Object.freeze({
  authenticate:session=>post('authenticate',{}),
  snapshot:ctx=>post('snapshot',{scope:ctx.scope}),
  authorize:ctx=>post('authorize',{principal:ctx.principal,scope:ctx.scope,action:ctx.action,payload:ctx.payload}),
  submit:ctx=>post('submit',{principal:ctx.principal,scope:ctx.scope,action:ctx.action,payload:ctx.payload,authorizationProof:ctx.authorizationProof}),
  receipt:ctx=>post('receipt',{scope:ctx.scope,operationId:ctx.operationId}),
  history:ctx=>post('history',{scope:ctx.scope,kind:ctx.kind,id:ctx.id,cursor:ctx.cursor??null})
 });
}
