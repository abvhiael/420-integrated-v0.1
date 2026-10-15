// R06.4 safe authenticated intents to the existing R04 economy runtime.
// Never submit an on-chain transfer, finalize escrow, credit rewards, or pick an account ID.
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const opaque=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const pos=x=>Number.isSafeInteger(x)&&x>0;
export function createHighCountryMarketConsumer420({apiUrl,authenticate,assertWalletNetwork,fetchImpl=fetch}={}){
 if(typeof apiUrl!=='string'||!/^https:\/\/[^/?#]+$/.test(apiUrl)||typeof authenticate!=='function'||
 typeof assertWalletNetwork!=='function'||typeof fetchImpl!=='function')fail('market-client-config-invalid');
 async function submit(path,input){
  await assertWalletNetwork();
  const token=await authenticate();if(typeof token!=='string'||!token||token.length>4096||/\s/.test(token))fail('market-auth-required');
  let response;try{response=await fetchImpl(new URL(path,apiUrl+'/'),{method:'POST',credentials:'omit',cache:'no-store',
    headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(input)});}
  catch{fail('market-service-unavailable');}
  if(!response?.ok)fail(response?.status===401||response?.status===403?'market-action-denied':'market-service-unavailable');
  let data;try{data=await response.json();}catch{fail('market-response-invalid');}
  if(data?.ok!==true||!Object.hasOwn(data,'result'))fail('market-response-invalid');
  return data.result;
 }
 return Object.freeze({
  list:({operation,listing,asset,quantity,price,expiresAt}={})=>{
   if(![operation,listing,asset].every(opaque)||!pos(quantity)||!pos(price)||
    !Number.isSafeInteger(expiresAt)||expiresAt<=Date.now())fail('market-input-invalid');
   return submit('/market/list',{operation,listing,asset,quantity,price,expiresAt});
  },
  prepare:(input={})=>{
   const {operation,listing,transferOperation}=input;
   if(Object.keys(input).sort().join(',')!=='listing,operation,transferOperation'||![operation,listing,transferOperation].every(opaque))fail('market-input-invalid');
   return submit('/market/prepare',{operation,listing,transferOperation});
  },
  claimReward:({source,proof}={})=>{
   if(!opaque(source)||!proof||typeof proof!=='object'||Array.isArray(proof)||
     Object.keys(proof).sort().join(',')!=='payload,signature'||
     !['payload','signature'].every(k=>typeof proof[k]==='string'&&proof[k].length>0&&proof[k].length<=8192))
    fail('market-reward-proof-invalid');
   return submit('/rewards/claim',{source,proof});
  }
 });
}
