import {verify,createPublicKey,KeyObject} from 'node:crypto';
import {SettlementError} from './buds-ledger.js';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const b64=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,4096}$/.test(x);
export function createSignedMissionEvidence({publicKey,issuer,gameId,chainId,clock=()=>Date.now()}){
 if(!publicKey||!id(issuer)||!/^0x[0-9a-f]{64}$/i.test(gameId)
  ||!Number.isSafeInteger(chainId)||chainId<1||typeof clock!=='function')
  throw new SettlementError('missing approved mission verifier');
 if(publicKey instanceof KeyObject&&publicKey.type!=='public')throw new SettlementError('invalid mission key');
 const key=publicKey instanceof KeyObject?publicKey:createPublicKey(publicKey);
 if(key.type!=='public'||key.asymmetricKeyType!=='ed25519')throw new SettlementError('invalid mission key');
 return async({principal,missionId,version,objective,evidence,amount})=>{
  if(!id(principal)||!id(missionId)||!id(version)||!id(objective)||!Number.isSafeInteger(amount)||amount<1)return false;
  try{
   const packed=JSON.parse(Buffer.from(evidence,'base64url').toString('utf8'));
   if(!b64(packed?.payload)||!b64(packed?.signature))return false;
   const bytes=Buffer.from(packed.payload,'base64url');
   if(bytes.length>2048||!verify(null,bytes,key,Buffer.from(packed.signature,'base64url')))return false;
   const c=JSON.parse(bytes.toString('utf8')),now=clock();
   if(c?.domain!=='HC.MISSION.EVIDENCE.V1'||c.issuer!==issuer||c.principal!==principal
    ||c.gameId?.toLowerCase()!==gameId.toLowerCase()||c.chainId!==chainId
    ||c.missionId!==missionId||c.version!==version||c.objective!==objective
    ||c.amount!==amount||!id(c.sourceEvent)||!Number.isSafeInteger(c.expiresAt)
    ||now>=c.expiresAt||c.expiresAt>now+300000)return false;
   return Object.freeze({sourceEvent:c.sourceEvent});
  }catch{return false;}
 };
}
