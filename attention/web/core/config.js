const HEX_CHAIN=/^0x[0-9a-fA-F]+$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const FORBIDDEN=/secret|password|credential|api.?key|private.?key|authorization|bearer|token/i;
function nullableHttps(value,label){
  if(value===null)return null;
  if(typeof value!=='string'||!value)throw new Error(label+' must be URL or null');
  const u=new URL(value);
  const local=u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname);
  if(u.protocol!=='https:'&&!local)throw new Error(label+' must use HTTPS outside localhost');
  if(u.username||u.password)throw new Error(label+' must not contain credentials');
  return u.toString().replace(/\/$/,'');
}
function noSecrets(value,path='config'){
  if(!value||typeof value!=='object')return;
  for(const [key,child] of Object.entries(value)){
    if(FORBIDDEN.test(key))throw new Error(path+'.'+key+' is forbidden in browser runtime config');
    noSecrets(child,path+'.'+key);
  }
}
function nullableAddress(value,label){
  if(value===null)return null;
  if(typeof value!=='string'||!ADDRESS.test(value))throw new Error(label+' must be address or null');
  return value.toLowerCase();
}
export function validateAttentionRuntimeConfig(config){
  if(!config||config.schema!=='420-attention-web-runtime-v1')throw new Error('invalid Attention runtime schema');
  noSecrets(config);
  if(config.registry?.protocolRegistryAddress!=='0x0000000000000000000000000000000000000434')throw new Error('canonical ProtocolRegistry address mismatch');
  if(config.registry?.attentionServiceId!=='420/service/attention/v1')throw new Error('canonical Attention service id mismatch');
  if(config.registry?.cannaseurServiceId!=='420/service/cannaseur/v1')throw new Error('canonical Cannaseur service id mismatch');
  if(config.registry?.attentionTreasuryAddress?.toLowerCase()!=='0x0000000000000000000000000000000000000421')throw new Error('AttentionTreasury frozen address mismatch');
  if(config.registry?.campaignRegistryAddress?.toLowerCase()!=='0x000000000000000000000000000000000000043b')throw new Error('CannaseurCampaignRegistry frozen address mismatch');
  if(config.network?.chainId!==null&&!HEX_CHAIN.test(config.network.chainId))throw new Error('network.chainId must be hex or null');
  nullableHttps(config.network?.rpcUrl,'network.rpcUrl');
  nullableHttps(config.network?.explorerUrl,'network.explorerUrl');
  nullableHttps(config.api?.baseUrl,'api.baseUrl');
  if(config.api?.projectionSchema!=='420-attention-projection-v1')throw new Error('unsupported Attention projection schema');
  for(const key of ['attentionTreasuryAddress','campaignRegistryAddress','attentionRouterAddress','consentRegistryAddress','proofRegistryAddress','rewardRegistryAddress'])nullableAddress(config.registry?.[key],`registry.${key}`);
  const tx=config.transactions??{};
  if(!Number.isInteger(tx.minConfirmations)||tx.minConfirmations<1||tx.minConfirmations>64)throw new Error('transactions.minConfirmations invalid');
  if(!Number.isInteger(tx.pollIntervalMs)||tx.pollIntervalMs<250||tx.pollIntervalMs>30000)throw new Error('transactions.pollIntervalMs invalid');
  if(!Number.isInteger(tx.timeoutMs)||tx.timeoutMs<1000||tx.timeoutMs>900000)throw new Error('transactions.timeoutMs invalid');
  for(const key of ['walletConnection','campaignDiscovery','consentManagement','rewardClaims','sponsorCampaignManagement'])if(typeof config.features?.[key]!=='boolean')throw new Error('missing feature flag '+key);
  const mutations=config.features.consentManagement||config.features.rewardClaims||config.features.sponsorCampaignManagement;
  if(mutations&&!config.network.chainId)throw new Error('transaction features require configured chainId');
  return config;
}
export function attentionRuntimeReadiness(config,{walletChainId=null}={}){
  const missing=[];
  if(!config?.network?.chainId)missing.push('chainId');
  if(!config?.api?.baseUrl)missing.push('apiBaseUrl');
  for(const key of ['attentionRouterAddress','consentRegistryAddress','proofRegistryAddress','rewardRegistryAddress'])if(!config?.registry?.[key])missing.push(key);
  if(walletChainId&&config?.network?.chainId&&walletChainId.toLowerCase()!==config.network.chainId.toLowerCase())missing.push('walletChainMismatch');
  return Object.freeze({ready:missing.length===0,missing:Object.freeze(missing)});
}
