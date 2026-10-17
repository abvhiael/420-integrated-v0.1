import {AuthError} from './auth.mjs';
const deny=(code,status=403)=>{throw new AuthError(code,status)};
const id=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(s);
const purposes=Object.freeze({location_history:'locationHistoryConsent',marketing:'marketingConsent',trip_notifications:'tripNotifications'});
/** Trusted backend boundary: dynamic Identity/session authorization and durable consent on every access. */
export function createIdentityConsentGuard({authenticator,preferences,clock=()=>Math.floor(Date.now()/1000)}){
 if(typeof authenticator?.authorize!=='function'||typeof preferences?.read!=='function')deny('CONSENT_GUARD_UNAVAILABLE',503);
 return Object.freeze({
  async require({token,accountId,purpose,action='account.preferences'}){
   if(typeof token!=='string'||!token||!id(accountId)||!Object.hasOwn(purposes,purpose)||action!=='account.preferences')deny('CONSENT_REQUEST_INVALID',400);
   const now=clock();if(!Number.isSafeInteger(now)||now<0)deny('CONSENT_CLOCK_INVALID',503);
   // Fresh remote Identity/session proof must be evaluated before and after asynchronous storage access.
   let actor;
   try{actor=await authenticator.authorize(token,{action,resource:'account:'+accountId})}
   catch{deny('CONSENT_IDENTITY_DENIED')}
   if(actor?.role!=='rider'||actor.accountId!==accountId||actor.action!==action||
      actor.resource!=='account:'+accountId||!id(actor.subject)||!id(actor.sessionId)||
      !Number.isSafeInteger(actor.expiresAt)||actor.expiresAt<=now)deny('CONSENT_IDENTITY_DENIED');
   let entry;
   try{entry=await preferences.read(token,accountId)}catch{deny('CONSENT_STORE_UNAVAILABLE',503)}
   if(!entry||!Number.isSafeInteger(entry.revision)||entry.revision<0||
      entry.preferences?.[purposes[purpose]]!==true)deny('CONSENT_REQUIRED');
   let current;
   try{current=await authenticator.authorize(token,{action,resource:'account:'+accountId})}
   catch{deny('CONSENT_IDENTITY_DENIED')}
   const after=clock();
   if(!Number.isSafeInteger(after)||after<now||current?.subject!==actor.subject||
      current?.accountId!==actor.accountId||current?.sessionId!==actor.sessionId||
      current?.deviceId!==actor.deviceId||current?.recoveryEpoch!==actor.recoveryEpoch||
      current?.role!==actor.role||!Number.isSafeInteger(current.expiresAt)||
      current.expiresAt<=after)deny('CONSENT_SESSION_CHANGED');
   return Object.freeze({accountId,subject:current.subject,purpose,consentRevision:entry.revision,expiresAt:current.expiresAt});
  }
 });
}
