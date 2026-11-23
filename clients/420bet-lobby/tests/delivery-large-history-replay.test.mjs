import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBetNotificationsMailRuntime} from '../server/notifications-mail-runtime.mjs';
const A=n=>'0x'+n.toString(16).padStart(40,'0');
const roles=['casino-router','casino-settlement','poker-ledger','fantasy-contest','sports-tickets'];
async function harness({windows=600,failAt=null,flipSecondPass=false}={}){
 const dir=await mkdtemp(join(tmpdir(),'bet7-long-replay-'));
 const contracts=roles.map((role,i)=>({id:'source-'+i,role,address:A(i+1),fromBlock:'1'}));
 const manifest={chainId:'420',indexerUrl:'https://indexer.example/',contracts};
 const manifestPath=join(dir,'manifest.json');await writeFile(manifestPath,JSON.stringify(manifest));
 const env={BET_INDEXER_EVENT_MANIFEST:manifestPath,
  BET_INDEXER_EVENT_CHECKPOINT:join(dir,'indexer.json'),
  BET_DELIVERY_OUTBOX_PATH:join(dir,'outbox.json'),
  BET_MAIL_URL:'https://mail.example/',BET_REVOCATION_POLL_MS:'60000'};
 const approval={result:{qualified:true},config:{chainId:'420',sources:contracts,games:[]}};
 let firstPass=0,secondPass=0,completedPass=0,polls=0;
 const reader={config:{chainId:'420',contracts},
  initialState:()=>({firstBlock:'1',nextBlock:'1',tipHash:null,events:[]}),
  readCheckpoint:async()=>({events:[]}),
  persistCheckpoint:async(path,state)=>writeFile(path,JSON.stringify(state)),
  poll:async(state)=>{
   const step=Number((BigInt(state.nextBlock)-1n)/64n)+1;
   if(step===1){if(completedPass===0)firstPass++;else secondPass++;}
   polls++;
   if(failAt!==null&&completedPass===0&&step===failAt)throw Error('injected remote canonical replay failure');
   const complete=step===windows;
   const tipHash=flipSecondPass&&completedPass>0&&step===310?
    '0x'+'f'.repeat(64):'0x'+BigInt(step).toString(16).padStart(64,'0');
   if(complete)completedPass++;
   return {reorganized:false,scanned:64,complete,
    state:{...state,nextBlock:String(BigInt(state.nextBlock)+64n),
     tipHash,events:[]}};
  }};
 let runtime;
 try{
  runtime=await createBetNotificationsMailRuntime({
   env,readerFactory:()=>reader,verifyRegistry:async()=>approval,
   readRevocations:async()=>[],resolveAudience:async()=>[],
   checkConsent:async()=>({active:false}),
   authorizeMailActor:async()=>({sender:'sender-id',authorization:'Bearer '+'a'.repeat(40)}),
   notifications:{deliverAuthenticated:async()=>{throw Error('unreachable')},
    readReceipt:async()=>{throw Error('unreachable')},
    cancelDelivery:async()=>({cancelled:true})}
  });
  await runtime.outbox.haltForReorg();
  return {runtime,reader,dir,stats:()=>({firstPass,secondPass,completedPass,polls}),
   close:async()=>{await runtime.stop();await rm(dir,{recursive:true,force:true});}};
 }catch(e){if(runtime)await runtime.stop();await rm(dir,{recursive:true,force:true});throw e;}
}
test('full canonical repair crosses historical 32,768-block cap, keeps bounded event windows and finishes twice',async()=>{
 const h=await harness({windows:530});
 try{
  const result=await h.runtime.recoverReorganization();
  assert.equal(result.canonicalEvents,0);
  assert.equal(result.windows,530);
  assert.equal(h.stats().polls,1060);
  const summary=await h.runtime.outbox.summary();
  assert.equal(summary.halted,false);assert.equal(summary.replayPending,false);
 }finally{await h.close();}
});
test('injected remote failure after the old 512-batch limit keeps the outbox halted',async()=>{
 const h=await harness({windows:530,failAt:521});
 try{
  await assert.rejects(h.runtime.recoverReorganization(),/injected remote canonical replay failure/);
  const status=await h.runtime.outbox.summary();
  assert.equal(status.halted,true);
  await assert.rejects(h.runtime.drain(),/halt/);
 }finally{await h.close();}
});
test('change to empty-log block hashes on second pass denies recovery completion',async()=>{
 const h=await harness({windows:12,flipSecondPass:false});
 try{
  // Simulate a second pass with changed verified block hashes.
  const original=h.reader.poll;let pass=0;
  h.reader.poll=async (...args)=>{
   const result=await original(...args);
   if(result.complete)pass++;
   if(pass>=1&&result.state.nextBlock==='129')
    result.state.tipHash='0x'+'e'.repeat(64);
   return result;
  };
  await assert.rejects(h.runtime.recoverReorganization(),/canonical history changed between recovery passes/);
  const status=await h.runtime.outbox.summary();
  assert.equal(status.replayPending,true);
  await assert.rejects(h.runtime.drain(),/replay pending/);
 }finally{await h.close();}
});
