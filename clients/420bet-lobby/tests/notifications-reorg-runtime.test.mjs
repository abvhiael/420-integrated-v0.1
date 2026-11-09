import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBetNotificationsMailRuntime} from '../server/notifications-mail-runtime.mjs';
const H=n=>'0x'+n.toString(16).padStart(64,'0'),A=n=>'0x'+n.toString(16).padStart(40,'0');
const roles=['casino-router','casino-settlement','poker-ledger','fantasy-contest','sports-tickets'];
const sources=roles.map((role,i)=>({id:'source-'+i,role,address:A(i+1),fromBlock:'1'}));
const old={chainId:'420',type:'WAGER_ACCEPTED',contract:A(1),role:'casino-router',
 gameVersionId:H(13),objectId:H(23),account:A(60),blockNumber:'10',
 blockHash:H(10),transactionHash:H(11),logIndex:'0'};
const replacement={...old,blockHash:H(20),transactionHash:H(21)};
test('runtime detects reorg, rebuilds signed canonical set and sends correction plus replacement once',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bet-reorg-runtime-')),sent=[];
 let cursor={events:[]},reorg=false,announced=false,runtime=null;
 const reader={config:{chainId:'420',contracts:sources},
  readCheckpoint:async()=>structuredClone(cursor),
  persistCheckpoint:async(_file,state)=>{cursor=structuredClone(state);},
  poll:async()=>{
   if(reorg&&!announced){announced=true;return {reorganized:true,scanned:1,complete:true,
    state:{events:[replacement],nextBlock:'21'}};}
   return {reorganized:false,scanned:1,complete:true,
    state:{events:[reorg?replacement:old],nextBlock:reorg?'21':'11'}};
  }
 };
 const path=join(dir,'indexer.json');
 await writeFile(path,JSON.stringify({chainId:'420',indexerUrl:'https://indexer.example/',contracts:sources}));
 const env={BET_INDEXER_EVENT_MANIFEST:path,BET_INDEXER_EVENT_CHECKPOINT:join(dir,'cp.json'),
  BET_DELIVERY_OUTBOX_PATH:join(dir,'deliveries.json'),BET_MAIL_URL:'https://mail.example/',
  BET_REVOCATION_POLL_MS:'60000'};
 try{
  runtime=await createBetNotificationsMailRuntime({
   env,verifyRegistry:async()=>({result:{qualified:true},config:{chainId:'420',sources,
    games:[{id:'casino-dice',vertical:'casino',gameVersionId:H(13)}]}}),
   readerFactory:()=>reader,
   resolveAudience:async()=>[{ownershipVerified:true,account:A(60),tenant:'420bet',
    userId:'subject-1',gameVersionId:H(13),
    subscriptions:[{id:'sub-1',channel:'notifications',recipient:'route-1',policyVersion:'p1'}]}],
   checkConsent:async d=>({tenant:d.tenant,userId:d.userId,subscriptionId:d.subscriptionId,
    recipient:d.recipient,channel:d.channel,policyVersion:d.policyVersion,
    active:true,muted:false,revoked:false,consent:true}),
   readRevocations:async()=>[],authorizeMailActor:async()=>({sender:'sender-id',authorization:'Bearer '+'a'.repeat(40)}),
   notifications:{
    deliverAuthenticated:async d=>{sent.push(d);return {deliveryId:'receipt-'+sent.length,
     idempotencyKey:d.idempotencyKey,status:'delivered'};},
    readReceipt:async d=>({deliveryId:d.deliveryId,idempotencyKey:d.idempotencyKey,status:'delivered'}),
    cancelDelivery:async()=>({cancelled:false})
   }
  });
  assert.equal((await runtime.publish()).queued,1);
  assert.equal((await runtime.drain()).delivered,1);
  reorg=true;
  const rebuilt=await runtime.publish();
  assert.equal(rebuilt.recovered,true);
  assert.equal(rebuilt.queued,1);
  assert.equal((await runtime.outbox.summary()).replayPending,false);
  assert.equal((await runtime.outbox.summary()).byStatus.pending,2);
  assert.equal((await runtime.drain()).delivered,2);
  assert.equal(sent.length,3);
  assert.equal(sent.filter(d=>d.event.kind==='reorg-retracted').length,1);
  assert.equal(sent.filter(d=>d.event.kind==='wager-accepted').length,2);
  assert.equal((await runtime.outbox.summary()).byStatus.delivered,3);
  assert.equal((await runtime.publish()).queued,0);
  assert.equal((await runtime.drain()).processed,0);
 }finally{if(runtime)await runtime.stop();await rm(dir,{recursive:true,force:true})}
});
