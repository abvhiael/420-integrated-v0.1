// BET-AUDIT-7: server-held 420Mail sender credential broker.
// No wallet, browser, recipient or event may choose the authenticated sender.
// Mail itself verifies its actor through Authenticate + IdentityDirectory.
const ID=/^[A-Za-z0-9._:-]{1,128}$/;
const TOKEN=/^[A-Za-z0-9._~+/-]{32,4096}$/;
const need=(ok,reason)=>{if(!ok)throw Error('420Bet Mail broker: '+reason);};
export function createVerified420MailActorBroker({
 origin,sender,serviceToken,fetcher=fetch,timeoutMs=8000
}={}){
 const u=new URL(origin);
 need(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&
  u.pathname==='/'&&u.hostname,'qualified HTTPS Mail root origin required');
 need(typeof sender==='string'&&ID.test(sender),'approved canonical sender required');
 need(typeof serviceToken==='string'&&TOKEN.test(serviceToken),'server-only Mail actor credential required');
 need(Number.isSafeInteger(timeoutMs)&&timeoutMs>=100&&timeoutMs<=60000,'invalid timeout');
 const authorization='Bearer '+serviceToken;
 const url=u.origin+'/v1/auth/actor';
 async function verifiedActor(){
  const response=await fetcher(url,{
   method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
   headers:{Accept:'application/json',Authorization:authorization},
   signal:AbortSignal.timeout(timeoutMs)
  });
  need(response?.ok,'Mail authentication or sender identity unavailable');
  const raw=await response.text();
  need(raw.length>0&&raw.length<=4096,'invalid Mail authentication response size');
  const data=JSON.parse(raw);
  need(data&&typeof data==='object'&&!Array.isArray(data)&&
   data.service==='420/service/mail/v1'&&data.verified===true&&
   data.actor===sender,'Mail sender identity does not match approved actor');
  return {authorization,sender};
 }
 return Object.freeze({
  async authorizeActor(request){
   need(request&&request.tenant==='420bet'&&request.channel==='mail'&&
    typeof request.userId==='string'&&ID.test(request.userId)&&
    typeof request.recipient==='string'&&ID.test(request.recipient),
    'invalid owner-scoped Mail delivery request');
   // Verify the credential and actual 420Mail authenticated sender every time,
   // including status/cancellation. A rotated or revoked token fails closed.
   return Object.freeze(await verifiedActor());
  },
  checkReadiness:async()=>{await verifiedActor();return true;}
 });
}
