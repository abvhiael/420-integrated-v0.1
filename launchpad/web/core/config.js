const HEX_CHAIN=/^0x[0-9a-fA-F]+$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
function nullableHttps(value){
  if(value===null)return true;
  if(typeof value!=='string'||!value)return false;
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}
}
export function validateRuntimeConfig(config){
  if(!config||config.schema!=='420-launchpad-web-runtime-v1')throw new Error('invalid Launchpad runtime schema');
  if(config.registry?.protocolRegistryAddress!=='0x0000000000000000000000000000000000000434')throw new Error('canonical ProtocolRegistry address mismatch');
  if(config.registry?.serviceId!=='420/service/launchpad/v1')throw new Error('canonical Launchpad service id mismatch');
  if(config.network?.chainId!==null&&!HEX_CHAIN.test(config.network.chainId))throw new Error('invalid chainId');
  for(const key of ['rpcUrl','explorerUrl'])if(!nullableHttps(config.network?.[key]))throw new Error('invalid network URL');
  if(!nullableHttps(config.api?.baseUrl))throw new Error('invalid Launchpad API URL');
  for(const key of ['launchpadRouterAddress','allocationRegistryAddress','crowdfundingIntegrationAddress']){
    const v=config.registry?.[key];if(v!==null&&!ADDRESS.test(v))throw new Error('invalid configured contract address');
  }
  return config;
}
export function runtimeReadiness(config,{walletChainId=null}={}){
  const missing=[];
  if(!config?.network?.chainId)missing.push('chainId');
  if(!config?.network?.rpcUrl)missing.push('rpcUrl');
  if(!config?.api?.baseUrl)missing.push('apiBaseUrl');
  for(const key of ['launchpadRouterAddress','allocationRegistryAddress','crowdfundingIntegrationAddress']){
    if(!config?.registry?.[key])missing.push(key);
  }
  if(walletChainId&&config?.network?.chainId&&walletChainId.toLowerCase()!==config.network.chainId.toLowerCase())missing.push('walletChainMismatch');
  return {ready:missing.length===0,missing};
}
