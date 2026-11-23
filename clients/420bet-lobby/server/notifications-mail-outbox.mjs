// BET-AUDIT-7 — durable, single-writer, consent-scoped outbox.
// A canonical finalized event never becomes a Mail or Notifications authority.
import {mkdir,open,readFile,rename,rm,stat,chmod} from 'node:fs/promises';
import {dirname,basename,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {makeBetDelivery,makeReorgCorrection} from './notifications-mail-adapters.mjs';
import {acquireDeliveryWriterLease} from './delivery-writer-lease.mjs';
const assert=(v,m)=>{if(!v)throw Error('420Bet outbox: '+m);};
const STATES=new Set(['pending','dispatching','retry','pending_receipt','delivered','dead_letter','cancelled']);
const CHANNELS=['mail','notifications'];
const clone=v=>structuredClone(v);
const now=()=>Date.now();
const counts=v=>Object.fromEntries([...STATES].map(x=>[x,Object.values(v.items).filter(y=>y.status===x).length]));
async function atomicWrite(path,data){
 const dir=dirname(path),tmp=join(dir,'.'+basename(path)+'.'+randomBytes(8).toString('hex')+'.tmp');
 let file;
 try{
  file=await open(tmp,'wx',0o600);
  await file.writeFile(JSON.stringify(data),'utf8');await file.sync();await file.close();file=null;
  await rename(tmp,path);await chmod(path,0o600);
  const directory=await open(dir,'r');try{await directory.sync();}finally{await directory.close();}
 }finally{if(file)await file.close();await rm(tmp,{force:true});}
}
export async function openBetDeliveryOutbox({
 path,verifyEvent,checkConsent,providers,clock=now,
 maxAttempts=4,baseBackoffMs=1000,maxBackoffMs=60000
}={}){
 assert(typeof path==='string'&&path.startsWith('/')&&!path.includes('\0'),'absolute outbox location required');
 assert(typeof verifyEvent==='function'&&typeof checkConsent==='function','qualified event/consent authorities required');
 assert(providers&&CHANNELS.every(k=>providers[k]&&
  ['deliver','status','cancel'].every(op=>typeof providers[k][op]==='function')),
  'qualified Notifications and Mail delivery adapters required');
 assert(Number.isSafeInteger(maxAttempts)&&maxAttempts>=1&&maxAttempts<=10,'invalid retry count');
 assert(Number.isSafeInteger(baseBackoffMs)&&baseBackoffMs>0&&
  Number.isSafeInteger(maxBackoffMs)&&maxBackoffMs>=baseBackoffMs,'invalid retry backoff');
 const parent=dirname(path);
 await mkdir(parent,{recursive:true,mode:0o700});
 const parentStat=await stat(parent);
 assert((parentStat.mode&0o022)===0,'outbox parent is writable by group or others');
 const lock=path+'.lock';
 const lease=await acquireDeliveryWriterLease(lock); // Never takeover.
 let closed=false,data;
 let operation=Promise.resolve();
 try{
  try{
   const file=await stat(path);
   assert((file.mode&0o077)===0&&file.isFile(),'outbox permissions unsafe');
   const raw=await readFile(path,'utf8');
   assert(raw.length<5_000_000,'outbox exceeds configured capacity');
   data=JSON.parse(raw);
   assert(data?.schema===1&&data.items&&typeof data.items==='object'&&!Array.isArray(data.items),
    'invalid durable outbox');
  }catch(error){
   if(error?.code!=='ENOENT')throw error;
   data={schema:1,items:{},halted:false,replayPending:false,revocationCursor:0,revokedSubscriptions:{}};
   await atomicWrite(path,data);
  }
  assert(data.halted===undefined||typeof data.halted==='boolean','invalid durable halt state');
  if(data.halted===undefined)data.halted=false;
  if(data.replayPending===undefined)data.replayPending=false;
  assert(typeof data.replayPending==='boolean','invalid replay recovery state');
  if(data.revocationCursor===undefined)data.revocationCursor=0;
  if(data.revokedSubscriptions===undefined)data.revokedSubscriptions={};
  assert(Number.isSafeInteger(data.revocationCursor)&&data.revocationCursor>=0&&
   data.revokedSubscriptions&&typeof data.revokedSubscriptions==='object'&&
   !Array.isArray(data.revokedSubscriptions),'invalid durable revocation state');
  for(const [key,item] of Object.entries(data.items)){
   assert(key===item.delivery?.deliveryKey&&STATES.has(item.status),
    'invalid durable delivery item');
   if(item.status==='dispatching'){
    item.status='retry';item.nextAttemptAt=0;item.updatedAt=clock();
   }
  }
  await atomicWrite(path,data);
 }catch(e){await lease.release();throw e;}
 const withWrite=fn=>{
  const result=operation.then(async()=>{
   assert(!closed,'outbox closed');
   await lease.assertOwner();
   const snapshot=clone(data);
   const out=await fn(snapshot);
   await lease.assertOwner();
   await atomicWrite(path,snapshot);
   data=snapshot;
   return out;
  });
  operation=result.catch(()=>{});
  return result;
 };
 function scrub(item){
  if(!item)return null;
  return Object.freeze({
   key:item.delivery.deliveryKey,channel:item.delivery.channel,status:item.status,
   attempts:item.attempts,nextAttemptAt:item.nextAttemptAt,
   retracted:item.retracted===true,correctionOf:item.delivery.correctionOf??null,
   remoteCancellationPending:item.remoteCancellationPending===true,
   receipt:item.receipt?{provider:item.receipt.provider,externalId:item.receipt.externalId,
    status:item.receipt.status}:null
  });
 }
 async function ensureConsent(d){
  const decision=await checkConsent({tenant:d.tenant,userId:d.userId,
   subscriptionId:d.subscriptionId,recipient:d.recipient,channel:d.channel,
   kind:d.kind,policyVersion:d.policyVersion});
  return decision?.active===true&&decision.muted===false&&
   decision.revoked===false&&decision.consent===true&&
   decision.policyVersion===d.policyVersion&&decision.tenant===d.tenant&&
   decision.userId===d.userId&&decision.subscriptionId===d.subscriptionId&&
   decision.recipient===d.recipient&&decision.channel===d.channel;
 }
 async function enqueue(request){
  // The verifier is external and must check the Indexer finalized event,
  // approved Registry emitters, and canonical current hash before enqueue.
  assert((await verifyEvent(request))===true,'event provenance not verified');
  const d=makeBetDelivery(request);
  assert(await ensureConsent(d),'consent denied or withdrawn');
  return withWrite(async state=>{
   assert(!state.halted,'canonical reorg halt active');
   assert(!state.revokedSubscriptions[JSON.stringify([d.tenant,d.userId,d.subscriptionId])],
    'subscription withdrawn');
   const previous=state.items[d.deliveryKey];
   if(previous){
    assert(JSON.stringify(previous.delivery)===JSON.stringify(d),'idempotency conflict');
    return {created:false,...scrub(previous)};
   }
   assert(Object.keys(state.items).length<10000,'outbox capacity exceeded');
   const t=clock();assert(Number.isSafeInteger(t)&&t>0,'invalid clock');
   const item={delivery:d,status:'pending',attempts:0,nextAttemptAt:t,
    receipt:null,createdAt:t,updatedAt:t};
   state.items[d.deliveryKey]=item;
   return {created:true,...scrub(item)};
  });
 }
 async function cancel(key){
  const result=await withWrite(async state=>{
   const item=state.items[key];assert(item,'unknown delivery');
   if(item.status==='cancelled'||item.status==='dead_letter')
    return {record:scrub(item),delivery:clone(item.delivery),receipt:null};
   if(item.status==='delivered'){
    item.retracted=true;item.updatedAt=clock();
    return {record:scrub(item),delivery:clone(item.delivery),receipt:null};
   }
   // Persist the tombstone and provider-cancellation retry *before* external I/O.
   item.status='cancelled';item.nextAttemptAt=null;item.updatedAt=clock();
   item.remoteCancellationPending=Boolean(item.receipt);
   return {record:scrub(item),delivery:clone(item.delivery),receipt:clone(item.receipt)};
  });
  if(result?.receipt){
   try{
    const cancelled=await providers[result.delivery.channel].cancel(result.delivery,result.receipt);
    if(cancelled?.cancelled===true)await withWrite(async state=>{
     const current=state.items[key];
     if(current?.remoteCancellationPending)current.remoteCancellationPending=false;
    });
    return {...result.record,remoteCancellationConfirmed:cancelled?.cancelled===true};
   }catch{return {...result.record,remoteCancellationConfirmed:false};}
  }
  return {...(result?.record??result),remoteCancellationConfirmed:false};
 }
 async function revokeSubscription({tenant,userId,subscriptionId,sequence=null}={}){
  assert(tenant==='420bet'&&typeof userId==='string'&&userId.length>0&&
   typeof subscriptionId==='string'&&subscriptionId.length>0,'invalid subscription revocation scope');
  if(sequence!==null)assert(Number.isSafeInteger(sequence)&&sequence>0,'invalid revocation sequence');
  const result=await withWrite(async state=>{
   if(sequence!==null){
    if(sequence<=state.revocationCursor)return {duplicate:true,affected:[]};
    assert(sequence===state.revocationCursor+1,'revocation feed sequence gap');
   }
   const id=JSON.stringify([tenant,userId,subscriptionId]);
   state.revokedSubscriptions[id]=true;
   const affected=[];
   for(const item of Object.values(state.items)){
    const d=item.delivery;
    if(d.tenant!==tenant||d.userId!==userId||d.subscriptionId!==subscriptionId)continue;
    if(item.status==='delivered'){
     // Unsubscribing does not invalidate a correctly delivered historical
     // notice, and must never generate an unsolicited correction.
     item.remoteCancellationPending=false;
    }else{
     item.status='cancelled';item.nextAttemptAt=null;
     item.remoteCancellationPending=Boolean(item.receipt);
     if(item.receipt)affected.push({delivery:clone(d),receipt:clone(item.receipt)});
    }
    item.updatedAt=clock();
   }
   if(sequence!==null)state.revocationCursor=sequence;
   return {duplicate:false,affected};
  });
  let confirmations=0;
  for(const item of result.affected)try{
   if((await providers[item.delivery.channel].cancel(item.delivery,item.receipt))?.cancelled===true){
    confirmations++;
    await withWrite(async state=>{
     const active=state.items[item.delivery.deliveryKey];
     if(active?.remoteCancellationPending===true)active.remoteCancellationPending=false;
    });
   }
  }catch{/* durable remote cancellation retry remains pending */}
  return {duplicate:result.duplicate,locallyCancelled:result.affected.length,
   remoteCancellationConfirmed:confirmations,
   remoteCancellationUnconfirmed:result.affected.length-confirmations};
 }
 async function getRevocationCursor(){await operation;return data.revocationCursor;}
 async function recoveryEventIds(){
  await operation;
  return [...new Set(Object.values(data.items).filter(i=>i.delivery.source==='420Indexer-finalized')
   .map(i=>i.delivery.eventId))];
 }
 async function retryRemoteCancellations({limit=20}={}){
  assert(Number.isInteger(limit)&&limit>=1&&limit<=100,'invalid cancellation retry batch');
  await operation;
  const selected=Object.values(data.items).filter(x=>x.remoteCancellationPending===true).slice(0,limit)
   .map(x=>({delivery:clone(x.delivery),receipt:clone(x.receipt)}));
  let confirmed=0,deliveredLate=0,unconfirmed=0;
  for(const candidate of selected){
   const provider=providers[candidate.delivery.channel];
   try{
    const cancel=await provider.cancel(candidate.delivery,candidate.receipt);
    if(cancel?.cancelled===true){
     await withWrite(async state=>{
      const item=state.items[candidate.delivery.deliveryKey];
      if(item?.remoteCancellationPending)item.remoteCancellationPending=false;
     });
     confirmed++;continue;
    }
    const observed=await provider.status(candidate.delivery,candidate.receipt);
    assert(observed?.provider===(candidate.delivery.channel==='mail'?'420Mail':'420Notifications')&&
     observed.externalId===candidate.receipt.externalId&&
     ['delivered','cancelled','failed','pending'].includes(observed.status),
     'unverified cancellation reconciliation receipt');
    if(observed.status==='delivered'){
     await withWrite(async state=>{
      const item=state.items[candidate.delivery.deliveryKey];
      if(!item?.remoteCancellationPending)return;
      item.status='delivered';item.receipt=observed;item.remoteCancellationPending=false;
      if(item.reorgRetracted){item.retracted=true;enqueueCorrectionInState(state,item);}
      item.updatedAt=clock();
     });
     deliveredLate++;continue;
    }
    if(observed.status==='cancelled'||observed.status==='failed'){
     await withWrite(async state=>{
      const item=state.items[candidate.delivery.deliveryKey];
      if(item?.remoteCancellationPending){
       item.remoteCancellationPending=false;item.updatedAt=clock();
      }
     });
     confirmed++;continue;
    }
    unconfirmed++;
   }catch{unconfirmed++;/* durable retry marker persists */}
  }
  return {attempted:selected.length,confirmed,deliveredLate,unconfirmed};
 }
 async function retractEvent(eventId){
  const affected=await withWrite(async state=>{
   assert(typeof eventId==='string'&&/^[a-f0-9]{64}$/.test(eventId),'invalid event key');
   const affected=[];
   for(const item of Object.values(state.items)){
    if(item.delivery.eventId===eventId&&item.status!=='cancelled'){
     if(item.status==='delivered'){
      item.retracted=true; // Preserve already-delivered receipt; cannot unsend.
     }else{
      item.status='cancelled';item.nextAttemptAt=null;
      item.remoteCancellationPending=Boolean(item.receipt);
     }
     item.updatedAt=clock();
     affected.push({delivery:clone(item.delivery),receipt:clone(item.receipt)});
    }
   }
   return affected;
  });
  let confirmed=0;
  for(const item of affected)if(item.receipt){
   try{
    if((await providers[item.delivery.channel].cancel(item.delivery,item.receipt))?.cancelled===true){
     confirmed++;
     await withWrite(async state=>{
      const current=state.items[item.delivery.deliveryKey];
      if(current?.remoteCancellationPending)current.remoteCancellationPending=false;
     });
    }
   }catch{/* unconfirmed remote cancellation stays durable */}
  }
  return {affected:affected.length,remoteCancellationConfirmed:confirmed,
   remoteCancellationUnconfirmed:affected.filter(x=>x.receipt).length-confirmed};
 }
 async function haltForReorg(){
  return withWrite(async state=>{state.halted=true;return {halted:true};});
 }
 function enqueueCorrectionInState(state,original){
  assert(original.status==='delivered'&&original.receipt?.status==='delivered',
   'compensation requires delivered receipt');
  const correction=makeReorgCorrection(original.delivery);
  const existing=state.items[correction.deliveryKey];
  if(existing){
   assert(existing.delivery.correctionOf===original.delivery.deliveryKey,
    'correction idempotency conflict');
   return false;
  }
  assert(Object.keys(state.items).length<10000,'outbox capacity exceeded');
  const t=clock();
  state.items[correction.deliveryKey]={delivery:correction,status:'pending',
   attempts:0,nextAttemptAt:t,receipt:null,createdAt:t,updatedAt:t};
  return true;
 }
 // Only an independently approved, fully completed canonical replay can
 // supersede the reorganization halt and declare prior deliveries orphaned.
 async function reconcileCanonicalReplay({canonicalEventIds,verifyCanonicalRebuild}={}){
  assert(Array.isArray(canonicalEventIds)&&canonicalEventIds.length<=200000&&
   canonicalEventIds.every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)),
   'invalid complete canonical event set');
  assert(typeof verifyCanonicalRebuild==='function'&&
   (await verifyCanonicalRebuild())===true,
   'canonical rebuild not independently verified');
  const canonical=new Set(canonicalEventIds);
  return withWrite(async state=>{
   assert(state.halted||state.replayPending,'reorganization recovery requires halted or pending replay');
   let orphaned=0,corrections=0,cancelPending=0;
   for(const item of Object.values(state.items)){
    const d=item.delivery;
    if(d.source!=='420Indexer-finalized'||canonical.has(d.eventId)||item.reorgRetracted)continue;
    item.reorgRetracted=true;orphaned++;
    if(item.status==='delivered'){
     item.retracted=true;
     if(enqueueCorrectionInState(state,item))corrections++;
    }else if(item.status!=='cancelled'&&item.status!=='dead_letter'){
     item.status='cancelled';item.nextAttemptAt=null;
     item.remoteCancellationPending=Boolean(item.receipt);
     if(item.remoteCancellationPending)cancelPending++;
    }else if(item.receipt?.status==='pending'){
     item.remoteCancellationPending=true;cancelPending++;
    }
    item.updatedAt=clock();
   }
   state.halted=false;state.replayPending=true;
   return {halted:false,replayPending:true,orphaned,corrections,cancelPending};
  });
 }
 async function finishCanonicalReplay(){
  return withWrite(async state=>{
   assert(!state.halted&&state.replayPending,'no verified replay awaiting completion');
   state.replayPending=false;
   return {replayPending:false};
  });
 }
 async function resumeAfterCanonicalReplay(recovery){
  return reconcileCanonicalReplay(recovery);
 }
 async function drain({limit=20}={}){
  assert(Number.isInteger(limit)&&limit>0&&limit<=100,'invalid delivery batch');
  const items=await withWrite(async state=>{
   assert(!state.halted&&!state.replayPending,'canonical reorg halt or replay pending');
   const t=clock(),out=[];
   for(const item of Object.values(state.items)){
    if(out.length>=limit)break;
    if(!['pending','retry','pending_receipt'].includes(item.status)||item.nextAttemptAt>t)continue;
    const action=item.status==='pending_receipt'?'status':'deliver';
    item.status='dispatching';item.updatedAt=t;
    out.push({delivery:clone(item.delivery),action,receipt:clone(item.receipt)});
   }
   return out;
  });
  let delivered=0,deliveredLate=0,failed=0,cancelled=0,pending=0;
  for(const candidate of items){
   const d=candidate.delivery,key=d.deliveryKey;
   let outcome=null,error=false;
   try{
    // Always recheck opt-in immediately before any transport.
    if(!await ensureConsent(d)){outcome={status:'cancelled'};}
    else if(candidate.action==='status'&&candidate.receipt)
     outcome=await providers[d.channel].status(d,candidate.receipt);
    else outcome=await providers[d.channel].deliver(d);
   }catch{error=true;}
   const result=await withWrite(async state=>{
    const item=state.items[key];
    if(!item)return null;
    if(item.status==='cancelled'){
     if((outcome?.status==='delivered'||outcome?.status==='pending')&&
      outcome.provider===(d.channel==='mail'?'420Mail':'420Notifications')&&
      typeof outcome.externalId==='string'&&outcome.externalId.length>0){
      item.receipt=outcome;
      if(outcome.status==='delivered'){
       item.status='delivered';item.remoteCancellationPending=false;
       if(item.reorgRetracted){item.retracted=true;enqueueCorrectionInState(state,item);}
      }else item.remoteCancellationPending=true;
      item.updatedAt=clock();
     }
     return {status:item.status==='delivered'?'delivered_late':'cancelled'};
    }
    if(outcome?.status==='cancelled'){
     item.status='cancelled';item.nextAttemptAt=null;
     item.remoteCancellationPending=Boolean(item.receipt);
    }
    else if(outcome?.status==='delivered'){
     assert(outcome.provider=== (d.channel==='mail'?'420Mail':'420Notifications')&&
      typeof outcome.externalId==='string'&&outcome.externalId.length>0,
      'unverified delivery receipt');
     item.status='delivered';item.nextAttemptAt=null;item.receipt=outcome;
    }else if(outcome?.status==='pending'){
     assert(outcome.provider===(d.channel==='mail'?'420Mail':'420Notifications')&&
      typeof outcome.externalId==='string'&&outcome.externalId.length>0,
      'unverified pending receipt');
     item.status='pending_receipt';item.receipt=outcome;
     item.nextAttemptAt=clock()+Math.min(maxBackoffMs,baseBackoffMs);
    }else{
     item.attempts++;
     if(item.attempts>=maxAttempts){item.status='dead_letter';item.nextAttemptAt=null;}
     else{
      item.status='retry';item.nextAttemptAt=clock()+Math.min(maxBackoffMs,
       baseBackoffMs*2**(item.attempts-1));
     }
    }
    item.updatedAt=clock();
    return {status:item.status};
   });
   if(result?.status==='delivered')delivered++;
   else if(result?.status==='delivered_late')deliveredLate++;
   else if(result?.status==='cancelled'){cancelled++;
    if(candidate.receipt)try{
     if((await providers[d.channel].cancel(d,candidate.receipt))?.cancelled===true)
      await withWrite(async state=>{
       const active=state.items[key];
       if(active?.remoteCancellationPending)active.remoteCancellationPending=false;
      });
    }catch{/* durable pending marker remains for retry */}}
   else if(result?.status==='pending_receipt')pending++;
   else if(error||result?.status==='retry'||result?.status==='dead_letter')failed++;
  }
  return Object.freeze({processed:items.length,delivered,deliveredLate,failed,cancelled,pending});
 }
 async function get(key){await operation;return scrub(data.items[key]);}
 async function summary(){
  await operation;
  const items=Object.values(data.items),time=clock();
  const oldest=list=>list.length?Math.max(0,time-Math.min(...list.map(i=>i.updatedAt))):0;
  return {total:items.length,byStatus:counts(data),halted:data.halted,
   replayPending:data.replayPending,
   remoteCancellationPending:items.filter(i=>i.remoteCancellationPending).length,
   oldestCancellationAgeMs:oldest(items.filter(i=>i.remoteCancellationPending)),
   oldestPendingAgeMs:oldest(items.filter(i=>['pending','retry','pending_receipt'].includes(i.status))),
   correctionPending:items.filter(i=>i.delivery.correctionOf&&
    i.status!=='delivered'&&i.status!=='cancelled').length};
 }
 async function close(){await operation;closed=true;await lease.release();}
 return Object.freeze({enqueue,cancel,revokeSubscription,getRevocationCursor,recoveryEventIds,retryRemoteCancellations,retractEvent,haltForReorg,reconcileCanonicalReplay,finishCanonicalReplay,resumeAfterCanonicalReplay,drain,get,summary,close});
}
