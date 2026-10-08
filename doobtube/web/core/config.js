const IDS={
  media:'420/service/media/v1',
  search:'420/service/search/v1',
  notifications:'420/service/notifications/v1'
};
function nullableURL(value){
  if(value===null)return true;
  if(typeof value!=='string'||!value.trim())return false;
  try{
    const u=new URL(value);
    if(u.username||u.password||u.hash)return false;
    return u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1','::1'].includes(u.hostname));
  }catch{return false;}
}
export function validateRuntimeConfig(config){
  if(!config||config.schema!=='doobtube-web-runtime-v1')throw Error('invalid DoobTube runtime schema');
  if(config.site?.productionOrigin!==null)throw Error('production origin must remain unresolved before deployment');
  const chain=config.network?.chainId;
  if(chain!==null&&(!Number.isSafeInteger(chain)||chain<=0))throw Error('invalid chainId');
  const network=config.network?.network;
  if(network!==null&&(typeof network!=='string'||!network.trim()))throw Error('invalid network');
  for(const [name,id] of Object.entries(IDS)){
    if(config.services?.[name]?.serviceId!==id)throw Error(name+' service id mismatch');
  }
  for(const key of ['doobtube','media','search','notifications']){
    if(!nullableURL(config.services?.[key]?.baseUrl))throw Error('invalid '+key+' service URL');
  }
  const raw=JSON.stringify(config);
  if(/privateKey|seedPhrase|mnemonic|apiKey|authorizationToken|password|rawSecret/i.test(raw))throw Error('secret-like runtime field forbidden');
  return structuredClone(config);
}
export function readiness(config){
  const missing=[];
  if(!config?.network?.chainId)missing.push('chainId');
  if(!config?.network?.network)missing.push('network');
  if(!config?.services?.doobtube?.baseUrl)missing.push('doobtubeApi');
  if(!config?.services?.media?.baseUrl)missing.push('mediaApi');
  return {ready:missing.length===0,missing};
}
export function feature(config,key){return config?.features?.[key]===true;}
export {IDS};
