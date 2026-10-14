// R05.8 constrained transport foundation. Never retries writes or authorization failures.
export class GamingTransportError420 extends Error {
 constructor(code,details={}){super(code);this.name='GamingTransportError420';this.code=code;this.details=Object.freeze({...details});}
}
const fail=(code,details)=>{throw new GamingTransportError420(code,details)};
const H=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x)&&x!=='0x'+'0'.repeat(64);
const A=x=>typeof x==='string'&&/^0x[0-9a-f]{40}$/.test(x)&&x!=='0x'+'0'.repeat(40);
const U=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)>0n&&BigInt(x)<(1n<<64n);
const safeUrl=x=>{try{const u=new URL(x);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&!u.search;}catch{return false;}};
const retryable=new Set([408,429,502,503,504]);
export function validateGamingDeployment420({manifest,expectedChainId,gameId}={}){
 if(!U(String(expectedChainId))||!H(gameId)||!manifest||typeof manifest!=='object'||
  String(manifest.chainId)!==String(expectedChainId)||manifest.gameId!==gameId||
  !safeUrl(manifest.rpcUrl)||!safeUrl(manifest.apiUrl)||!safeUrl(manifest.witnessUrl)||
  manifest.rpcUrl===manifest.witnessUrl)fail('gaming-deployment-invalid');
 const required=['games','identity','entitlements','crossGame','claims','bridge','migration'];
 const entries=manifest.contracts;
 if(!entries||typeof entries!=='object'||!required.every(k=>A(entries[k]?.address)&&H(entries[k]?.codeHash))||
   new Set(required.map(k=>entries[k].address)).size!==required.length)
  fail('gaming-contract-manifest-invalid');
 return Object.freeze({chainId:String(expectedChainId),gameId,rpcUrl:manifest.rpcUrl,
  apiUrl:manifest.apiUrl,witnessUrl:manifest.witnessUrl,
  contracts:Object.freeze(Object.fromEntries(Object.entries(entries).map(([k,v])=>
   [k,Object.freeze({address:v.address,codeHash:v.codeHash})])))});
}
export function createGamingRpcTransport420({deployment,provider,fetchImpl=fetch,timeoutMs=8000,
 maxAttempts=3,backoff=async()=>{}}={}){
 if(!deployment||typeof fetchImpl!=='function'||typeof backoff!=='function'||
  !Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000||
  !Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>4)
  fail('gaming-rpc-configuration');
 let id=0;
 const call=async(method,params)=>{
  const allow=['eth_chainId','eth_getBlockByNumber','eth_getCode','eth_call','eth_getTransactionReceipt','eth_getLogs'];
  if(!allow.includes(method)||!Array.isArray(params))fail('gaming-rpc-method-denied');
  for(let attempt=1;attempt<=maxAttempts;attempt++){
   try{
    const requestId=++id;
    const response=await fetchImpl(deployment.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:requestId,method,params}),signal:AbortSignal.timeout(timeoutMs)});
    if(!response.ok){
     if(retryable.has(response.status)&&attempt<maxAttempts){await backoff(attempt);continue;}
     fail('gaming-rpc-http-failure',{status:response.status});
    }
    const result=await response.json();
    if(result?.id!==requestId||result.jsonrpc!=='2.0'||result.error||
      !Object.hasOwn(result,'result'))fail('gaming-rpc-malformed');
    return result.result;
   }catch(e){
    if(e instanceof GamingTransportError420)throw e;
    if(attempt===maxAttempts)fail('gaming-rpc-unavailable');
    await backoff(attempt);
   }
  }
 };
 const chain=async()=>{
  const response=await call('eth_chainId',[]);
  let observed;try{observed=BigInt(response).toString();}catch{fail('gaming-rpc-invalid-chain');}
  if(observed!==deployment.chainId)fail('gaming-wrong-network',{expected:deployment.chainId,observed});
  if(provider?.request){
   let active;
   try{active=await provider.request({method:'eth_chainId'});}catch{fail('gaming-wallet-disconnected');}
   try{if(BigInt(active).toString()!==deployment.chainId)fail('gaming-wallet-wrong-network');}
   catch(e){if(e instanceof GamingTransportError420)throw e;fail('gaming-wallet-invalid-network');}
  }
  return observed;
 };
 return Object.freeze({request:call,assertNetwork:chain,deployment});
}
export function createGamingSessionTransport420({deployment,getToken,fetchImpl=fetch,timeoutMs=8000}={}){
 if(!deployment||typeof getToken!=='function'||typeof fetchImpl!=='function'||!Number.isInteger(timeoutMs)||
 timeoutMs<100||timeoutMs>30000)fail('gaming-http-configuration');
 return Object.freeze({async events({limit=50,before=null}={}){
  const token=await getToken();
  if(typeof token!=='string'||!token||/\s/.test(token))fail('gaming-session-missing');
  if(!Number.isInteger(limit)||limit<1||limit>100)fail('gaming-pagination-invalid');
  const u=new URL('/events',deployment.apiUrl);
  u.searchParams.set('limit',String(limit));
  if(before!==null){
   if(!before||typeof before!=='object'||!['blockNumber','txIndex','logIndex','contract'].every(k=>typeof before[k]==='string'))
    fail('gaming-pagination-invalid');
   u.searchParams.set('beforeBlock',before.blockNumber);u.searchParams.set('beforeTxIndex',before.txIndex);
   u.searchParams.set('beforeLogIndex',before.logIndex);u.searchParams.set('beforeContract',before.contract);
  }
  let result;
  try{result=await fetchImpl(u.toString(),{method:'GET',headers:{authorization:'Bearer '+token},
   signal:AbortSignal.timeout(timeoutMs),cache:'no-store'});}catch{fail('gaming-http-unavailable');}
  if(result.status===401||result.status===403)fail('gaming-session-revoked');
  if(!result.ok)fail('gaming-http-failure',{status:result.status});
  let data;try{data=await result.json();}catch{fail('gaming-http-malformed');}
  if(!data||!Array.isArray(data.events)||data.events.length>limit)fail('gaming-http-malformed');
  return Object.freeze(data.events);
 }});
}
