import {AuthError,record} from './auth.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const deny=(code,status=400)=>{throw new AuthError(code,status);};
const statuses=new Set(['PENDING','REVIEW_REQUIRED','REMEDIATION_REQUIRED','APPROVED','REJECTED','REVOKED']);
const kinds=new Set(['licence','insurance','registration','inspection','background_check']);
export function validateOnboarding(input){
 record(input,['driverId','vehicleId','documents','commandId','expectedRevision']);
 if(!id(input.driverId)||!id(input.vehicleId)||!id(input.commandId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||!Array.isArray(input.documents)||input.documents.length>5)deny('INVALID_ONBOARDING');
 const seen=new Set();
 const documents=input.documents.map(d=>{
  record(d,['kind','privateRef','expiresAt']);
  if(!kinds.has(d.kind)||seen.has(d.kind)||!id(d.privateRef)||!Number.isSafeInteger(d.expiresAt)||d.expiresAt<=0)deny('INVALID_DOCUMENT');
  seen.add(d.kind);
  return Object.freeze({kind:d.kind,privateRef:d.privateRef,expiresAt:d.expiresAt});
 });
 return Object.freeze({driverId:input.driverId,vehicleId:input.vehicleId,commandId:input.commandId,expectedRevision:input.expectedRevision,documents:Object.freeze(documents)});
}
export function createDriverOnboardingService({authenticator,store,clock=()=>Math.floor(Date.now()/1000)}){
 if(typeof authenticator?.authorize!=='function'||typeof store?.read!=='function'||typeof store?.writeCAS!=='function')deny('ONBOARDING_UNAVAILABLE',503);
 const authorize=async(token,driverId)=>{
  if(!id(driverId))deny('INVALID_DRIVER');
  const p=await authenticator.authorize(token,{action:'onboarding.manage',resource:'account:'+driverId});
  if(p?.role!=='driver'||p.subject!==driverId||!id(p.accountId)||!Number.isSafeInteger(p.expiresAt)||p.expiresAt<=clock())deny('ONBOARDING_SCOPE_DENIED',403);
  return p;
 };
 return Object.freeze({
  async read(token,driverId){
   await authorize(token,driverId);
   const item=await store.read(driverId);
   if(!item)return Object.freeze({driverId,revision:0,status:'PENDING',documents:[],remediation:[]});
   if(!statuses.has(item.status))deny('CORRUPT_ONBOARDING',503);
   // Never expose storage keys, privateRef values or document contents to the browser.
   return Object.freeze({driverId,revision:item.revision,status:item.status,vehicleId:item.vehicleId,
    documents:item.documents.map(d=>({kind:d.kind,expiresAt:d.expiresAt,status:d.expiresAt<=clock()?'EXPIRED':'SUBMITTED'})),
    remediation:item.remediation??[]});
  },
  async submit(token,input){
   const data=validateOnboarding(input);
   const p=await authorize(token,data.driverId);
   if(data.documents.some(d=>d.expiresAt<=clock()))deny('DOCUMENT_EXPIRED');
   const prior=await store.read(data.driverId);
   if(prior&&['APPROVED','REVOKED'].includes(prior.status))deny('EXTERNAL_REVIEW_REQUIRED',403);
   const row={driverId:data.driverId,accountId:p.accountId,vehicleId:data.vehicleId,documents:data.documents,status:'REVIEW_REQUIRED',remediation:[],revision:data.expectedRevision+1};
   const ok=await store.writeCAS(data.driverId,data.expectedRevision,data.commandId,row);
   if(!ok)deny('STALE_OR_DUPLICATE',409);
   return Object.freeze({driverId:data.driverId,revision:row.revision,status:row.status});
  }
 });
}
