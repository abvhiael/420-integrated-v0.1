// Fail-closed production-shaped Ethereum JSON-RPC reader for HC-NEXT-7.3.
// Deployment code bytes and ABI function selector must be independently pinned.
// No testnet address or code hash is fabricated here.
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const hex=(x,n)=>typeof x==='string'&&new RegExp('^0x[0-9a-fA-F]{'+n+'}$').test(x);
const norm=x=>x.toLowerCase();
export function createHighCountryPremiumRpc420({
  endpoint,networkId,expectedRegistryCode,eligibleSelector,
  fetchImpl=globalThis.fetch,timeoutMs=10000
}={}){
 if(typeof endpoint!=='string'||!/^https:\/\/[^/?#]+(?:\/[^?#]*)?$/.test(endpoint)||
   !/^[1-9][0-9]*$/.test(networkId||'')||
   typeof expectedRegistryCode!=='string'||!/^0x(?:[0-9a-fA-F]{2})+$/.test(expectedRegistryCode)||
   norm(expectedRegistryCode)==='0x00'||!hex(eligibleSelector,8)||
   typeof fetchImpl!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>30000)
   fail('premium-rpc-config-invalid');
 let requestId=0;
 async function call(method,params=[]){
  const id=++requestId;
  const controller=new AbortController();
  // AbortSignal.timeout avoids timer leaks; combine with caller-controlled fetch timeout.
  try{
   const response=await fetchImpl(endpoint,{method:'POST',headers:{'content-type':'application/json'},
     body:JSON.stringify({jsonrpc:'2.0',id,method,params}),signal:AbortSignal.timeout(timeoutMs)});
   if(!response?.ok)fail('premium-rpc-unavailable');
   const value=await response.json();
   if(value?.jsonrpc!=='2.0'||value.id!==id||value.error||!Object.hasOwn(value,'result'))
      fail('premium-rpc-invalid');
   return value.result;
  }catch(e){if(e?.code)throw e;fail('premium-rpc-unavailable');}
 }
 async function getChainId(){
  const got=await call('eth_chainId');
  if(!/^0x[0-9a-fA-F]+$/.test(got||''))fail('premium-chain-invalid');
  const id=BigInt(got).toString();
  if(id!==networkId)fail('premium-chain-mismatch');
  return id;
 }
 async function getFinalizedBlock(){
  await getChainId();
  const finalized=await call('eth_getBlockByNumber',['finalized',false]);
  const latest=await call('eth_getBlockByNumber',['latest',false]);
  const valid=b=>b&&hex(b.hash,64)&&/^0x[0-9a-fA-F]+$/.test(b.number||'');
  if(!valid(finalized)||!valid(latest))fail('premium-finality-unavailable');
  const f=BigInt(finalized.number),l=BigInt(latest.number);
  if(l<f||l-f>BigInt(Number.MAX_SAFE_INTEGER)||f>BigInt(Number.MAX_SAFE_INTEGER))
    fail('premium-finality-unavailable');
  const witness=await call('eth_getBlockByHash',[finalized.hash,false]);
  if(!valid(witness)||norm(witness.hash)!==norm(finalized.hash)||BigInt(witness.number)!==f)
    fail('premium-finality-unavailable');
  return {number:Number(f),hash:norm(finalized.hash),confirmations:Number(l-f)+1};
 }
 async function readGate({registryAddress,account,scope,blockHash,requireCanonical}={}){
  if(!hex(registryAddress,40)||!hex(account,40)||!hex(scope,64)||!hex(blockHash,64)||
      requireCanonical!==true)fail('premium-rpc-invalid-input');
  await getChainId();
  const block={blockHash,requireCanonical:true};
  const witness=await call('eth_getBlockByHash',[blockHash,false]);
  if(!witness||norm(witness.hash??'')!==norm(blockHash))fail('premium-finality-unavailable');
  const code=await call('eth_getCode',[registryAddress,block]);
  if(typeof code!=='string'||norm(code)!==norm(expectedRegistryCode))
    fail('premium-code-mismatch');
  const data=norm(eligibleSelector)+('0'.repeat(24))+norm(account).slice(2)+norm(scope).slice(2);
  const result=await call('eth_call',[{to:registryAddress,data},block]);
  if(!hex(result,64))fail('premium-rpc-invalid-result');
  if(BigInt(result)!==0n&&BigInt(result)!==1n)fail('premium-rpc-invalid-result');
  return BigInt(result)===1n;
 }
 return Object.freeze({getChainId,getFinalizedBlock,readGate});
}
