// Same-origin browser adapter to the existing authenticated High Country runtime.
export function createSocialHttpGateway({baseUrl='',getSession,signTransaction,fetchImpl=fetch}){
 if(typeof getSession!=='function'||typeof signTransaction!=='function'||typeof fetchImpl!=='function')throw new TypeError('session and transport required');
 const intents=new Map();
 const post=async(path,payload)=>{
  const token=await getSession();if(typeof token!=='string'||!token)throw new Error('authenticated session required');
  const r=await fetchImpl(baseUrl+'/social/'+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},credentials:'same-origin',body:JSON.stringify(payload)});
  const body=await r.json();if(!r.ok||body?.ok!==true)throw new Error(body?.error||'social gateway denied');
  return body.result;
 };
 return Object.freeze({
  authenticate:session=>post('authenticate',{}),
  snapshot:ctx=>post('snapshot',{scope:ctx.scope}),
  authorize:async ctx=>{
   const permit=await post('authorize',{principal:ctx.principal,scope:ctx.scope,action:ctx.action,payload:ctx.payload});
   if(permit?.allowed!==true||!permit.proof||!permit.transaction)throw new Error('canonical transaction intent required');
   intents.set(permit.proof,permit.transaction);return permit;
  },
  submit:async ctx=>{
   const intent=intents.get(ctx.authorizationProof);intents.delete(ctx.authorizationProof);
   if(!intent)throw new Error('wallet signing intent missing');
   // The wallet owns signing. Do not transmit private keys or accept backend-generated consent.
   const signedRawTransaction=await signTransaction(Object.freeze({...intent}));
   if(typeof signedRawTransaction!=='string'||!/^0x[0-9a-fA-F]+$/.test(signedRawTransaction))throw new Error('signed wallet transaction required');
   return post('submit',{principal:ctx.principal,scope:ctx.scope,action:ctx.action,payload:ctx.payload,authorizationProof:ctx.authorizationProof,signedRawTransaction});
  },
  receipt:ctx=>post('receipt',{scope:ctx.scope,operationId:ctx.operationId}),
  history:ctx=>post('history',{scope:ctx.scope,kind:ctx.kind,id:ctx.id,cursor:ctx.cursor??null})
 });
}
