// BG-19.13: service-read recovery only. Never retry Wallet writes or private message sends.
export const RETRYABLE_READ_CODES=Object.freeze(new Set(['NETWORK_UNAVAILABLE','SERVICE_UNAVAILABLE','RATE_LIMITED']));
export function retryDelay(attempt,{baseMs=250,maxMs=2000}={}){
 if(!Number.isInteger(attempt)||attempt<0||attempt>4)throw new RangeError('invalid retry attempt');
 if(!Number.isSafeInteger(baseMs)||baseMs<1||!Number.isSafeInteger(maxMs)||maxMs<baseMs)throw new RangeError('invalid retry budget');
 return Math.min(maxMs,baseMs*2**attempt);
}
export async function readWithRecovery({read,signal,wait=()=>Promise.resolve(),maxRetries=2,isCurrent=()=>true}={}){
 if(typeof read!=='function'||typeof wait!=='function'||typeof isCurrent!=='function'||!Number.isInteger(maxRetries)||maxRetries<0||maxRetries>3)throw new TypeError('bounded read required');
 for(let attempt=0;;attempt++){
  if(signal?.aborted||!isCurrent())return Object.freeze({status:'stale',value:null,attempts:attempt});
  try{
   const value=await read({signal,attempt});
   if(signal?.aborted||!isCurrent())return Object.freeze({status:'stale',value:null,attempts:attempt+1});
   return Object.freeze({status:'ready',value,attempts:attempt+1});
  }catch(error){
   if(signal?.aborted||!isCurrent())return Object.freeze({status:'stale',value:null,attempts:attempt+1});
   if(attempt>=maxRetries||!RETRYABLE_READ_CODES.has(error?.code))return Object.freeze({status:'degraded',value:null,attempts:attempt+1,reason:'READ_UNAVAILABLE'});
   await wait(retryDelay(attempt),signal);
  }
 }
}
export function recoveryKey({route,account,chainId,sessionEpoch}={}){
 // Account changes, chain changes, session changes, or route switches invalidate old read responses.
 if(typeof route!=='string'||!/^\/[a-z0-9/-]*$/.test(route)||typeof account!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(account)||typeof chainId!=='string'||!/^0x[0-9a-fA-F]+$/.test(chainId)||!Number.isSafeInteger(sessionEpoch)||sessionEpoch<0)throw new TypeError('valid current session scope required');
 return `${route}|${account.toLowerCase()}|${chainId.toLowerCase()}|${sessionEpoch}`;
}
