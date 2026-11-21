import {hexUtf8,encodeStatic,wordHex,decodeAddress,decodeUint} from './abi.mjs';
const HASH=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const HEX=/^0x(?:[0-9a-fA-F]{2})*$/;
const QUANTITY=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const METHODS=new Set(['eth_chainId','eth_call','eth_getBlockByNumber','eth_getBlockByHash','eth_getLogs','eth_getCode','eth_getTransactionReceipt','eth_getTransactionByHash','web3_sha3']);
function validUrl(url){
  const u=new URL(url);
  if(u.username||u.password||u.hash||u.search||!(['https:'].includes(u.protocol)||
    (u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))))
    throw new Error('untrusted Launchpad RPC endpoint');
}
export class Rpc {
  constructor(url,fetchImpl=globalThis.fetch,{timeoutMs=8000,maxBytes=1048576}={}){
    if(!url)throw new Error('RPC URL required');
    validUrl(url);
    if(!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000||
      !Number.isSafeInteger(maxBytes)||maxBytes<1024||maxBytes>4194304)throw new Error('invalid RPC resource limits');
    this.url=url;this.fetch=fetchImpl;this.id=0;this.timeoutMs=timeoutMs;this.maxBytes=maxBytes;
  }
  async call(method,params=[]){
    if(!METHODS.has(method)||!Array.isArray(params))throw new Error('unsupported RPC method');
    const id=++this.id;
    let response;
    try{response=await this.fetch(this.url,{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id,method,params}),signal:AbortSignal.timeout(this.timeoutMs)});}
    catch{throw new Error('Launchpad RPC unavailable or timed out');}
    if(!response?.ok)throw new Error('RPC HTTP '+response?.status);
    const ct=response.headers?.get?.('content-type');
    if(ct&&!/^application\/json(?:\s*;|$)/i.test(ct))throw new Error('RPC returned unexpected content type');
    if(Number(response.headers?.get?.('content-length'))>this.maxBytes)throw new Error('RPC response exceeds limit');
    let raw='';
    if(response.body?.getReader){
      const reader=response.body.getReader();
      try{while(true){const {done,value}=await reader.read();if(done)break;
        raw+=new TextDecoder().decode(value);if(Buffer.byteLength(raw)>this.maxBytes)throw new Error('RPC response exceeds limit');}}
      finally{reader.releaseLock();}
    }else{
      raw=await response.text();
      if(Buffer.byteLength(raw)>this.maxBytes)throw new Error('RPC response exceeds limit');
    }
    let b;try{b=JSON.parse(raw);}catch{throw new Error('malformed RPC JSON');}
    if(!b||Array.isArray(b)||b.jsonrpc!=='2.0'||b.id!==id||(!Object.hasOwn(b,'result')===!Object.hasOwn(b,'error')))
      throw new Error('invalid RPC envelope or response identity');
    if(b.error)throw new Error('RPC rejected request');
    const v=b.result;
    if((method==='eth_chainId'&&!QUANTITY.test(v))||
       (method==='web3_sha3'&&!HASH.test(v))||
       (method==='eth_call'&&(!HEX.test(v)||v.length%2!==0))||
       (method==='eth_getCode'&&(!HEX.test(v)||v.length%2!==0))||
       (method==='eth_getLogs'&&(!Array.isArray(v)||v.length>10000))||
       (method==='eth_getBlockByNumber'&&v!==null&&(!HASH.test(v?.hash)||!QUANTITY.test(v?.number)))||
       (method==='eth_getBlockByHash'&&v!==null&&(!HASH.test(v?.hash)||!QUANTITY.test(v?.number))))
      throw new Error('malformed RPC result');
    return v;
  }
  async selector(signature){
    const h=await this.call('web3_sha3',[hexUtf8(signature)]);
    return '0x'+h.slice(2,10);
  }
  async ethCall(to,data){if(!ADDRESS.test(to)||!HEX.test(data))throw new Error('invalid contract read');return this.call('eth_call',[{to,data},'latest']);}
}
export async function resolveLaunchpad(rpc,{registryAddress,serviceId='420/service/launchpad/v1'}={}){
  if(registryAddress!=='0x0000000000000000000000000000000000000434'||
    serviceId!=='420/service/launchpad/v1')throw new Error('unexpected Launchpad Registry identity');
  const serviceHash=await rpc.call('web3_sha3',[hexUtf8(serviceId)]);
  if(!HASH.test(serviceHash))throw new Error('invalid Registry service identity');
  const resolveSel=await rpc.selector('resolveActive(bytes32)');
  const resolved=await rpc.ethCall(registryAddress,encodeStatic(resolveSel,[wordHex(serviceHash)]));
  const router=decodeAddress(resolved,0),version=Number(decodeUint(resolved,1));
  if(/^0x0{40}$/i.test(router)||!Number.isSafeInteger(version)||version<1)throw new Error('Launchpad service unresolved');
  async function getter(from,name){return decodeAddress(await rpc.ethCall(from,await rpc.selector(name+'()')));}
  const [sales,allocations]=await Promise.all([getter(router,'sales'),getter(router,'allocations')]);
  const [crowdfundingIntegration,allocationSales,projectRegistry]=await Promise.all([
    getter(allocations,'crowdfundingIntegration'),getter(allocations,'sales'),getter(sales,'projects')]);
  const [crowdSales,crowdAllocations,crowdProjects]=await Promise.all([
    getter(crowdfundingIntegration,'sales'),getter(crowdfundingIntegration,'allocations'),getter(crowdfundingIntegration,'projects')]);
  if(new Set([router,sales,allocations,crowdfundingIntegration,projectRegistry].map(x=>x.toLowerCase())).size!==5||
    [router,sales,allocations,crowdfundingIntegration,projectRegistry].some(x=>/^0x0{40}$/i.test(x))||
    allocationSales.toLowerCase()!==sales.toLowerCase()||
    crowdSales.toLowerCase()!==sales.toLowerCase()||
    crowdAllocations.toLowerCase()!==allocations.toLowerCase()||
    crowdProjects.toLowerCase()!==projectRegistry.toLowerCase())
    throw new Error('Launchpad canonical dependency graph mismatch');
  for(const addr of [router,sales,allocations,crowdfundingIntegration,projectRegistry,registryAddress]){
    const code=await rpc.call('eth_getCode',[addr,'latest']);
    if(!HEX.test(code)||code==='0x')throw new Error('missing canonical Launchpad runtime code');
  }
  return {serviceId,version,launchpadRouterAddress:router,saleRegistryAddress:sales,allocationRegistryAddress:allocations,crowdfundingIntegrationAddress:crowdfundingIntegration,projectRegistryAddress:projectRegistry};
}
