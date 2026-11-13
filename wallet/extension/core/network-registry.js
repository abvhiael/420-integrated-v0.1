// W15.6-M3: network identities are separate from RPC transports and signing authority.
export const NETWORKS_KEY_420='420-wallet-networks-v1';
export const ORIGIN_NETWORKS_KEY_420='420-wallet-origin-networks-v1';
export const DEFAULT_NETWORKS_420=Object.freeze([
  // The canonical deployment inventory pins decimal chain ID 420. Endpoints remain unset
  // until an official manifest or an explicitly verified user-provided RPC exists.
  Object.freeze({chainId:'0x1a4',chainName:'420 Integrated',nativeCurrency:{name:'420',symbol:'420',decimals:18},rpcUrls:[],blockExplorerUrls:[],enabled:false,trusted:true,smartAccountApproved:false}),
  Object.freeze({chainId:'0x1',chainName:'Ethereum Mainnet',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:[],blockExplorerUrls:['https://etherscan.io/'],enabled:false,trusted:true,smartAccountApproved:false}),
  Object.freeze({chainId:'0xaa36a7',chainName:'Ethereum Sepolia',nativeCurrency:{name:'Sepolia Ether',symbol:'ETH',decimals:18},rpcUrls:[],blockExplorerUrls:['https://sepolia.etherscan.io/'],enabled:false,trusted:true,smartAccountApproved:false})
]);
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
export function chainId420(value){
  assert(typeof value==='string'&&/^0x[0-9a-fA-F]+$/.test(value),'Invalid EIP-155 chain ID');
  const n=BigInt(value);assert(n>0n&&n<2n**256n,'Invalid EIP-155 chain ID');
  return '0x'+n.toString(16);
}
export function endpoint420(value,{local=false}={}){
  assert(typeof value==='string'&&value.length<2048,'Invalid RPC URL');
  const u=new URL(value);
  assert(!u.username&&!u.password&&!u.hash,'RPC URL credentials and fragments are forbidden');
  assert(u.protocol==='https:'||(local&&u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)),'RPC requires HTTPS');
  return u.href;
}
function explorer420(value){
  const u=new URL(value);assert(u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&value.length<2048,'Explorer must use HTTPS');
  return u.href;
}
export function normalizeNetwork420(value,{local=false}={}){
  assert(value&&typeof value==='object'&&!Array.isArray(value),'Network object required');
  const chainId=chainId420(value.chainId);
  assert(typeof value.chainName==='string'&&value.chainName.trim().length>0&&value.chainName.length<=80,'Invalid network name');
  const currency=value.nativeCurrency;
  assert(currency&&typeof currency.name==='string'&&currency.name.length>0&&currency.name.length<=50&&typeof currency.symbol==='string'&&/^[a-zA-Z0-9]{1,12}$/.test(currency.symbol)&&Number.isInteger(currency.decimals)&&currency.decimals>=0&&currency.decimals<=36,'Invalid native currency');
  assert(Array.isArray(value.rpcUrls)&&value.rpcUrls.length<=8,'Invalid network RPC endpoints');
  const rpcUrls=[...new Set(value.rpcUrls.map(u=>endpoint420(u,{local})))];
  assert(Array.isArray(value.blockExplorerUrls||[])&&(value.blockExplorerUrls||[]).length<=4,'Invalid block explorers');
  const blockExplorerUrls=[...new Set((value.blockExplorerUrls||[]).map(explorer420))];
  const assets=Array.isArray(value.assets)?value.assets.slice(0,25).map(a=>{
    assert(a&&typeof a.address==='string'&&/^0x[0-9a-fA-F]{40}$/.test(a.address),'Invalid tracked asset');
    assert(typeof a.symbol==='string'&&/^[a-zA-Z0-9]{1,12}$/.test(a.symbol),'Invalid tracked asset symbol');
    assert(Number.isInteger(a.decimals)&&a.decimals>=0&&a.decimals<=36,'Invalid tracked asset decimals');
    return {address:a.address.toLowerCase(),symbol:a.symbol,decimals:a.decimals};
  }):[];
  return {chainId,chainName:value.chainName.trim(),nativeCurrency:{name:currency.name,symbol:currency.symbol,decimals:currency.decimals},rpcUrls,blockExplorerUrls,assets,enabled:value.enabled===true,trusted:value.trusted===true,smartAccountApproved:false};
}
export function normalizeRegistry420(value={}){
  const stored=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const entries={};
  for(const builtin of DEFAULT_NETWORKS_420)entries[builtin.chainId]={...builtin};
  if(stored.networks&&typeof stored.networks==='object'&&!Array.isArray(stored.networks)){
    for(const [key,raw] of Object.entries(stored.networks).slice(0,40)){
      try{
        const network=normalizeNetwork420(raw,{local:true});
        if(network.chainId!==chainId420(key))continue;
        entries[key]={...network,trusted:DEFAULT_NETWORKS_420.some(x=>x.chainId===key),smartAccountApproved:false};
      }catch{}
    }
  }
  const selected=stored.selectedChainId&&entries[stored.selectedChainId]?.enabled?stored.selectedChainId:null;
  return {version:1,epoch:Number.isSafeInteger(stored.epoch)&&stored.epoch>=0?stored.epoch:0,
    selectedChainId:selected,networks:entries};
}
export function networkFromLegacy420(config){
  if(!config?.chainId||!config?.rpcUrl)return null;
  const chainId=chainId420(config.chainId);
  const builtin=DEFAULT_NETWORKS_420.find(n=>n.chainId===chainId);
  return normalizeNetwork420({chainId,chainName:config.networkName||builtin?.chainName||'420 Integrated',nativeCurrency:builtin?.nativeCurrency||{name:'420',symbol:'420',decimals:18},rpcUrls:[config.rpcUrl],blockExplorerUrls:config.explorerUrl?[config.explorerUrl]:[],assets:Array.isArray(config.trackedAssets)?config.trackedAssets:[],enabled:true},{local:true});
}
export async function probeEndpoint420(url,expected,request=fetch){
  const chainId=chainId420(expected),controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),6000);
  try{
    const response=await request(endpoint420(url,{local:true}),{method:'POST',headers:{'content-type':'application/json'},signal:controller.signal,body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]})});
    assert(response.ok,'RPC endpoint unavailable');
    const body=await response.json();
    assert(!body.error&&chainId420(body.result)===chainId,'RPC returned a different chain ID');
    return {url,chainId,healthy:true};
  }finally{clearTimeout(timer);}
}
export async function probeNetwork420(network,request=fetch){
  const results=[];
  for(const url of network.rpcUrls){
    try{await probeEndpoint420(url,network.chainId,request);results.push({url,healthy:true});}
    catch(e){results.push({url,healthy:false,error:e.message});}
  }
  return results;
}
export function watchAsset420(value,chain){
  assert(value&&typeof value==='object'&&value.type==='ERC20','Only ERC20 assets can be watched');
  const o=value.options;
  assert(o&&typeof o.address==='string'&&/^0x[0-9a-fA-F]{40}$/.test(o.address)&&!/^0x0{40}$/i.test(o.address),'Invalid ERC20 contract address');
  if(o.chainId!==undefined){
    const claimed=typeof o.chainId==='number'&&Number.isSafeInteger(o.chainId)&&o.chainId>0?'0x'+o.chainId.toString(16):o.chainId;
    assert(chainId420(claimed)===chain,'Asset chain mismatch');
  }
  assert(typeof o.symbol==='string'&&/^[a-zA-Z0-9]{1,12}$/.test(o.symbol),'Invalid ERC20 symbol');
  assert(Number.isInteger(o.decimals)&&o.decimals>=0&&o.decimals<=36,'Invalid ERC20 decimals');
  if(o.image!==undefined)explorer420(o.image);
  return {address:o.address.toLowerCase(),symbol:o.symbol,decimals:o.decimals};
}
