// BET-AUDIT-7: privacy-minimized notification envelope and real Mail outbox transport.
// No wallet balance, bet amount, PII, payment intent or spending capability is accepted.
import {createHash} from 'node:crypto';
const HEX=/^0x[0-9a-fA-F]{64}$/;
const ACCT=/^0x[0-9a-fA-F]{40}$/;
const ID=/^[a-zA-Z0-9._:-]{1,128}$/;
const TENANT=/^[a-z0-9][a-z0-9-]{1,39}$/;
const KINDS=new Set(['wager-accepted','wager-settled','wager-voided','game-paused','game-resumed','reorg-retracted']);
const CHANNELS=new Set(['notifications','mail']);
const err=(reason)=>{throw Error('420Bet delivery: '+reason);};
const requireValid=(ok,reason)=>{if(!ok)err(reason);};
const digest=(v)=>createHash('sha256').update(v).digest('hex');
const hex=(v,name)=>{requireValid(typeof v==='string'&&HEX.test(v),'invalid '+name);return v.toLowerCase();};
const addr=(v)=>{requireValid(typeof v==='string'&&ACCT.test(v),'invalid address');return v.toLowerCase();};
const str=(v,name)=>{requireValid(typeof v==='string'&&ID.test(v),'invalid '+name);return v;};
function verifiedEnvelope(event){
 requireValid(event&&typeof event==='object'&&!Array.isArray(event),'missing verified event');
 const allowed=['chainId','gameId','account','type','blockNumber','blockHash','transactionHash','logIndex'];
 requireValid(Object.keys(event).every(k=>allowed.includes(k)),'unapproved event data');
 requireValid(typeof event.chainId==='string'&&/^[1-9][0-9]*$/.test(event.chainId),'invalid event chain');
 requireValid(typeof event.blockNumber==='string'&&/^(0|[1-9][0-9]*)$/.test(event.blockNumber),'invalid block number');
 requireValid(typeof event.logIndex==='string'&&/^(0|[1-9][0-9]*)$/.test(event.logIndex),'invalid log index');
 requireValid(typeof event.gameId==='string'&&/^[a-z][a-z0-9-]{0,49}$/.test(event.gameId),'invalid game');
 requireValid(KINDS.has(event.type),'unapproved lifecycle event');
 return {chainId:event.chainId,gameId:event.gameId,account:addr(event.account),
  type:event.type,blockNumber:event.blockNumber,blockHash:hex(event.blockHash,'block'),
  transactionHash:hex(event.transactionHash,'transaction'),logIndex:event.logIndex};
}
export function makeBetDelivery({tenant,userId,channel,subscriptionId,recipient,source,kind,
 event,finality,policyVersion}={}){
 requireValid(typeof tenant==='string'&&TENANT.test(tenant),'invalid tenant');
 str(userId,'identity subject');str(subscriptionId,'subscription');
 requireValid(CHANNELS.has(channel),'invalid channel');
 requireValid(source==='420Indexer-finalized'&&finality==='finalized','non-final source rejected');
 str(policyVersion,'policy version');
 requireValid(!event?.type||event.type===kind,'event type substitution');
 const verified=verifiedEnvelope({...event,type:kind});
 // The destination is an opaque owner-scoped 420Identity account or
 // Notifications subscription route. Never accept raw email addresses.
 str(recipient,'canonical recipient');
 const eventId=digest([verified.chainId,verified.gameId,verified.transactionHash,
  verified.logIndex,verified.type,verified.blockHash].join('|'));
 const deliveryKey=digest([tenant,userId,channel,subscriptionId,recipient,eventId].join('|'));
 const publicEvent={schema:'420bet-notification-v1',kind:verified.type,game:verified.gameId,
  chainId:verified.chainId,blockNumber:verified.blockNumber,
  eventId,finality:'finalized'};
 const safeText={
  'wager-accepted':'A game event was finalized.',
  'wager-settled':'A game settlement was finalized.',
  'wager-voided':'A game record was voided.',
  'game-paused':'A game is paused.',
  'game-resumed':'A game resumed.',
  'reorg-retracted':'A previous game notification was retracted.'
 };
 return Object.freeze({deliveryKey,tenant,userId,channel,subscriptionId,recipient,
  policyVersion,source,eventId,kind:verified.type,event:publicEvent,
  title:'420Bet game update',body:safeText[verified.type]});
}
function secureOrigin(value){
 const u=new URL(value);
 requireValid(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&
  u.pathname==='/'&&u.hostname,'provider must be HTTPS root origin');
 return u.origin;
}
export function create420MailProvider({origin,authorizeActor,fetcher=fetch,timeoutMs=10000}={}){
 const base=secureOrigin(origin);
 requireValid(typeof authorizeActor==='function','trusted Mail actor authority required');
 async function req(path,method,auth,body){
  const response=await fetcher(base+path,{method,redirect:'error',credentials:'omit',cache:'no-store',
   headers:{'Content-Type':'application/json',Accept:'application/json',Authorization:auth},
   body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs)});
  requireValid(response?.ok,'Mail transport rejected request');
  const text=await response.text();
  requireValid(text.length<=16000,'Mail response too large');
  const result=JSON.parse(text);
  requireValid(result&&typeof result==='object'&&!Array.isArray(result),'invalid Mail response');
  return result;
 }
 async function authFor(delivery){
  const credential=await authorizeActor({tenant:delivery.tenant,userId:delivery.userId,
   recipient:delivery.recipient,channel:'mail'});
  requireValid(credential&&typeof credential.authorization==='string'&&
   credential.authorization.length>=16&&credential.authorization.length<=4096&&
   typeof credential.sender==='string'&&ID.test(credential.sender),
   'no verified sender identity');
  return credential;
 }
 return Object.freeze({
  async deliver(d){
   requireValid(d?.channel==='mail','Mail wrong channel');
   const actor=await authFor(d);
   // 420Mail enforces Sender == authenticated actor and Source == ServiceID
   // (the 420Mail service ID). Never claim source='420Bet' to bypass it.
   const payload={idempotency_key:d.deliveryKey,sender:actor.sender,recipient:d.recipient,
    subject:d.title,body:d.body,source:'420/service/mail/v1'};
   const queued=await req('/v1/outbox','POST',actor.authorization,payload);
   requireValid(typeof queued.id==='string'&&ID.test(queued.id)&&
    queued.idempotency_key===d.deliveryKey&&queued.owner===actor.sender&&
    queued.recipient===d.recipient,'Mail queue receipt mismatch');
   let result=queued;
   if(!['DELIVERED','CANCELLED'].includes(queued.status)){
    result=await req('/v1/outbox/'+encodeURIComponent(queued.id)+'/process','POST',actor.authorization);
   }
   requireValid(result.id===queued.id&&result.owner===actor.sender&&
    result.idempotency_key===d.deliveryKey,'Mail process receipt mismatch');
   if(result.status==='FAILED'||result.status==='CANCELLED')err('Mail delivery failed');
   // SENDING/RETRYING are not receipt-level proof of delivery.
   return {provider:'420Mail',externalId:result.id,
    status:result.status==='DELIVERED'?'delivered':'pending',authoritative:false};
  },
  async cancel(d,receipt){
   const actor=await authFor(d);
   if(!receipt?.externalId)return {cancelled:false};
   const result=await req('/v1/outbox/'+encodeURIComponent(receipt.externalId)+'/cancel',
    'POST',actor.authorization);
   requireValid(result.id===receipt.externalId,'Mail cancel receipt mismatch');
   return {cancelled:result.status==='CANCELLED'};
  },
  async status(d,receipt){
   const actor=await authFor(d);
   requireValid(receipt?.externalId&&ID.test(receipt.externalId),'missing Mail receipt');
   const result=await req('/v1/outbox/'+encodeURIComponent(receipt.externalId),
    'GET',actor.authorization);
   requireValid(result.id===receipt.externalId&&result.idempotency_key===d.deliveryKey&&
    result.owner===actor.sender,'Mail receipt scope mismatch');
   return {provider:'420Mail',externalId:result.id,
    status:result.status==='DELIVERED'?'delivered':
     result.status==='CANCELLED'?'cancelled':
     result.status==='FAILED'?'failed':'pending',authoritative:false};
  }
 });
}
export function create420NotificationsProvider({deliverAuthenticated,readReceipt,cancelDelivery}={}){
 requireValid(typeof deliverAuthenticated==='function'&&typeof readReceipt==='function'&&
  typeof cancelDelivery==='function','qualified Notifications adapter required');
 return Object.freeze({
  async deliver(d){
   requireValid(d?.channel==='notifications','Notifications wrong channel');
   const r=await deliverAuthenticated({tenant:d.tenant,userId:d.userId,
    subscriptionId:d.subscriptionId,recipient:d.recipient,idempotencyKey:d.deliveryKey,
    event:d.event,policyVersion:d.policyVersion});
   requireValid(r?.idempotencyKey===d.deliveryKey&&ID.test(r.deliveryId)&&
    ['pending','delivered'].includes(r.status),'Notifications receipt mismatch');
   return {provider:'420Notifications',externalId:r.deliveryId,status:r.status,authoritative:false};
  },
  async status(d,receipt){
   const r=await readReceipt({tenant:d.tenant,userId:d.userId,deliveryId:receipt.externalId,
    idempotencyKey:d.deliveryKey});
   requireValid(r?.idempotencyKey===d.deliveryKey&&r.deliveryId===receipt.externalId&&
    ['pending','delivered','failed','cancelled'].includes(r.status),'Notifications status mismatch');
   return {provider:'420Notifications',externalId:r.deliveryId,status:r.status,authoritative:false};
  },
  async cancel(d,receipt){
   const r=await cancelDelivery({tenant:d.tenant,userId:d.userId,deliveryId:receipt?.externalId??null,
    idempotencyKey:d.deliveryKey});
   requireValid(typeof r?.cancelled==='boolean','Notifications cancellation not verified');
   return r;
  }
 });
}
