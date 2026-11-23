// BET-AUDIT-7: authenticated, ordered 420Notifications revocation feed.
// The outbox commits each event's cancellation tombstone with its cursor.
const validId=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function need(ok,message){if(!ok)throw Error('420Bet revocations: '+message);}
export function create420NotificationsRevocationReader({
 origin,bearerToken,fetcher=fetch,timeoutMs=8000
}={}){
 const u=new URL(origin);
 need(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/'&&u.hostname,
  'approved HTTPS root required');
 need(typeof bearerToken==='string'&&bearerToken.length>=32&&bearerToken.length<=4096&&
  /^[A-Za-z0-9._~+/-]+$/.test(bearerToken),'private read credential required');
 need(Number.isInteger(timeoutMs)&&timeoutMs>=100&&timeoutMs<=60000,'invalid timeout');
 return async function read(after,{limit=50}={}){
  need(Number.isSafeInteger(after)&&after>=0&&Number.isSafeInteger(limit)&&limit>=1&&limit<=100,
   'invalid cursor');
  const response=await fetcher(u.origin+'/v1/420bet/subscriptions/revocations',{
   method:'POST',redirect:'error',cache:'no-store',credentials:'omit',
   headers:{Authorization:'Bearer '+bearerToken,'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify({after,limit}),signal:AbortSignal.timeout(timeoutMs)
  });
  need(response?.ok,'revocation feed unavailable');
  const raw=await response.text();
  need(raw.length<=32768,'oversized revocation feed');
  const result=JSON.parse(raw);
  need(result&&Array.isArray(result.events)&&result.events.length<=limit,
   'invalid revocation batch');
  return result.events.map((event,i)=>{
   need(event&&Number.isSafeInteger(event.sequence)&&event.sequence===after+i+1&&
    event.tenant==='420bet'&&validId.test(event.userId)&&validId.test(event.subscriptionId)&&
    Number.isSafeInteger(event.revision)&&event.revision>0&&
    ['revoked','consent_withdrawn'].includes(event.reason),
    'untrusted or noncontiguous revocation');
   return Object.freeze({sequence:event.sequence,tenant:event.tenant,
    userId:event.userId,subscriptionId:event.subscriptionId});
  });
 };
}
export function createBetRevocationConsumer({readRevocations,outbox}={}){
 need(typeof readRevocations==='function'&&typeof outbox?.getRevocationCursor==='function'&&
  typeof outbox?.revokeSubscription==='function','qualified revocation feed and durable outbox required');
 return Object.freeze({async sync({limit=50}={}){
  need(Number.isSafeInteger(limit)&&limit>=1&&limit<=100,'invalid sync limit');
  // Single logical writer: the outbox protects persistent cursor advancement,
  // so overlapping syncs cannot skip sequence numbers.
  const cursor=await outbox.getRevocationCursor();
  const events=await readRevocations(cursor,{limit});
  let processed=0,unconfirmed=0;
  for(const event of events){
   const result=await outbox.revokeSubscription({...event});
   if(!result.duplicate)processed++;
   unconfirmed+=result.remoteCancellationUnconfirmed;
  }
  return Object.freeze({processed,cursor:await outbox.getRevocationCursor(),
   remoteCancellationUnconfirmed:unconfirmed});
 }});
}
