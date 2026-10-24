import {verify,createPublicKey} from 'node:crypto';
import {SettlementError} from './buds-ledger.js';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const b64=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,4096}$/.test(x);
export function createSignedProgressionEvidence({publicKey,issuer,clock=()=>Date.now()}){
 if(!publicKey||!id(issuer)||typeof clock!=='function')
  throw new SettlementError('missing approved progression verifier');
 const key=createPublicKey(publicKey);
 return async ({principal,trackId,version,evidence,points})=>{
  if(!id(principal)||!id(trackId)||!id(version)||!Number.isSafeInteger(points)||points<1)return false;
  let claim;
  try{
   const encoded=JSON.parse(Buffer.from(evidence,'base64url').toString('utf8'));
   if(!encoded||!b64(encoded.payload)||!b64(encoded.signature))return false;
   const bytes=Buffer.from(encoded.payload,'base64url');
   if(bytes.length>2048||!verify(null,bytes,key,Buffer.from(encoded.signature,'base64url')))return false;
   claim=JSON.parse(bytes.toString('utf8'));
  }catch{return false;}
  const accepted=claim?.domain==='HC.PROGRESSION.EVIDENCE.V1'&&claim.issuer===issuer
   &&claim.principal===principal&&claim.trackId===trackId&&claim.version===version
   &&claim.points===points&&id(claim.sourceEvent)
   &&Number.isSafeInteger(claim.expiresAt)&&clock()<claim.expiresAt
   &&claim.expiresAt<=clock()+300000;
  return accepted?Object.freeze({sourceEvent:claim.sourceEvent}):false;
 };
}
