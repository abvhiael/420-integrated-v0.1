// R06.1: no fake production endpoints, authority, network or wallet fallback.
const address=x=>typeof x==='string'&&/^0x[0-9a-fA-F]{40}$/.test(x)&&!/^0x0{40}$/i.test(x);
const hash=x=>typeof x==='string'&&/^0x[0-9a-fA-F]{64}$/.test(x)&&!/^0x0{64}$/i.test(x);
const url=x=>{try{const a=new URL(x);return a.protocol==='https:'&&!a.username&&!a.password&&!a.hash&&!a.search;}catch{return false;}};
export function validateHighCountryRuntime(config){
 if(!config||typeof config!=='object'||config.schema!=='highcountry-web-runtime-v1')throw Error('runtime-schema-invalid');
 if(config.mode==='offline'){
  if(config.rpcUrl||config.apiUrl||config.contracts||config.chainId||config.gameId)throw Error('offline-network-must-be-unset');
  return Object.freeze({mode:'offline',networkStatus:'not-configured',walletOptional:true});
 }
 if(config.mode!=='connected'||!Number.isSafeInteger(config.chainId)||config.chainId<1||
 !hash(config.gameId)||!url(config.rpcUrl)||!url(config.apiUrl)||!config.contracts||
 !address(config.contracts.gameRegistry)||!address(config.contracts.gameIdentity)||
 !address(config.contracts.gameEntitlements)||!address(config.contracts.gameClaims))
 throw Error('connected-network-invalid');
 return Object.freeze({mode:'connected',networkStatus:'configured-not-verified',
  chainId:config.chainId,gameId:config.gameId,rpcUrl:config.rpcUrl,apiUrl:config.apiUrl,
  contracts:Object.freeze({...config.contracts}),walletOptional:true});
}
export async function detectHighCountryNetwork(config,{fetchImpl=fetch,signal}={}){
 if(config.mode!=='connected')return {status:'offline'};
 let response;
 try{
  response=await fetchImpl(config.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]}),signal});
  if(!response.ok)throw Error('rpc-http');
  const json=await response.json();
  if(json.jsonrpc!=='2.0'||json.id!==1||typeof json.result!=='string'||json.error)throw Error('rpc-invalid');
  const chain=BigInt(json.result);
  return chain===BigInt(config.chainId)?{status:'connected',chainId:config.chainId}:
   {status:'wrong-network',expected:config.chainId,received:chain.toString()};
 }catch{return {status:'unavailable'};}
}
