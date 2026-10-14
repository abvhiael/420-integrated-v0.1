import {AuthError,record} from './auth.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const fail=(code,status=403)=>{throw new AuthError(code,status);};
const outcomes=new Set(['REMEDIATION_REQUIRED','REJECTED','APPROVED','REVOKED']);
const reasons=new Set(['licence_missing','insurance_missing','registration_missing','inspection_missing','background_check_missing','document_expired','document_invalid','transport_authority_pending','safety_review']);
export function createDriverOnboardingReviewService({authenticator,store,verifyIndependentDecision,clock=()=>Math.floor(Date.now()/1000)}){
 if(!authenticator?.authorize||!store?.read||!store?.writeCAS||typeof verifyIndependentDecision!=='function')fail('REVIEW_AUTHORITY_UNAVAILABLE',503);
 return Object.freeze({async decide(token,input){
  record(input,['driverId','commandId','expectedRevision','attestation']);
  if(!id(input.driverId)||!id(input.commandId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1||typeof input.attestation!=='string'||input.attestation.length>32768)fail('INVALID_REVIEW',400);
  const scope={action:'onboarding.review',resource:'account:'+input.driverId};
  const actor=await authenticator.authorize(token,scope);
  if(actor?.role!=='operator'||!id(actor.subject)||actor.subject===input.driverId||actor.expiresAt<=clock())fail('REVIEW_SCOPE_DENIED');
  const current=await store.read(input.driverId);
  if(!current||current.revision!==input.expectedRevision)fail('STALE_REVISION',409);
  let proof;try{proof=await verifyIndependentDecision(input.attestation,{driverId:input.driverId,vehicleId:current.vehicleId,revision:current.revision,accountId:current.accountId});}
  catch{fail('REVIEW_PROOF_UNAVAILABLE',503);}
  if(!proof||!outcomes.has(proof.status)||proof.driverId!==input.driverId||proof.vehicleId!==current.vehicleId||proof.revision!==current.revision||
     !Array.isArray(proof.remediation)||proof.remediation.length>10||proof.remediation.some(x=>!reasons.has(x))||!id(proof.authorityRef)||!Number.isSafeInteger(proof.expiresAt)||proof.expiresAt<=clock())
     fail('INVALID_REVIEW_PROOF');
  if(proof.status==='APPROVED'&&proof.remediation.length)fail('INVALID_REVIEW_PROOF');
  const next={...current,revision:current.revision+1,status:proof.status,remediation:[...proof.remediation]};
  const fresh=await authenticator.authorize(token,scope);
  if(fresh.role!=='operator'||fresh.subject!==actor.subject||fresh.accountId!==actor.accountId||fresh.expiresAt<=clock())fail('REVIEW_SCOPE_DENIED');
  const ok=await store.writeCAS(input.driverId,input.expectedRevision,input.commandId,next);
  if(!ok)fail('STALE_OR_DUPLICATE',409);
  return Object.freeze({driverId:input.driverId,revision:next.revision,status:next.status,remediation:next.remediation});
 }});
}
