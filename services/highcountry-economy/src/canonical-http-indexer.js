// HC-NEXT-4.3 pinned indexer transport: never a settlement oracle.
// Returned observations must also pass CanonicalIndexerReconciler finalized-chain verification.
import {SettlementError} from './buds-ledger.js';
const hex32=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/i.test(x);
const address=x=>typeof x==='string'&&/^0x[0-9a-f]{40}$/i.test(x);
export class CanonicalHttpIndexer {
 constructor({baseUrl,chainId,escrow,token,fetchImpl=fetch,allowLocal=false}){
  let parsed;try{parsed=new URL(baseUrl);}catch{throw new SettlementError('invalid canonical indexer URL');}
  if((parsed.protocol!=='https:'&&!(allowLocal&&parsed.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)))
   ||parsed.username||parsed.password||parsed.search||parsed.hash||!Number.isSafeInteger(chainId)||chainId<=0
   ||!address(escrow)||typeof fetchImpl!=='function'||(token!==undefined&&(typeof token!=='string'||!token)))
   throw new SettlementError('unsafe canonical indexer configuration');
  Object.assign(this,{baseUrl:parsed.toString().replace(/\/$/,''),chainId,escrow:escrow.toLowerCase(),token,fetchImpl});
 }
 async get(kind,id){
  if(!hex32(id)||!['listings','transfers'].includes(kind))throw new SettlementError('invalid indexer query');
  const response=await this.fetchImpl(this.baseUrl+'/escrow/'+kind+'/'+id,{
   method:'GET',headers:{accept:'application/json',...(this.token?{authorization:'Bearer '+this.token}:{})},
   signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new SettlementError('indexer unavailable');
  const size=Number(response.headers?.get?.('content-length'));
  if(size>16384)throw new SettlementError('oversized indexer response');
  const body=await response.text();
  if(body.length>16384)throw new SettlementError('oversized indexer response');
  let value;try{value=JSON.parse(body);}catch{throw new SettlementError('malformed indexer response');}
  if(!value||value.chainId!==this.chainId||value.escrow?.toLowerCase()!==this.escrow
    ||!value.result||typeof value.result!=='object')
    throw new SettlementError('indexer network or escrow mismatch');
  return value.result;
 }
 listing(id){return this.get('listings',id);}
 transfer(id){return this.get('transfers',id);}
}
