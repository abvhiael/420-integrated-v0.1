import {verify,createPublicKey,KeyObject} from 'node:crypto';
import {SettlementError} from './buds-ledger.js';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
export function createSignedMissionEvidence({publicKey,issuer,gameId,chainId,clock=()=>Date.now()}){
 if(!id(issuer)||!/^0x[0-9a-f]{64}$/i.test(gameId)||!Number.isSafeInteger(chainId)||chainId<1
  ||!publicKey||typeof clock!=='function')throw new SettlementError('invalid mission evidence authority');
 if(publicKey instanceof KeyObject&&publicKey.type!=='public')throw new SettlementError('invalid mission public key');
 const key=publicKey instanceof KeyObject?publicKey:createPublicKey(publicKey);
 if(key.type!=='public'||key.asymmetricKeyType!=='ed25519')throw new SettlementError('invalid mission public key');
 return async ({principal,missionId,objective,version,evidence,amount})=>{
  if(!id(principal)||!id(missionId)||!id(objective)||!id(version)||!Number.isSafeInteger(amount)||amount<1
   ||typeof evidence!=='string'||evidence.length>8192)return false;
  let payload;
  try{
   const envelope=JSON.parse(Buffer.from(evidence,'base64url').toString('utf8'));
   const bytes=Buffer.from(envelope.payload,'base64url');
   if(!bytes.length||bytes.length>2048||!verify(null,bytes,key,Buffer.from(envelope.signature,'base64url')))return false;
   payload=JSON.parse(bytes.toString('utf8'));
  }catch{return false;}
  if(payload?.domain!=='HC.MISSION.EVIDENCE.V1'||payload.issuer!==issuer
    ||payload.gameId?.toLowerCase()!==gameId.toLowerCase()||payload.chainId!==chainId
    ||payload.principal!==principal||payload.missionId!==missionId||payload.objective!==objective
    ||payload.version!==version||payload.amount!==amount||!id(payload.sourceEvent)
    ||!Number.isSafeInteger(payload.expiresAt)||clock()>=payload.expiresAt
    ||payload.expiresAt>clock()+300000)return false;
  return {sourceEvent:payload.sourceEvent};
 };
}
