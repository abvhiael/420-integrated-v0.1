const ENVIRONMENTS=new Set(['testnet','staging','production']);

function requiredString(value,field){
  if(typeof value!=='string'||value.trim()==='') throw new Error(`${field} is required`);
  return value.trim();
}

function httpsUrl(value,field,{allowLocalhost=false}={}){
  const text=requiredString(value,field);
  const url=new URL(text);
  const local=allowLocalhost && ['localhost','127.0.0.1','::1'].includes(url.hostname);
  if(url.protocol!=='https:' && !local) throw new Error(`${field} must use https`);
  return url.toString().replace(/\/$/,'');
}

export function validateRuntimeConfig(input){
  if(!input||typeof input!=='object'||Array.isArray(input)) throw new Error('runtime config object required');
  const environment=requiredString(input.environment,'environment');
  if(!ENVIRONMENTS.has(environment)) throw new Error('unsupported environment');

  const chainId=Number(input.chainId);
  if(!Number.isSafeInteger(chainId)||chainId<=0) throw new Error('chainId must be a positive safe integer');

  const allowLocalhost=environment!=='production';
  const config={
    schema:'bg-web-runtime-v1',
    environment,
    appOrigin:httpsUrl(input.appOrigin,'appOrigin',{allowLocalhost}),
    chainId,
    rpcUrl:httpsUrl(input.rpcUrl,'rpcUrl',{allowLocalhost}),
    indexerUrl:httpsUrl(input.indexerUrl,'indexerUrl',{allowLocalhost}),
    mediaUrl:httpsUrl(input.mediaUrl,'mediaUrl',{allowLocalhost}),
    messengerUrl:httpsUrl(input.messengerUrl,'messengerUrl',{allowLocalhost}),
    notificationsUrl:httpsUrl(input.notificationsUrl,'notificationsUrl',{allowLocalhost}),
    walletUrl:httpsUrl(input.walletUrl,'walletUrl',{allowLocalhost}),
    explorerUrl:httpsUrl(input.explorerUrl,'explorerUrl',{allowLocalhost}),
    maintenance:input.maintenance===true,
    features:Object.freeze({...input.features}),
    authoritative:false,
  };

  if(environment==='production' && new URL(config.appOrigin).hostname!=='bonggoggles.420integrated.org'){
    throw new Error('production appOrigin must be bonggoggles.420integrated.org');
  }
  return Object.freeze(config);
}

export async function loadRuntimeConfig(fetchImpl=fetch,url='/runtime-config.json'){
  const response=await fetchImpl(url,{cache:'no-store',credentials:'same-origin'});
  if(!response.ok) throw new Error(`runtime config request failed: ${response.status}`);
  return validateRuntimeConfig(await response.json());
}
