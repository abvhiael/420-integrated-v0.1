// Separate canonicality witness over an independently configured RPC endpoint.
// Both endpoints must agree on chainId AND finalized block hash at the exact height.
// No caller/indexer provided finalized boolean can satisfy this witness.
const deny=x=>{throw Object.assign(new Error(x),{code:x});};
const hash=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x);
const quantity=x=>typeof x==='string'&&/^0x(0|[1-9a-f][0-9a-f]*)$/.test(x);
export function createIndependentFinalityWitness420({url,chainId,fetchImpl=fetch,expectedNetwork}={}){
 if(typeof url!=='string'||!/^https:\/\//.test(url)||
  !Number.isSafeInteger(chainId)||chainId<1||typeof fetchImpl!=='function'||
  expectedNetwork===null)deny('r057-witness-configuration');
 let id=0;
 const request=async(method,params)=>{
  const n=++id;
  const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({jsonrpc:'2.0',id:n,method,params}),signal:AbortSignal.timeout(10000)});
  if(!response?.ok)deny('r057-witness-unavailable');
  const data=await response.json();
  if(data?.id!==n||data?.error||!Object.hasOwn(data,'result'))deny('r057-witness-malformed');
  return data.result;
 };
 return async({chainId:observed,blockHash,blockNumber}={})=>{
  if(String(observed)!==String(chainId)||!hash(blockHash)||
   typeof blockNumber!=='string'||!/^(0|[1-9][0-9]*)$/.test(blockNumber))
   deny('r057-witness-request-invalid');
  if(BigInt(await request('eth_chainId',[]))!==BigInt(chainId))deny('r057-witness-chain-diverged');
  const head=await request('eth_getBlockByNumber',['finalized',false]);
  if(!head||!hash(head.hash)||!quantity(head.number))deny('r057-witness-head-invalid');
  if(BigInt(head.number)<BigInt(blockNumber))deny('r057-witness-finality-lag');
  const historic=await request('eth_getBlockByNumber',['0x'+BigInt(blockNumber).toString(16),false]);
  if(!historic||!hash(historic.hash)||historic.hash!==blockHash||
   !quantity(historic.number)||BigInt(historic.number)!==BigInt(blockNumber))
   deny('r057-witness-fork-mismatch');
  return true;
 };
}
