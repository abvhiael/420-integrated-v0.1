// R05.6 pinned JSON-RPC source: direct eth_getBlockByNumber + eth_getLogs,
// with the blockHash filter, chain ID, deployed bytecode and immutable address checks.
import {keccak256} from '../../highcountry-economy/src/keccak.js';
const fail=x=>{throw Object.assign(new Error(x),{code:x});};
const h=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x);
const addr=x=>typeof x==='string'&&/^0x[0-9a-f]{40}$/.test(x);
const num=x=>typeof x==='string'&&/^0x(0|[1-9a-f][0-9a-f]*)$/.test(x);
const pad=x=>String(BigInt(x));
export class PinnedGamingEventRpc420 {
 #url;#chain;#manifest;#fetch;#id=0;
 constructor({url,chainId,contracts,fetchImpl=fetch}={}){
  if(typeof url!=='string'||!/^https?:\/\//.test(url)||!Number.isSafeInteger(chainId)||chainId<=0||
   typeof fetchImpl!=='function'||!contracts||!Object.values(contracts).length)
    fail('events-rpc-config');
  for(const c of Object.values(contracts))
   if(!addr(c.address)||!h(c.codeHash)||c.codeHash==='0x'+'0'.repeat(64))
    fail('events-rpc-manifest');
  this.#url=url;this.#chain=chainId;this.#manifest=Object.freeze({...contracts});this.#fetch=fetchImpl;
 }
 async #call(method,params){
  const id=++this.#id;
  const res=await this.#fetch(this.#url,{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({jsonrpc:'2.0',id,method,params}),signal:AbortSignal.timeout(10000)});
  if(!res.ok)fail('events-rpc-unavailable');
  const payload=await res.json();
  if(payload?.id!==id||payload.error||!Object.hasOwn(payload,'result'))fail('events-rpc-rejected');
  return payload.result;
 }
 async fetchBlock({chainId,contract,number}={}){
  if(String(chainId)!==String(this.#chain)||!Object.values(this.#manifest).some(v=>v.address===contract)||
   typeof number!=='string'||!/^(0|[1-9][0-9]*)$/.test(number))
   fail('events-rpc-request-invalid');
  if(BigInt(await this.#call('eth_chainId',[]))!==BigInt(this.#chain))fail('events-rpc-wrong-chain');
  const tag='0x'+BigInt(number).toString(16);
  const block=await this.#call('eth_getBlockByNumber',[tag,false]);
  if(!block||!h(block.hash)||!h(block.parentHash)||!num(block.number)||
   pad(block.number)!==number)fail('events-rpc-block-mismatch');
  const manifest=Object.values(this.#manifest).find(v=>v.address===contract);
  const code=await this.#call('eth_getCode',[contract,{blockHash:block.hash,requireCanonical:true}]);
  if(typeof code!=='string'||!/^0x([0-9a-f]{2})*$/.test(code)||
   keccak256(Buffer.from(code.slice(2),'hex'))!==manifest.codeHash)
   fail('events-rpc-code-drift');
  const fetched=await this.#call('eth_getLogs',[{address:contract,blockHash:block.hash}]);
  if(!Array.isArray(fetched)||fetched.length>2000)fail('events-rpc-logs-invalid');
  const logs=fetched.map(row=>{
   if(row.removed===true||row.address!==contract||row.blockHash!==block.hash||
    !h(row.transactionHash)||!num(row.transactionIndex)||!num(row.logIndex)||
    !Array.isArray(row.topics)||typeof row.data!=='string')
    fail('events-rpc-log-invalid');
   return Object.freeze({address:row.address,blockHash:row.blockHash,transactionHash:row.transactionHash,
    transactionIndex:pad(row.transactionIndex),logIndex:pad(row.logIndex),topics:row.topics,data:row.data});
  });
  const recheck=await this.#call('eth_getBlockByNumber',[tag,false]);
  if(recheck?.hash!==block.hash)fail('events-rpc-chain-moved');
  return Object.freeze({number,hash:block.hash,parentHash:block.parentHash,logs});
 }
}
