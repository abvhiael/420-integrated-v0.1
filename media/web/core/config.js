const SERVICE_ID='420/service/media/v1';

function nullableWebURL(value,{allowLoopback=true}={}){
  if(value===null)return true;
  if(typeof value!=='string'||!value.trim())return false;
  try{
    const u=new URL(value);
    if(u.username||u.password||u.hash)return false;
    if(u.protocol==='https:')return true;
    return allowLoopback&&u.protocol==='http:'&&['localhost','127.0.0.1','::1'].includes(u.hostname);
  }catch{return false;}
}

export function validateRuntimeConfig(config){
  if(!config||config.schema!=='420-media-web-runtime-v1')throw new Error('invalid Media runtime schema');
  if(config.registry?.serviceId!==SERVICE_ID)throw new Error('canonical Media service id mismatch');
  const chainId=config.network?.chainId;
  if(chainId!==null&&(!Number.isSafeInteger(chainId)||chainId<=0))throw new Error('invalid Media chainId');
  const network=config.network?.network;
  if(network!==null&&(typeof network!=='string'||!network.trim()))throw new Error('invalid Media network');
  if(!nullableWebURL(config.network?.explorerUrl))throw new Error('invalid Media explorer URL');
  if(!nullableWebURL(config.api?.baseUrl))throw new Error('invalid Media API URL');
  if(config.site?.productionOrigin!==null)throw new Error('production origin must remain unresolved before deployment');
  return structuredClone(config);
}

export function runtimeReadiness(config,{compatibility=null,capabilities=null,wallet=null}={}){
  const missing=[];
  if(!config?.api?.baseUrl)missing.push('apiBaseUrl');
  const chainId=compatibility?.chain_id??compatibility?.chainId??config?.network?.chainId;
  const network=compatibility?.network??config?.network?.network;
  if(!chainId)missing.push('chainId');
  if(!network)missing.push('network');
  if(config?.execution?.requireCapabilityDiscovery&&capabilities?.service_id!=='420/service/media/v1'&&capabilities?.serviceId!=='420/service/media/v1')missing.push('capabilities');
  if(wallet&&chainId&&Number(BigInt(wallet.chainId))!==Number(chainId))missing.push('walletChainMismatch');
  return {ready:missing.length===0,missing,chainId,network};
}

export function featureEnabled(config,capabilities,key){
  if(config?.features?.[key]===false)return false;
  const features=capabilities?.features;
  if(features&&Object.prototype.hasOwnProperty.call(features,key))return features[key]===true;
  if(key==='livestreaming'&&features&&Object.prototype.hasOwnProperty.call(features,'media.livestreaming'))return features['media.livestreaming']===true;
  return config?.features?.[key]===true;
}

export {SERVICE_ID};
