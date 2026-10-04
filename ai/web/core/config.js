const FORBIDDEN_KEYS=/token|secret|credential|api.?key|authorization|private.?key|password/i;

function nullableHttps(value,label){
  if(value===null||value===undefined)return null;
  if(typeof value!=='string'||!value)throw new Error(label+' must be URL or null');
  const u=new URL(value);
  const local=u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname);
  if(u.protocol!=='https:'&&!local)throw new Error(label+' must use HTTPS outside localhost');
  if(u.username||u.password)throw new Error(label+' must not contain credentials');
  return u.toString().replace(/\/$/,'');
}
function walkNoSecrets(value,path='config'){
  if(!value||typeof value!=='object')return;
  for(const [key,child] of Object.entries(value)){
    if(FORBIDDEN_KEYS.test(key))throw new Error(path+'.'+key+' is forbidden in browser runtime config');
    walkNoSecrets(child,path+'.'+key);
  }
}
function address(value,label){
  if(value===null||value===undefined)return null;
  if(typeof value!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(value))throw new Error(label+' must be address');
  return value.toLowerCase();
}
export function validateAiRuntimeConfig420(config){
  if(!config||config.schema!=='420-ai-web-runtime-v1')throw new Error('invalid 420AI runtime schema');
  if(config.site?.productionOrigin!=='https://ai.420integrated.org')throw new Error('invalid 420AI production origin');
  walkNoSecrets(config);
  if(config.network?.chainId!=null&&!/^0x[0-9a-fA-F]+$/.test(config.network.chainId))throw new Error('network.chainId must be hex or null');
  nullableHttps(config.network?.rpcUrl,'network.rpcUrl');
  nullableHttps(config.network?.explorerUrl,'network.explorerUrl');
  nullableHttps(config.readApi?.baseUrl,'readApi.baseUrl');
  if(config.readApi?.schema!=='420-ai-read-v1')throw new Error('unsupported AI read schema');
  address(config.contracts?.jobManager,'contracts.jobManager');
  address(config.contracts?.jobEscrow,'contracts.jobEscrow');
  const tx=config.transactions??{};
  if(!Number.isInteger(tx.minConfirmations)||tx.minConfirmations<1||tx.minConfirmations>64)throw new Error('transactions.minConfirmations invalid');
  if(!Number.isInteger(tx.pollIntervalMs)||tx.pollIntervalMs<250||tx.pollIntervalMs>30000)throw new Error('transactions.pollIntervalMs invalid');
  if(!Number.isInteger(tx.timeoutMs)||tx.timeoutMs<1000||tx.timeoutMs>900000)throw new Error('transactions.timeoutMs invalid');
  for(const key of ['walletConnection','requestCreation','requestCancellation','disputeOpening','fundingDisplay']){
    if(typeof config.features?.[key]!=='boolean')throw new Error('missing feature flag '+key);
  }
  if((config.features.requestCreation||config.features.requestCancellation||config.features.disputeOpening)&&!config.network.chainId)throw new Error('transaction features require configured chainId');
  return config;
}
export function clientReadiness420(config){
  const reasons=[];
  if(!config.network?.chainId)reasons.push('NETWORK_UNMATERIALIZED');
  if(!config.readApi?.baseUrl)reasons.push('READ_API_UNMATERIALIZED');
  if(!config.contracts?.jobManager)reasons.push('JOB_MANAGER_UNMATERIALIZED');
  return Object.freeze({ready:reasons.length===0,reasons:Object.freeze(reasons)});
}
