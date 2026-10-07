const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
function httpsOrigin(value,label){
  if(value===null)return null;
  const u=new URL(value);
  const local=u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname);
  if(u.protocol!=='https:'&&!local)throw new Error(label+' must use HTTPS outside localhost');
  if(u.username||u.password||u.search||u.hash)throw new Error(label+' must not contain credentials/query/fragment');
  return u.toString().replace(/\/$/,'');
}
export function validateAttentionServiceConfig420(config){
  if(!config||config.schema!=='420-attention-service-runtime-v1')throw new Error('invalid Attention service runtime schema');
  if(config.chainId!==null&&!/^\d+$/.test(String(config.chainId)))throw new Error('chainId must be unsigned decimal or null');
  httpsOrigin(config.indexerBaseUrl,'indexerBaseUrl');httpsOrigin(config.rpcUrl,'rpcUrl');
  if(String(config.contracts?.attentionTreasury||'').toLowerCase()!=='0x0000000000000000000000000000000000000421')throw new Error('AttentionTreasury frozen address mismatch');
  if(String(config.contracts?.campaignRegistry||'').toLowerCase()!=='0x000000000000000000000000000000000000043b')throw new Error('CampaignRegistry frozen address mismatch');
  for(const key of ['attentionTreasury','campaignRegistry','consentRegistry','proofRegistry','rewardRegistry','attentionRouter']){const v=config.contracts?.[key];if(v!==null&&!ADDRESS.test(String(v)))throw new Error('invalid contract '+key);}
  const p=config.projection??{};if(p.schema!=='420-attention-projection-v1')throw new Error('projection schema mismatch');
  for(const [k,min,max] of [['pageLimit',1,200],['maxPageLimit',1,200],['maxRetries',0,8],['retryBaseMs',1,5000]]){const v=p[k];if(!Number.isInteger(v)||v<min||v>max)throw new Error('projection '+k+' invalid');}
  if(p.pageLimit>p.maxPageLimit)throw new Error('pageLimit exceeds maxPageLimit');
  return config;
}
export function serviceReadiness420(config){
  const missing=[];if(!config.chainId)missing.push('chainId');if(!config.indexerBaseUrl)missing.push('indexerBaseUrl');if(!config.rpcUrl)missing.push('rpcUrl');
  for(const k of ['consentRegistry','proofRegistry','rewardRegistry','attentionRouter'])if(!config.contracts?.[k])missing.push(k);
  return Object.freeze({ready:missing.length===0,missing:Object.freeze(missing)});
}
