import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openBetDeliveryOutbox} from '../server/notifications-mail-outbox.mjs';
import {makeBetDelivery} from '../server/notifications-mail-adapters.mjs';
const A='0x'+'a'.repeat(40),H=n=>'0x'+n.toString(16).padStart(64,'0');
function request(transaction=44,channel='mail'){
 return {tenant:'420bet',userId:'subject-1',channel,subscriptionId:'sub-1',recipient:'route-1',
  policyVersion:'p1',source:'420Indexer-finalized',kind:'wager-settled',
  finality:'finalized',event:{chainId:'420',gameId:'casino-dice',account:A,
   blockNumber:'99',blockHash:H(99),transactionHash:H(transaction),logIndex:'0'}};
}
function providers(log,{pending=false,lateDelivered=false}={}){
 function provider(name){
  return {
   async deliver(d){
    log.push({type:'deliver',channel:d.channel,key:d.deliveryKey,
     kind:d.kind,body:d.body,correctionOf:d.correctionOf??null});
    return {provider:name,externalId:'receipt-'+d.deliveryKey.slice(0,12),
     status:pending?'pending':'delivered'};
   },
   async status(_d,r){return {...r,status:lateDelivered?'delivered':'pending'};},
   async cancel(){log.push({type:'cancel'});return {cancelled:false};}
  };
 }
 return {mail:provider('420Mail'),notifications:provider('420Notifications')};
}
async function setup(t,options={}){
 const dir=await mkdtemp(join(tmpdir(),'reorg-recovery-'));const path=join(dir,'outbox.json');
 const log=[];let consent=true;
 const args={path,verifyEvent:async()=>true,
  checkConsent:async d=>({tenant:d.tenant,userId:d.userId,
   subscriptionId:d.subscriptionId,recipient:d.recipient,channel:d.channel,
   policyVersion:d.policyVersion,active:consent,consent,muted:false,revoked:!consent}),
  providers:providers(log,options)};
 const cleanup=async outbox=>{if(outbox)await outbox.close();await rm(dir,{recursive:true,force:true});};
 return {args,log,setConsent:v=>{consent=v;},cleanup};
}
test('reorg retains delivered receipt, cancels orphaned queued jobs and delivers one redacted correction',async t=>{
 const f=await setup(t),a=await openBetDeliveryOutbox(f.args);
 try{
  const orphan=await a.enqueue(request(40));
  const valid=await a.enqueue(request(41));
  await a.drain({limit:1});
  assert.equal((await a.get(orphan.key)).status,'delivered');
  await a.haltForReorg();
  const r=await a.reconcileCanonicalReplay({canonicalEventIds:[makeBetDelivery(request(41)).eventId],
   verifyCanonicalRebuild:async()=>true});
  assert.equal(r.orphaned,1);
  assert.equal(r.corrections,1);
  assert.equal((await a.get(orphan.key)).retracted,true);
  assert.equal((await a.get(orphan.key)).receipt.status,'delivered');
  assert.equal((await a.get(valid.key)).status,'pending');
  await assert.rejects(a.drain(),/replay pending/);
  await a.finishCanonicalReplay();
  const delivered=await a.drain();
  assert.equal(delivered.delivered,2);
  const corrections=f.log.filter(x=>x.correctionOf);
  assert.equal(corrections.length,1);
  assert.equal(corrections[0].kind,'reorg-retracted');
  assert(!corrections[0].body.includes(A));
  assert(!corrections[0].body.includes(H(40)));
  assert.equal((await a.summary()).correctionPending,0);
 }finally{await f.cleanup(a)}
});
test('recovery requires explicit verified canonical set and refuses boolean-only bypass',async t=>{
 const f=await setup(t),a=await openBetDeliveryOutbox(f.args);
 try{
  await a.enqueue(request());
  await a.haltForReorg();
  await assert.rejects(a.resumeAfterCanonicalReplay(async()=>true),/invalid complete canonical event set/);
  await assert.rejects(a.reconcileCanonicalReplay({canonicalEventIds:[],verifyCanonicalRebuild:async()=>false}),/independently verified/);
  assert.equal((await a.summary()).halted,true);
  await a.reconcileCanonicalReplay({canonicalEventIds:[],verifyCanonicalRebuild:async()=>true});
  assert.equal((await a.summary()).replayPending,true);
  await a.finishCanonicalReplay();
  assert.equal((await a.summary()).halted,false);
 }finally{await f.cleanup(a)}
});
test('restart with replayPending never dispatches correction twice',async t=>{
 const f=await setup(t);let a=await openBetDeliveryOutbox(f.args);
 try{
  await a.enqueue(request(51));await a.drain();await a.haltForReorg();
  await a.reconcileCanonicalReplay({canonicalEventIds:[],verifyCanonicalRebuild:async()=>true});
  assert.equal((await a.summary()).correctionPending,1);
  await a.close();a=await openBetDeliveryOutbox(f.args);
  assert.equal((await a.summary()).replayPending,true);
  await assert.rejects(a.drain(),/replay pending/);
  const r=await a.reconcileCanonicalReplay({canonicalEventIds:[],verifyCanonicalRebuild:async()=>true});
  assert.equal(r.corrections,0);
  await a.finishCanonicalReplay();
  await a.drain();
  assert.equal(f.log.filter(x=>x.correctionOf).length,1);
 }finally{await f.cleanup(a)}
});
test('withdrawal never sends a new correction even if older delivered notice becomes orphaned',async t=>{
 const f=await setup(t);const a=await openBetDeliveryOutbox(f.args);
 try{
  await a.enqueue(request());await a.drain();await a.haltForReorg();
  await a.reconcileCanonicalReplay({canonicalEventIds:[],verifyCanonicalRebuild:async()=>true});
  await a.finishCanonicalReplay();
  f.setConsent(false);
  const r=await a.drain();
  assert.equal(r.cancelled,1);
  assert.equal(f.log.filter(x=>x.correctionOf).length,0);
 }finally{await f.cleanup(a)}
});
test('late delivered remote receipt after reorg cancellation queues exactly one correction',async t=>{
 const f=await setup(t,{pending:true,lateDelivered:true});
 let a=await openBetDeliveryOutbox(f.args);
 try{
  const orphan=await a.enqueue(request(62,'notifications'));
  await a.drain();assert.equal((await a.get(orphan.key)).status,'pending_receipt');
  await a.haltForReorg();
  await a.reconcileCanonicalReplay({canonicalEventIds:[],verifyCanonicalRebuild:async()=>true});
  await a.finishCanonicalReplay();
  const reconciliation=await a.retryRemoteCancellations();
  assert.equal(reconciliation.deliveredLate,1);
  assert.equal((await a.get(orphan.key)).retracted,true);
  assert.equal((await a.summary()).correctionPending,1);
  await a.close();a=await openBetDeliveryOutbox(f.args);
  assert.equal((await a.retryRemoteCancellations()).attempted,0);
  assert.equal((await a.summary()).correctionPending,1);
 }finally{await f.cleanup(a)}
});
