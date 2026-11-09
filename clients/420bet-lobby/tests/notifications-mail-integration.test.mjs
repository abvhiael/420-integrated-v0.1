import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {makeBetDelivery,create420MailProvider,create420NotificationsProvider} from '../server/notifications-mail-adapters.mjs';
import {openBetDeliveryOutbox} from '../server/notifications-mail-outbox.mjs';
const A='0x'+'a'.repeat(40),H=n=>'0x'+n.toString(16).padStart(64,'0');
function request(channel='notifications'){
 return {tenant:'420bet',userId:'subject-v1',channel,subscriptionId:'sub-1',
  recipient:'recipient-1',source:'420Indexer-finalized',policyVersion:'policy-1',
  kind:'wager-settled',finality:'finalized',
  event:{chainId:'420',gameId:'dice',account:A,blockNumber:'42',
   blockHash:H(42),transactionHash:H(43),logIndex:'1'}};
}
function fixture({consent=true,verified=true,mode='delivered'}={}){
 let t=10000,granted=consent,valid=verified,deliveries=0;
 const provider={
  async deliver(d){deliveries++;return {provider:d.channel==='mail'?'420Mail':'420Notifications',
   externalId:'receipt-1',status:mode};},
  async status(d,r){return {...r,status:'delivered'};},
  async cancel(){return {cancelled:true}}
 };
 return {now:()=>t,advance(ms){t+=ms},revoke(){granted=false},get attempts(){return deliveries},
  options:{verifyEvent:async()=>valid,
   checkConsent:async d=>({tenant:d.tenant,userId:d.userId,subscriptionId:d.subscriptionId,
    recipient:d.recipient,channel:d.channel,active:granted,muted:false,revoked:!granted,
    consent:granted,policyVersion:'policy-1'}),providers:{mail:provider,notifications:provider},
   clock:()=>t,baseBackoffMs:1000,maxBackoffMs:5000,maxAttempts:3}};
}
async function withOutbox(fn,options={}){
 const dir=await mkdtemp(join(tmpdir(),'bet7-delivery-'));
 const path=join(dir,'store.json');
 try{await fn({path,dir,...fixture(options)});}finally{await rm(dir,{recursive:true,force:true});}
}
test('redacted envelope never stores amounts, balances, player addresses or arbitrary private metadata',()=>{
 const d=makeBetDelivery(request());
 assert(!JSON.stringify(d).includes(A));
 assert(!JSON.stringify(d).includes(H(43)));
 assert(!JSON.stringify(d).includes(H(42)));
 assert.equal(d.event.kind,'wager-settled');
 assert.throws(()=>makeBetDelivery({...request(),event:{...request().event,balance:'4200'}}),/unapproved event data/);
 assert.throws(()=>makeBetDelivery({...request(),source:'browser'}),/non-final/);
 assert.throws(()=>makeBetDelivery({...request(),recipient:'someone@example.com'}),/recipient/);
});
test('persistent outbox deduplicates across restart, never sends without consent and writes 0600',async()=>{
 await withOutbox(async({path,options,revoke})=>{
  const a=await openBetDeliveryOutbox({path,...options});
  const first=await a.enqueue(request());assert.equal(first.created,true);
  assert.equal((await a.enqueue(request())).created,false);
  const st=await stat(path);assert.equal(st.mode&0o077,0);
  await a.close();
  const b=await openBetDeliveryOutbox({path,...options});
  assert.equal((await b.summary()).total,1);
  assert.equal((await b.drain()).delivered,1);
  assert.equal((await b.get(first.key)).status,'delivered');
  await b.close();
  const raw=await readFile(path,'utf8');
  assert(!raw.includes(A));
  assert(!raw.includes('stake'));
 });
});
test('consent withdrawal cancels rather than dispatching',async()=>{
 await withOutbox(async({path,options,revoke})=>{
  const a=await openBetDeliveryOutbox({path,...options});
  const e=await a.enqueue(request());revoke();
  const out=await a.drain();assert.equal(out.cancelled,1);
  assert.equal((await a.get(e.key)).status,'cancelled');
  await assert.rejects(a.enqueue(request()),/consent denied/);
  await a.close();
 });
});
test('unverified provenance never enters durable queue',async()=>{
 await withOutbox(async({path,options})=>{
  const a=await openBetDeliveryOutbox({path,...options,verifyEvent:async()=>false});
  await assert.rejects(a.enqueue(request()),/provenance/);
  assert.equal((await a.summary()).total,0);
  await a.close();
 });
});
test('pending remote provider delivery is not falsely marked delivered; receipt is reconciled',async()=>{
 await withOutbox(async({path,options,advance})=>{
  options.providers.notifications.deliver=async()=>({provider:'420Notifications',externalId:'queued-1',status:'pending'});
  options.providers.notifications.status=async()=>({provider:'420Notifications',externalId:'queued-1',status:'delivered'});
  const a=await openBetDeliveryOutbox({path,...options});
  const e=await a.enqueue(request());
  assert.equal((await a.drain()).pending,1);
  assert.equal((await a.get(e.key)).status,'pending_receipt');
  assert.equal((await a.drain()).processed,0);
  advance(1000);
  assert.equal((await a.drain()).delivered,1);
  assert.equal((await a.get(e.key)).status,'delivered');
  await a.close();
 });
});
test('outage backoff is bounded, attempt counts persist, and exhausted jobs go to dead-letter',async()=>{
 await withOutbox(async({path,options,advance})=>{
  options.providers.notifications.deliver=async()=>{throw Error('sensitive provider error');};
  const a=await openBetDeliveryOutbox({path,...options});
  const e=await a.enqueue(request());
  assert.equal((await a.drain()).failed,1);
  assert.equal((await a.get(e.key)).attempts,1);
  assert.equal((await a.drain()).processed,0);
  advance(1000);assert.equal((await a.drain()).failed,1);
  advance(2000);assert.equal((await a.drain()).failed,1);
  assert.equal((await a.get(e.key)).status,'dead_letter');
  const raw=await readFile(path,'utf8');assert(!raw.includes('sensitive provider error'));
  await a.close();
 });
});
test('single writer lock refuses two writers and released lock permits restart',async()=>{
 await withOutbox(async({path,options})=>{
  const a=await openBetDeliveryOutbox({path,...options});
  await assert.rejects(openBetDeliveryOutbox({path,...options}),/EEXIST/);
  await a.close();
  const b=await openBetDeliveryOutbox({path,...options});
  await b.close();
 });
});
test('Mail provider uses genuine authenticated 420Mail /v1/outbox and /process API, verifies scope',async()=>{
 const requests=[];
 const d=makeBetDelivery(request('mail'));
 const p=create420MailProvider({origin:'https://mail.example/',authorizeActor:async()=>({
  sender:'bot-identity',authorization:'Bearer '+'t'.repeat(64)
 }),fetcher:async(url,opts)=>{
  requests.push({url,opts});const input=opts.body?JSON.parse(opts.body):null;
  const result=url.endsWith('/v1/outbox')?{id:'delivery-1',idempotency_key:input.idempotency_key,
    owner:input.sender,recipient:input.recipient,status:'QUEUED'}:
   {id:'delivery-1',idempotency_key:d.deliveryKey,owner:'bot-identity',status:'DELIVERED'};
  return {ok:true,text:async()=>JSON.stringify(result)};
 }});
 const receipt=await p.deliver(d);
 assert.equal(receipt.status,'delivered');
 assert.equal(requests[0].url,'https://mail.example/v1/outbox');
 const body=JSON.parse(requests[0].opts.body);
 assert.equal(body.source,'420/service/mail/v1');
 assert.equal(body.idempotency_key,d.deliveryKey);
 assert.equal(body.body,'A game settlement was finalized.');
 assert.equal(requests[1].url,'https://mail.example/v1/outbox/delivery-1/process');
 assert(!JSON.stringify(requests).includes(A));
});
test('Notifications adapter refuses fabricated receipt and requires explicit qualified callbacks',async()=>{
 assert.throws(()=>create420NotificationsProvider({}),/qualified Notifications adapter/);
 const d=makeBetDelivery(request());
 const a=create420NotificationsProvider({
  deliverAuthenticated:async x=>({idempotencyKey:x.idempotencyKey,deliveryId:'notification-1',status:'pending'}),
  readReceipt:async x=>({idempotencyKey:x.idempotencyKey,deliveryId:x.deliveryId,status:'delivered'}),
  cancelDelivery:async()=>({cancelled:true})
 });
 const r=await a.deliver(d);assert.equal(r.status,'pending');
 assert.equal((await a.status(d,r)).status,'delivered');
 assert.equal((await a.cancel(d,r)).cancelled,true);
 const forged=create420NotificationsProvider({
  deliverAuthenticated:async()=>({idempotencyKey:'forged',deliveryId:'fake',status:'delivered'}),
  readReceipt:async()=>({}),cancelDelivery:async()=>({cancelled:false})
 });
 await assert.rejects(forged.deliver(d),/receipt mismatch/);
});

