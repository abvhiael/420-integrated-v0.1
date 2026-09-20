/**
 * @typedef {{ok:boolean,status:number,data:any}} ServiceResult
 */

function assertBaseUrl(value,name){
  const url=new URL(value);
  if(url.protocol!=='https:' && !['localhost','127.0.0.1','::1'].includes(url.hostname)){
    throw new Error(`${name} base URL must use https`);
  }
  return url.toString().replace(/\/$/,'');
}

export function createJsonServiceClient({name,baseUrl,fetchImpl=fetch}){
  const base=assertBaseUrl(baseUrl,name);
  async function request(path,{method='GET',body,signal,headers={}}={}){
    if(typeof path!=='string'||!path.startsWith('/')) throw new Error('service path must be absolute');
    const response=await fetchImpl(`${base}${path}`,{
      method,
      signal,
      credentials:'omit',
      headers:{'accept':'application/json',...(body===undefined?{}:{'content-type':'application/json'}),...headers},
      body:body===undefined?undefined:JSON.stringify(body),
    });
    let data=null;
    const type=response.headers?.get?.('content-type')??'';
    if(type.includes('application/json')) data=await response.json();
    return Object.freeze({ok:response.ok,status:response.status,data});
  }
  return Object.freeze({name,baseUrl:base,request});
}

export function createBongGogglesServices(config,{fetchImpl=fetch}={}){
  if(!config||config.schema!=='bg-web-runtime-v1') throw new Error('validated runtime config required');
  return Object.freeze({
    indexer:createJsonServiceClient({name:'indexer',baseUrl:config.indexerUrl,fetchImpl}),
    media:createJsonServiceClient({name:'media',baseUrl:config.mediaUrl,fetchImpl}),
    messenger:createJsonServiceClient({name:'messenger',baseUrl:config.messengerUrl,fetchImpl}),
    notifications:createJsonServiceClient({name:'notifications',baseUrl:config.notificationsUrl,fetchImpl}),
    wallet:createJsonServiceClient({name:'wallet',baseUrl:config.walletUrl,fetchImpl}),
    explorer:createJsonServiceClient({name:'explorer',baseUrl:config.explorerUrl,fetchImpl}),
    authoritative:false,
  });
}
