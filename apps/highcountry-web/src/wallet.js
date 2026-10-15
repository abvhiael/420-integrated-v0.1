// R06.4 optional wallet link: no auto-connect, keys, silent network switch or automatic transactions.
const fail=code=>{throw Object.assign(new Error(code),{code});};
const address=x=>typeof x==='string'&&/^0x[0-9a-fA-F]{40}$/.test(x)&&!/^0x0{40}$/i.test(x);
export function createOptionalWallet420({provider,authenticate,apiUrl,gameId,chainId,fetchImpl=fetch}={}){
 if(typeof provider?.request!=='function'||typeof authenticate!=='function'||typeof apiUrl!=='string'||
 !apiUrl.startsWith('https://')||!/^0x[0-9a-fA-F]{64}$/.test(gameId||'')||
 !Number.isSafeInteger(chainId)||chainId<1)fail('wallet-config-invalid');
 let selected=null,linked=null;
 const verifyChain=async()=>{
  let value;try{value=await provider.request({method:'eth_chainId'});}catch{fail('wallet-network-unavailable');}
  if(typeof value!=='string'||!/^0x[0-9a-fA-F]+$/.test(value)||BigInt(value)!==BigInt(chainId))fail('wallet-wrong-network');
 };
 const token=async()=>{const x=await authenticate();if(typeof x!=='string'||!x||x.length>4096||/\s/.test(x))fail('wallet-auth-required');return x;};
 async function call(path,method='GET',body){
  const auth=await token();let response;
  try{response=await fetchImpl(new URL(path,apiUrl+'/'),{method,credentials:'omit',cache:'no-store',
   headers:{authorization:'Bearer '+auth,'content-type':'application/json'},
   ...(body?{body:JSON.stringify(body)}:{})});}catch{fail('wallet-service-unavailable');}
  if(!response.ok)fail(response.status===401||response.status===403?'wallet-auth-denied':'wallet-service-unavailable');
  let v;try{v=(await response.json()).result;}catch{fail('wallet-response-invalid');}
  return v;
 }
 async function connect(){
  await token();await verifyChain();let accounts;
  try{accounts=await provider.request({method:'eth_requestAccounts'});}catch{fail('wallet-user-rejected');}
  if(!Array.isArray(accounts)||accounts.length===0||!address(accounts[0]))fail('wallet-address-invalid');
  await verifyChain();selected=accounts[0].toLowerCase();return selected;
 }
 async function link({consentId,policyHash,consentAccepted}={}){
  if(!selected||consentAccepted!==true||typeof consentId!=='string'||!consentId||
    !/^0x[0-9a-fA-F]{64}$/.test(policyHash||''))fail('wallet-consent-required');
  await verifyChain();
  const challenge=await call('/v1/wallet/challenge','POST',{wallet:selected,chainId:String(chainId),consentId,policyHash,consentAccepted:true});
  if(!challenge||challenge.wallet?.toLowerCase()!==selected||challenge.chainId!==String(chainId)||
   typeof challenge.message!=='string'||!challenge.message.includes(gameId)||
   !/^[A-Za-z0-9:_-]{1,128}$/.test(challenge.challengeId||''))fail('wallet-challenge-invalid');
  let signature;
  try{signature=await provider.request({method:'personal_sign',params:[challenge.message,selected]});}
  catch{fail('wallet-signature-rejected');}
  if(typeof signature!=='string'||!/^0x[0-9a-fA-F]{130,4096}$/.test(signature))fail('wallet-signature-invalid');
  await verifyChain();
  const session=await call('/v1/wallet/complete','POST',{challengeId:challenge.challengeId,signature});
  linked=session;return session;
 }
 async function session(){const x=await call('/v1/session');if(x?.gameId!==gameId)fail('wallet-scope-invalid');linked=x.wallet??null;return x;}
 async function scopedActivity({limit=25}={}){
  if(!Number.isInteger(limit)||limit<1||limit>100)fail('wallet-activity-limit-invalid');
  const auth=await token();let response;
  try{const url=new URL('/events',apiUrl+'/');url.searchParams.set('limit',String(limit));
   response=await fetchImpl(url.toString(),{method:'GET',credentials:'omit',cache:'no-store',
     headers:{authorization:'Bearer '+auth}});}catch{fail('wallet-activity-unavailable');}
  if(!response?.ok)fail(response?.status===401||response?.status===403?'wallet-auth-denied':'wallet-activity-unavailable');
  let data;try{data=await response.json();}catch{fail('wallet-activity-invalid');}
  if(!data||!Array.isArray(data.events)||data.events.length>limit)fail('wallet-activity-invalid');
  return data.events;
 }
 async function unlink(){await call('/v1/wallet/unlink','POST',{});linked=null;selected=null;return true;}
 function disconnect(){selected=null;linked=null;}
 const change=()=>disconnect();
 if(typeof provider.on==='function'){provider.on('accountsChanged',change);provider.on('chainChanged',change);provider.on('disconnect',change);}
 return Object.freeze({connect,link,session,scopedActivity,unlink,disconnect,getSelected:()=>selected,getLinked:()=>linked});
}