test('explicit unsubscribe revokes only one tenant/user/subscription and reports remote cancellation truthfully',async()=>{
 await withOutbox(async({path,options})=>{
  let cancelled=0;
  options.providers.notifications.deliver=async()=>({provider:'420Notifications',externalId:'r-1',status:'pending'});
  options.providers.notifications.cancel=async()=>{cancelled++;return {cancelled:false};};
  const a=await openBetDeliveryOutbox({path,...options});
  const x=await a.enqueue(request());
  await a.enqueue({...request(),subscriptionId:'other'});
  assert.equal((await a.drain({limit:1})).pending,1);
  const result=await a.revokeSubscription({tenant:'420bet',userId:'subject-v1',subscriptionId:'sub-1'});
  assert.equal(result.locallyCancelled,1);
  assert.equal(result.remoteCancellationUnconfirmed,1);
  assert.equal(cancelled,1);
  assert.equal((await a.get(x.key)).status,'cancelled');
  assert.equal((await a.summary()).byStatus.cancelled,1);
  await a.close();
 });
});
test('same-origin delivery idempotency is per tenant and subscription, not globally merged across players',()=>{
 const base=request();
 const a=makeBetDelivery(base);
 const b=makeBetDelivery({...base,userId:'subject-v2'});
 const c=makeBetDelivery({...base,tenant:'another-tenant'});
 assert.notEqual(a.deliveryKey,b.deliveryKey);assert.notEqual(a.deliveryKey,c.deliveryKey);
 assert.equal(a.eventId,b.eventId);
});

