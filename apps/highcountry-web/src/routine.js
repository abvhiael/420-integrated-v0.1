// R06.6 browser: never mints a routine token or supplies caller-owned authorization facts.
const deny=c=>{throw Object.assign(new Error(c),{code:c});};
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
export function createHighCountryRoutineClient420({apiUrl,authenticate,fetchImpl=fetch,escalate}={}){
 if(typeof apiUrl!=='string'||!/^https:\/\/[^/?#]+$/.test(apiUrl)||
 typeof authenticate!=='function'||typeof fetchImpl!=='function')deny('r066-client-config-invalid');
 const active=new Set();
 async function invoke({sessionId,action,operation,body={},sensitive=false}={}){
  if(![sessionId,action,operation].every(valid)||!body||typeof body!=='object'||
   Array.isArray(body)||active.has(operation))deny('r066-client-request-invalid');
  active.add(operation);
  try{
   const token=await authenticate();
   if(typeof token!=='string'||!token||token.length>4096||/\s/.test(token))deny('r066-auth-required');
   let escalation=null;
   if(sensitive){
    if(typeof escalate!=='function')deny('r066-escalation-unavailable');
    escalation=await escalate({sessionId,action,operation});
    if(!escalation||!['wallet','passkey'].includes(escalation.kind))deny('r066-escalation-denied');
   }
   let response;try{response=await fetchImpl(new URL('/v1/routine/execute',apiUrl+'/'),{
    method:'POST',credentials:'omit',cache:'no-store',
    headers:{authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify({sessionId,action,operation,body,escalation})});
   }catch{deny('r066-service-unavailable');}
   if(!response?.ok)deny(response?.status===401||response?.status===403?'r066-authority-denied':'r066-service-unavailable');
   let result;try{result=await response.json();}catch{deny('r066-response-invalid');}
   if(result?.ok!==true||!Object.hasOwn(result,'result'))deny('r066-response-invalid');
   return result.result;
  }finally{active.delete(operation);}
 }
 return Object.freeze({invoke});
}
