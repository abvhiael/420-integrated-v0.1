import {hexUtf8,encodeStatic,wordHex,decodeAddress,decodeUint} from './abi.mjs';
export class Rpc {
  constructor(url,fetchImpl=globalThis.fetch){if(!url)throw new Error('RPC URL required');this.url=url;this.fetch=fetchImpl;this.id=0;}
  async call(method,params){const r=await this.fetch(this.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++this.id,method,params})});if(!r.ok)throw new Error('RPC HTTP '+r.status);const b=await r.json();if(b.error)throw new Error('RPC '+(b.error.message||b.error.code));return b.result;}
  async selector(signature){const h=await this.call('web3_sha3',[hexUtf8(signature)]);return '0x'+String(h).slice(2,10);}
  async ethCall(to,data){return this.call('eth_call',[{to,data},'latest']);}
}
export async function resolveLaunchpad(rpc,{registryAddress,serviceId='420/service/launchpad/v1'}={}){
  const serviceHash=await rpc.call('web3_sha3',[hexUtf8(serviceId)]);
  const resolveSel=await rpc.selector('resolveActive(bytes32)');
  const resolved=await rpc.ethCall(registryAddress,encodeStatic(resolveSel,[wordHex(serviceHash)]));
  const router=decodeAddress(resolved,0),version=Number(decodeUint(resolved,1));
  if(/^0x0{40}$/i.test(router)||version<1)throw new Error('Launchpad service unresolved');
  const salesSel=await rpc.selector('sales()'),allocSel=await rpc.selector('allocations()');
  const sales=decodeAddress(await rpc.ethCall(router,salesSel));
  const allocations=decodeAddress(await rpc.ethCall(router,allocSel));
  const crowdSel=await rpc.selector('crowdfundingIntegration()');
  const crowdfundingIntegration=decodeAddress(await rpc.ethCall(allocations,crowdSel));
  const projectsSel=await rpc.selector('projects()');
  const projectRegistry=decodeAddress(await rpc.ethCall(sales,projectsSel));
  return {serviceId,version,launchpadRouterAddress:router,saleRegistryAddress:sales,allocationRegistryAddress:allocations,crowdfundingIntegrationAddress:crowdfundingIntegration,projectRegistryAddress:projectRegistry};
}