test('persisted reorg halt prevents dispatch and survives restart until canonical replay approval',async()=>{
 await withOutbox(async({path,options})=>{
  const a=await openBetDeliveryOutbox({path,...options});
  await a.enqueue(request());
  await a.haltForReorg();
  await assert.rejects(a.drain(),/reorg halt/);
  await assert.rejects(a.enqueue(request()),/reorg halt/);
  await a.close();
  const b=await openBetDeliveryOutbox({path,...options});
  assert.equal((await b.summary()).halted,true);
  await assert.rejects(b.resumeAfterCanonicalReplay({canonicalEventIds:[],verifyCanonicalRebuild:async()=>false}),/not independently verified/);
  assert.equal((await b.summary()).halted,true);
  const recovery=await b.resumeAfterCanonicalReplay({
   canonicalEventIds:[makeBetDelivery(request()).eventId],verifyCanonicalRebuild:async()=>true});
  assert.equal(recovery.halted,false);
  await b.finishCanonicalReplay();
  assert.equal((await b.drain()).delivered,1);
  await b.close();
 });
});
test('retracted delivered messages retain delivery receipts and report remote undo as unconfirmed',async()=>{
 await withOutbox(async({path,options})=>{
  options.providers.notifications.cancel=async()=>({cancelled:false});
  const a=await openBetDeliveryOutbox({path,...options});
  const first=await a.enqueue(request());
  await a.drain();
  const outcome=await a.retractEvent(makeBetDelivery(request()).eventId);
  assert.equal(outcome.affected,1);
  assert.equal(outcome.remoteCancellationUnconfirmed,1);
  const record=await a.get(first.key);
  assert.equal(record.status,'delivered');
  assert.equal(record.retracted,true);
  await a.close();
 });
});
