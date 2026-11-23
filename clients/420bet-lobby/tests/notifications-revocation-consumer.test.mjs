import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openBetDeliveryOutbox} from '../server/notifications-mail-outbox.mjs';
import {create420NotificationsRevocationReader,createBetRevocationConsumer} from '../server/notifications-revocation-consumer.mjs';
const H=n=>'0x'+n.toString(16).padStart(64,'0'),A=n=>'0x'+n.toString(16).padStart(40,'0');
const scope={tenant:'420bet',userId:'subject-1',subscriptionId:'sub-1'};
const event={chainId:'420',gameId:'casino-dice',account:A(8),blockNumber:'21',
 blockHash:H(21),transactionHash:H(22),logIndex:'0'};
function delivery(subscriptionId='sub-1'){
 return {tenant:'420bet',userId:'subject-1',subscriptionId,channel:'notifications',recipient:'route-1',
  policyVersion:'policy-1',source:'420Indexer-finalized',kind:'wager-settled',finality:'finalized',event};
}
const approvals=req=>({tenant:req.tenant,userId:req.userId,subscriptionId:req.subscriptionId,
 channel:req.channel,recipient:req.recipient,policyVersion:req.policyVersion,
 active:true,muted:false,revoked:false,consent:true});
function providers(cancelCalls){
 const adapter={deliver:async()=>({provider:'420Notifications',externalId:'receipt-1',status:'pending'}),
  status:async()=>({provider:'420Notifications',externalId:'receipt-1',status:'pending'}),
  cancel:async()=>{cancelCalls.push(true);return {cancelled:true}}};
 return {notifications:adapter,mail:{...adapter}};
}
async function setup(dir,cancels){
 return openBetDeliveryOutbox({path:join(dir,'outbox.json'),verifyEvent:async()=>true,
  checkConsent:async request=>approvals(request),providers:providers(cancels)});
}
const rev=(sequence=1)=>({sequence,tenant:'420bet',userId:'subject-1',subscriptionId:'sub-1',revision:3,reason:'revoked'});
test('withdrawal cancels pending deliveries, persists checkpoint and prevents resurrection on restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bet-revoke-')),cancelCalls=[];
 let outbox;
 try{
  outbox=await setup(dir,cancelCalls);
  const first=await outbox.enqueue(delivery());
  const other=await outbox.enqueue(delivery('unrelated-sub'));
  const consumer=createBetRevocationConsumer({outbox,readRevocations:async(after)=>after===0?[rev()]:[]});
  assert.equal((await consumer.sync()).processed,1);
  assert.equal((await outbox.get(first.key)).status,'cancelled');
  assert.equal((await outbox.get(other.key)).status,'pending');
  assert.equal(await outbox.getRevocationCursor(),1);
  await assert.rejects(outbox.enqueue(delivery()),/subscription withdrawn/);
  await outbox.close();
  outbox=await setup(dir,cancelCalls);
  assert.equal(await outbox.getRevocationCursor(),1);
  assert.equal((await outbox.get(first.key)).status,'cancelled');
  await assert.rejects(outbox.enqueue(delivery()),/subscription withdrawn/);
  assert.equal((await createBetRevocationConsumer({outbox,readRevocations:async()=>[]}).sync()).processed,0);
 }finally{if(outbox)await outbox.close();await rm(dir,{recursive:true,force:true})}
});
test('remote pending receipt cancellation is attempted but never claimed without provider confirmation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bet-revoke-')),cancelCalls=[];
 let outbox;
 try{
  outbox=await setup(dir,cancelCalls);
  const first=await outbox.enqueue(delivery());
  assert.equal((await outbox.drain()).pending,1);
  assert.equal((await outbox.get(first.key)).status,'pending_receipt');
  const res=await outbox.revokeSubscription({...scope,sequence:1});
  assert.equal(res.remoteCancellationConfirmed,1);
  assert.equal(cancelCalls.length,1);
  assert.equal((await outbox.get(first.key)).status,'cancelled');
  assert.equal((await outbox.drain()).processed,0);
 }finally{if(outbox)await outbox.close();await rm(dir,{recursive:true,force:true})}
});
test('sequence gaps fail closed and do not advance durable cursor',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bet-revoke-'));let outbox;
 try{
  outbox=await setup(dir,[]);
  const consumer=createBetRevocationConsumer({outbox,readRevocations:async()=>[rev(2)]});
  await assert.rejects(consumer.sync(),/sequence gap/);
  assert.equal(await outbox.getRevocationCursor(),0);
 }finally{if(outbox)await outbox.close();await rm(dir,{recursive:true,force:true})}
});
test('authenticated reader denies forgery, wrong tenant, cursor gap and provider failure',async()=>{
 const seen=[];
 const reader=create420NotificationsRevocationReader({origin:'https://notifications.example/',
  bearerToken:'x'.repeat(40),fetcher:async(url,opts)=>{
   seen.push({url,opts});return {ok:true,text:async()=>JSON.stringify({events:[rev()]})};
  }});
 const rows=await reader(0);
 assert.equal(rows.length,1);
 assert.equal(seen[0].opts.headers.Authorization,'Bearer '+'x'.repeat(40));
 assert.deepEqual(JSON.parse(seen[0].opts.body),{after:0,limit:50});
 const forgery=create420NotificationsRevocationReader({origin:'https://notifications.example/',bearerToken:'x'.repeat(40),
  fetcher:async()=>({ok:true,text:async()=>JSON.stringify({events:[{...rev(),tenant:'other'}]})})});
 await assert.rejects(forgery(0),/untrusted/);
 const outage=create420NotificationsRevocationReader({origin:'https://notifications.example/',bearerToken:'x'.repeat(40),
  fetcher:async()=>({ok:false})});
 await assert.rejects(outage(0),/unavailable/);
});

test('failed remote cancellation survives restart and is retried without re-sending',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bet-revoke-'));let outbox;
 let attempts=0;
 const remote={deliver:async()=>({provider:'420Notifications',externalId:'remote-1',status:'pending'}),
  status:async()=>({provider:'420Notifications',externalId:'remote-1',status:'pending'}),
  cancel:async()=>({cancelled:++attempts>1})};
 const openStore=()=>openBetDeliveryOutbox({path:join(dir,'outbox.json'),verifyEvent:async()=>true,
  checkConsent:async request=>approvals(request),providers:{notifications:remote,mail:remote}});
 try{
  outbox=await openStore();
  const deliveryRecord=await outbox.enqueue(delivery());
  assert.equal((await outbox.drain()).pending,1);
  const withdrawn=await outbox.revokeSubscription({...scope,sequence:1});
  assert.equal(withdrawn.remoteCancellationUnconfirmed,1);
  assert.equal((await outbox.get(deliveryRecord.key)).status,'cancelled');
  await outbox.close();
  outbox=await openStore();
  const retry=await outbox.retryRemoteCancellations();
  assert.equal(retry.confirmed,1);
  assert.equal((await outbox.retryRemoteCancellations()).attempted,0);
  assert.equal((await outbox.drain()).processed,0);
 }finally{if(outbox)await outbox.close();await rm(dir,{recursive:true,force:true})}
});
