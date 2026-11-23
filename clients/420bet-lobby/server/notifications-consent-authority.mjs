// BET-AUDIT-7: current consent comes from authenticated 420Notifications,
// never from an owner-supplied subscription list or a cached browser preference.
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const need=(ok,message)=>{if(!ok)throw Error('420Bet consent: '+message);};
export function create420NotificationsConsentAuthority({origin,bearerToken,fetcher=fetch,timeoutMs=8000}={}){
 const u=new URL(origin);
 need(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/'&&u.hostname,'private HTTPS root origin required');
 need(typeof bearerToken==='string'&&bearerToken.length>=32&&bearerToken.length<=4096&&/^[A-Za-z0-9._~+/-]+$/.test(bearerToken),'service credential required');
 need(Number.isInteger(timeoutMs)&&timeoutMs>=100&&timeoutMs<=60000,'invalid request timeout');
 return async function checkConsent(request){
  need(request&&request.tenant==='420bet'&&['mail','notifications'].includes(request.channel)&&
   ['userId','subscriptionId','recipient','kind','policyVersion'].every(k=>ID.test(request[k])),
   'invalid private consent scope');
  const response=await fetcher(u.origin+'/v1/420bet/subscriptions/check',{
   method:'POST',redirect:'error',cache:'no-store',credentials:'omit',
   headers:{Authorization:'Bearer '+bearerToken,Accept:'application/json','Content-Type':'application/json'},
   body:JSON.stringify(request),signal:AbortSignal.timeout(timeoutMs)
  });
  need(response?.ok,'420Notifications consent unavailable');
  const raw=await response.text();
  need(raw.length<=8192,'oversized consent response');
  const value=JSON.parse(raw);
  need(value&&typeof value==='object'&&!Array.isArray(value)&&
   ['tenant','userId','subscriptionId','recipient','channel','policyVersion'].every(k=>value[k]===request[k])&&
   typeof value.active==='boolean'&&typeof value.muted==='boolean'&&
   typeof value.revoked==='boolean'&&typeof value.consent==='boolean',
   'consent response scope mismatch');
  return Object.freeze({tenant:request.tenant,userId:request.userId,subscriptionId:request.subscriptionId,
   recipient:request.recipient,channel:request.channel,policyVersion:request.policyVersion,
   active:value.active,muted:value.muted,revoked:value.revoked,consent:value.consent});
 };
}
