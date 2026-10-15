// R06.6 server authority: sessions are never verified or issued by the browser.
const deny=c=>{throw Object.assign(new Error(c),{code:c});};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
export function createHighCountryRoutineAuthority420({verifyIdentity,verifySession,verifyEscalation,approvedActions,operationJournal,clock=Date.now}={}){
 if(typeof verifyIdentity!=='function'||typeof verifySession!=='function'||typeof verifyEscalation!=='function'||
 !approvedActions||typeof approvedActions!=='object'||typeof operationJournal?.claim!=='function'||typeof clock!=='function')deny('r066-config-invalid');
 const map=new Map(Object.entries(approvedActions));
 for(const [name,policy] of map){
  if(!id(name)||!policy||typeof policy.execute!=='function'||
    !['routine','sensitive'].includes(policy.classification)||
    (policy.classification==='routine'&&policy.value!==0))deny('r066-policy-invalid');
 }
 const pending=new Set();
 async function invoke({token,sessionId,action,operation,body={},escalation=null}={}){
  if(!id(sessionId)||!id(action)||!id(operation)||!map.has(action)||
   !body||typeof body!=='object'||Array.isArray(body))deny('r066-request-denied');
  const policy=map.get(action);
  const principal=await verifyIdentity(token);
  if(!id(principal))deny('r066-identity-denied');
  const granted=await verifySession({principal,sessionId,action,operation,at:clock()});
  if(!granted||granted.active!==true||granted.revoked===true||
   !Number.isSafeInteger(granted.expiresAt)||granted.expiresAt<=clock()||
   granted.principal!==principal||granted.sessionId!==sessionId||
   !Array.isArray(granted.actions)||!granted.actions.includes(action))deny('r066-session-invalid');
  if(policy.classification==='sensitive'){
   if(!escalation||!['wallet','passkey'].includes(escalation.kind)||
    await verifyEscalation({principal,sessionId,action,operation,escalation})!==true)
    deny('r066-sensitive-escalation-required');
  }else if(escalation!==null)deny('r066-unexpected-escalation');
  const key=JSON.stringify([principal,sessionId,operation]);
  if(pending.has(key))deny('r066-duplicate-operation');
  pending.add(key);
  try{
   // A second authority check immediately before executing defeats in-flight revocation/expiry.
   if(await verifyIdentity(token)!==principal)deny('r066-identity-revoked');
   const latest=await verifySession({principal,sessionId,action,operation,at:clock()});
   if(!latest||latest.active!==true||latest.revoked===true||!Number.isSafeInteger(latest.expiresAt)||latest.expiresAt<=clock()||
    latest.principal!==principal||latest.sessionId!==sessionId||
    !Array.isArray(latest.actions)||!latest.actions.includes(action))
    deny('r066-session-revoked');
   const claimed=await operationJournal.claim({principal,sessionId,operation,action});
   if(claimed!==true)deny('r066-replay-denied');
   return await policy.execute({principal,sessionId,operation,body,
    authorization:{classification:policy.classification,value:policy.value}});
  }finally{pending.delete(key);}
 }
 return Object.freeze({invoke});
}
