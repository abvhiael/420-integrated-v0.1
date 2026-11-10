import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,rename,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createHmac} from 'node:crypto';
import {acquireDeliveryWriterLease} from '../server/delivery-writer-lease.mjs';
import {openDeliveryAlertJournal,createSignedDeliveryAlertWebhook}
 from '../server/delivery-alerts.mjs';

test('independent OS process cannot acquire live writer lock; replaced lock fences original process',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bet7-lock-')),path=join(dir,'queue.lock');
 let original,replacement;
 try{
  original=await acquireDeliveryWriterLease(path);
  const moduleURL=new URL('../server/delivery-writer-lease.mjs',import.meta.url).href;
  const child=spawn(process.execPath,['--input-type=module','-e',
   'import {acquireDeliveryWriterLease} from '+JSON.stringify(moduleURL)+';'+
   'await acquireDeliveryWriterLease(process.argv[1]);',path],{
    stdio:['ignore','ignore','pipe']
   });
  const code=await new Promise((resolve,reject)=>{
   child.on('error',reject);child.on('exit',resolve);
  });
  assert.notEqual(code,0,'second OS process stole the durable delivery writer lease');
  await original.assertOwner();
  await rename(path,path+'.orphan');
  replacement=await acquireDeliveryWriterLease(path);
  await assert.rejects(original.assertOwner(),/lease lost/);
  await assert.rejects(original.release(),/lease lost/);
  await replacement.assertOwner();
  assert.match(await readFile(join(path,'owner.json'),'utf8'),/token/);
 }finally{
  if(replacement)await replacement.release().catch(()=>{});
  if(original&&!replacement)await original.release().catch(()=>{});
  await rm(dir,{recursive:true,force:true});
 }
});
test('durable alert journal retries webhook after restart without leaking recipient details',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bet7-alerts-')),path=join(dir,'alerts.json');
 let at=1762790400000,delivered=false,journal;
 const sent=[];
 const worker={health:()=>({stale:false,consecutiveFailures:4,revocationFailed:true})};
 let status={halted:true,replayPending:true,remoteCancellationPending:1,
  oldestCancellationAgeMs:120000,oldestPendingAgeMs:260000,
  byStatus:{dead_letter:2}};
 const outbox={summary:async()=>status};
 const send=async event=>{
  sent.push(event);
  if(!delivered)throw Error('injected webhook outage');
 };
 try{
  journal=await openDeliveryAlertJournal({path,worker,outbox,clock:()=>at,
   retryMs:100,send,cancellationAgeMs:100,pendingAgeMs:100});
  const first=await journal.poll();
  assert.equal(first.failed,7);
  assert.equal((await journal.snapshot()).pendingCodes.length,7);
  await journal.close();journal=null;
  delivered=true;at+=101;
  journal=await openDeliveryAlertJournal({path,worker,outbox,clock:()=>at,
   retryMs:100,send,cancellationAgeMs:100,pendingAgeMs:100});
  const retry=await journal.poll();
  assert.equal(retry.sent,7;
  assert.deepEqual((await journal.snapshot()).pendingCodes,[]);
  for(const event of sent){
   assert.match(event.id,/^[a-f0-9]{64}$/);
   assert(!JSON.stringify(event).includes('subject'));
   assert(!JSON.stringify(event).includes('recipient'));
  }
  // Resolved events have an independently retryable durable journal entry.
  status={halted:false,replayPending:false,remoteCancellationPending:0,
   oldestCancellationAgeMs:0,oldestPendingAgeMs:0,byStatus:{dead_letter:0}};
  worker.health=()=>({stale:false,consecutiveFailures:0,revocationFailed:false});
  const clear=await journal.poll();
  assert.equal(clear.sent,7;
  assert.equal(sent.filter(x=>x.status==='resolved').length,7);
 }finally{if(journal)await journal.close();await rm(dir,{recursive:true,force:true});}
});
test('alert callback uses an authenticated HMAC envelope and never redirects',async()=>{
 const secret='operator-incident-webhook-key-with-32-bytes';
 const payload={schema:'420bet-delivery-alert-v1',id:'a'.repeat(64),
  code:'REORG_HALT',status:'firing',at:1762790400000};
 let requests=0;
 const push=createSignedDeliveryAlertWebhook({url:'https://ops.example/alerts',
  secret,fetcher:async(url,opts)=>{
   requests++;
   assert.equal(url,'https://ops.example/alerts');
   assert.equal(opts.redirect,'error');
   assert.equal(opts.headers['X-420Bet-Alert-Signature'],
    createHmac('sha256',secret).update(JSON.stringify(payload)).digest('hex'));
   return {ok:true};
  }});
 await push(payload);
 assert.equal(requests,1);
 assert.throws(()=>createSignedDeliveryAlertWebhook({url:'http://ops.example/',secret}),/HTTPS/);
});
