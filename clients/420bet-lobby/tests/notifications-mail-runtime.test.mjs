import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBetNotificationsMailRuntime} from '../server/notifications-mail-runtime.mjs';
const H=n=>'0x'+n.toString(16).padStart(64,'0'),A=n=>'0x'+n.toString(16).padStart(40,'0');
const roles=['casino-router','casino-settlement','poker-ledger','fantasy-contest','sports-tickets'];
function sourceFixture(){
 const bindings=roles.map((role,i)=>({id:'source-'+i,role,address:A(i+1),fromBlock:'1'}));
 const event={chainId:'420',gameId:'source-0',type:'WAGER_ACCEPTED',
  contract:A(1),role:'casino-router',gameVersionId:H(12),objectId:H(21),
  account:A(6),blockNumber:'42',blockHash:H(42),transactionHash:H(43),logIndex:'0'};
 return {manifest:{chainId:'420',indexerUrl:'https://indexer.example/',contracts:bindings},
  registry:{result:{qualified:true},config:{chainId:'420',sources:bindings,
   games:[{id:'casino-dice',vertical:'casino',gameVersionId:H(12)}]}},
  reader:{config:{chainId:'420',contracts:bindings},
   readCheckpoint:async()=>({events:[]}),
   poll:async()=>({reorganized:false,state:{events:[event]}})}};
}
test('full Registry/Indexer/ownership/consent and authenticated Mail outbox composition runs without wager authority',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bet7-runtime-'));
 const fx=sourceFixture(),sent=[];
 const manifestPath=join(dir,'indexer.json');
 await writeFile(manifestPath,JSON.stringify(fx.manifest));
 const env={BET_INDEXER_EVENT_MANIFEST:manifestPath,
  BET_INDEXER_EVENT_CHECKPOINT:join(dir,'indexer-checkpoint.json'),
  BET_DELIVERY_OUTBOX_PATH:join(dir,'delivery.json'),
  BET_MAIL_URL:'https://mail.example/'};
 try{
  const runtime=await createBetNotificationsMailRuntime({
   env,verifyRegistry:async()=>fx.registry,readerFactory:()=>fx.reader,
   resolveAudience:async()=>[{ownershipVerified:true,account:A(6),
    gameVersionId:H(12),tenant:'420bet',userId:'subject-1',
    subscriptions:[{channel:'mail',id:'sub-1',
     recipient:'recipient-1',policyVersion:'policy-3'}]}],
   readRevocations:async()=>[],
   checkConsent:async req=>({tenant:req.tenant,userId:req.userId,
    subscriptionId:req.subscriptionId,recipient:req.recipient,channel:req.channel,
    active:true,muted:false,revoked:false,consent:true,policyVersion:req.policyVersion}),
   authorizeMailActor:async()=>({sender:'sender-id',authorization:'Bearer '+'a'.repeat(48)}),
   notifications:{deliverAuthenticated:async()=>{throw Error('unreachable')},
    readReceipt:async()=>{throw Error('unreachable')},cancelDelivery:async()=>({cancelled:true})},
   fetcher:async(url,opts)=>{
    sent.push({url,opts});
    const body=opts.body?JSON.parse(opts.body):null;
    return {ok:true,text:async()=>JSON.stringify(
     url.endsWith('/v1/outbox')?{id:'mail-delivery',owner:'sender-id',
      recipient:'recipient-1',status:'QUEUED',idempotency_key:body.idempotency_key}:
      {id:'mail-delivery',owner:'sender-id',status:'DELIVERED',
       idempotency_key:body?.idempotency_key??JSON.parse(sent[0].opts.body).idempotency_key}
    )};
   }
  });
  assert.equal((await runtime.publish()).queued,1);
  assert.equal((await runtime.drain()).delivered,1);
  assert.equal((await runtime.outbox.summary()).byStatus.delivered,1);
  assert.equal(sent[0].url,'https://mail.example/v1/outbox');
  await runtime.stop();
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('runtime refuses to start without independently supplied recipient/consent and both delivery providers',async()=>{
 const env={BET_INDEXER_EVENT_MANIFEST:'/missing',
  BET_INDEXER_EVENT_CHECKPOINT:'/other',BET_DELIVERY_OUTBOX_PATH:'/outbox',
  BET_MAIL_URL:'https://mail.example/'};
 await assert.rejects(createBetNotificationsMailRuntime({env}),/qualified Identity, Notifications, consent and Mail providers required/);
});

test('running backend automatically polls revoked consent and cancels queued Mail before dispatch',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bet7-revoke-timer-'));
 const fx=sourceFixture();
 const manifestPath=join(dir,'manifest.json');
 await writeFile(manifestPath,JSON.stringify(fx.manifest));
 const env={BET_INDEXER_EVENT_MANIFEST:manifestPath,
  BET_INDEXER_EVENT_CHECKPOINT:join(dir,'checkpoint.json'),
  BET_DELIVERY_OUTBOX_PATH:join(dir,'outbox.json'),
  BET_MAIL_URL:'https://mail.example/',
  BET_REVOCATION_POLL_MS:'250'};
 let available=false,runtime;
 const record={sequence:1,tenant:'420bet',userId:'subject-1',subscriptionId:'sub-1',
  revision:2,reason:'revoked'};
 try{
  runtime=await createBetNotificationsMailRuntime({
   env,verifyRegistry:async()=>fx.registry,readerFactory:()=>fx.reader,
   resolveAudience:async()=>[{ownershipVerified:true,account:A(6),
    gameVersionId:H(12),tenant:'420bet',userId:'subject-1',
    subscriptions:[{channel:'mail',id:'sub-1',recipient:'recipient-1',policyVersion:'policy-1'}]}],
   checkConsent:async req=>({tenant:req.tenant,userId:req.userId,subscriptionId:req.subscriptionId,
    recipient:req.recipient,channel:req.channel,policyVersion:req.policyVersion,
    active:true,muted:false,revoked:false,consent:true}),
   readRevocations:async(cursor)=>available&&cursor===0?[record]:[],
   authorizeMailActor:async()=>({sender:'sender-id',authorization:'Bearer '+'a'.repeat(40)}),
   notifications:{deliverAuthenticated:async()=>{throw Error('unreachable')},
    readReceipt:async()=>{throw Error('unreachable')},cancelDelivery:async()=>({cancelled:true})}
  });
  assert.equal((await runtime.publish()).queued,1);
  assert.equal((await runtime.outbox.summary()).byStatus.pending,1);
  available=true;
  let cancelled=false;
  for(let i=0;i<30;i++){
   await new Promise(resolve=>setTimeout(resolve,25));
   cancelled=(await runtime.outbox.summary()).byStatus.cancelled===1;
   if(cancelled)break;
  }
  assert.equal(cancelled,true,'periodic consumer never cancelled withdrawn subscription');
  assert.equal(await runtime.outbox.getRevocationCursor(),1);
  assert.equal((await runtime.drain()).processed,0);
 }finally{
  if(runtime)await runtime.stop();
  await rm(dir,{recursive:true,force:true});
 }
});
