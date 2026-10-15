// R06.3 browser adapter. Identity is supplied by the approved external authenticator,
 // never inferred from local guest state or caller-provided account IDs.
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function createCloudClient({apiUrl,authenticate,fetchImpl=fetch,gameId}={}){
 if(typeof apiUrl!=='string'||!apiUrl.startsWith('https://')||
 typeof authenticate!=='function'||!/^0x[0-9a-fA-F]{64}$/.test(gameId||''))fail('cloud-config-invalid');
 async function request(method,path,body){
  const token=await authenticate();
  if(typeof token!=='string'||!token||token.length>4096||/\s/.test(token))fail('authentication-required');
  let response;
  try{response=await fetchImpl(new URL(path,apiUrl+'/'),{
   method,mode:'cors',credentials:'omit',cache:'no-store',
   headers:{Authorization:'Bearer '+token,'content-type':'application/json'},
   ...(body?{body:JSON.stringify(body)}:{})
  });}catch{fail('cloud-service-unavailable');}
  if(!response?.ok){
   if(response?.status===401||response?.status===403)fail('authentication-denied');
   if(response?.status===409)fail('cloud-save-conflict');
   if(response?.status===404)fail('cloud-save-not-found');
   fail('cloud-service-unavailable');
  }
  let result;try{result=await response.json();}catch{fail('cloud-response-invalid');}
  if(!result||typeof result!=='object'||Array.isArray(result)||result.gameId!==gameId)fail('cloud-scope-invalid');
  return result;
 }
 return Object.freeze({
  session:()=>request('GET','/highcountry/session'),
  read:()=>request('GET','/highcountry/save'),
  publish:({expectedRevision,consentId,schemaLabel,save})=>{
   if(!/^(0|[1-9][0-9]*)$/.test(expectedRevision)||typeof consentId!=='string'||!consentId||
    typeof schemaLabel!=='string'||!schemaLabel||!save||typeof save!=='object')fail('cloud-request-invalid');
   return request('POST','/highcountry/save',{expectedRevision,consentId,schemaLabel,save});
  },
  restore:({backupRevision,expectedHead,consentId,schemaLabel})=>{
   if(!/^[1-9][0-9]*$/.test(backupRevision)||!/^(0|[1-9][0-9]*)$/.test(expectedHead)||!consentId||!schemaLabel)fail('cloud-request-invalid');
   return request('POST','/highcountry/restore',{backupRevision,expectedHead,consentId,schemaLabel});
  }
 });
}
