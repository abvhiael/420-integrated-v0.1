// Independently signed current player level. Never accept a browser-submitted level.
import {verify,createPublicKey} from 'node:crypto';
import {SettlementError} from './buds-ledger.js';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
export function createSignedPlayerLevelProvider({url,publicKey,issuer,gameId,chainId,fetchImpl=fetch,clock=()=>Date.now()}){
 let parsed;try{parsed=new URL(url);}catch{throw new SettlementError('invalid level source');}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash
   ||!publicKey||!id(issuer)||!/^0x[0-9a-f]{64}$/i.test(gameId)
   ||!Number.isSafeInteger(chainId)||chainId<1||typeof fetchImpl!=='function')
  throw new SettlementError('untrusted level provider');
 const key=createPublicKey(publicKey);
 return async ({principal})=>{
  if(!id(principal))throw new SettlementError('invalid player level principal');
  const requestUrl=new URL('levels/'+encodeURIComponent(principal),parsed);
  let response;try{response=await fetchImpl(requestUrl.toString(),{
   method:'GET',headers:{accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(10000)});
  }catch{throw new SettlementError('player level provider unavailable');}
  if(!response.ok)throw new SettlementError('player level provider unavailable');
  let wrapper;try{wrapper=await response.json();}catch{throw new SettlementError('invalid level attestation');}
  if(typeof wrapper?.payload!=='string'||wrapper.payload.length>4096||
     typeof wrapper.signature!=='string'||wrapper.signature.length>4096)
   throw new SettlementError('invalid level attestation');
  let claim;
  try{
   const bytes=Buffer.from(wrapper.payload,'base64url');
   if(!bytes.length||bytes.length>2048||
      !verify(null,bytes,key,Buffer.from(wrapper.signature,'base64url')))
    throw Error('bad signature');
   claim=JSON.parse(bytes.toString('utf8'));
  }catch{throw new SettlementError('invalid level attestation');}
  if(claim?.domain!=='HC.PLAYER.LEVEL.V1'||claim.issuer!==issuer||claim.principal!==principal
    ||claim.gameId?.toLowerCase()!==gameId.toLowerCase()||claim.chainId!==chainId
    ||!Number.isSafeInteger(claim.level)||claim.level<1||claim.level>100
    ||!Number.isSafeInteger(claim.expiresAt)||clock()>=claim.expiresAt
    ||claim.expiresAt>clock()+60000)
   throw new SettlementError('stale or wrong player level');
  return claim.level;
 };
}
