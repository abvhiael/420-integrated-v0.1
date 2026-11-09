// BET-AUDIT-7 — durable, single-writer, consent-scoped outbox.
// A canonical finalized event never becomes a Mail or Notifications authority.
import {mkdir,open,readFile,rename,rm,stat,chmod} from 'node:fs/promises';
import {dirname,basename,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {makeBetDelivery} from './notifications-mail-adapters.mjs';
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
 await mkdir(lock,{mode:0o700}); // Existing lock: fail closed; requires independent recovery.
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
   data={schema:1,items:{},halted:false,revocationCursor:0,revokedSubscriptions:{}};
   await atomicWrite(path,data);
  }
  assert(data.halted===undefined||typeof data.halted==='boolean','invalid durable halt state');
  if(data.halted===undefined)data.halted=false;
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
 }catch(e){await rm(lock,{recursive:true,force:true});throw e;}
 const withWrite=fn=>{
  const result=operation.then(async()=>{
   assert(!closed,'outbox closed');
   const snapshot=clone(data);
   const out=await fn(snapshot);
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
   retracted:item.retracted===true,
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
   if(item.status==='cancelled'||item.status==='dead_letter')return {record:scrub(item),delivery:clone(item.delivery),receipt:null};
   // Cancel BEFORE any external calls and retain cancellation tombstone.
   item.status='cancelled';item.nextAttemptAt=null;item.updatedAt=clock();
   return {record:scrub(item),delivery:clone(item.delivery),receipt:clone(item.receipt)};
  });
  if(result?.receipt){
   try{
    const cancelled=await providers[result.delivery.channel].cancel(result.delivery,result.receipt);
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
     item.retracted=true;
     item.remoteCancellationPending=false; // Already delivered cannot be unsent.
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
 async function retryRemoteCancellations({limit=20}={}){
  assert(Number.isInteger(limit)&&limit>=1&&limit<=100,'invalid cancellation retry batch');
  await operation;
  const selected=Object.values(data.items).filter(x=>x.remoteCancellationPending===true).slice(0,limit)
   .map(x=>({delivery:clone(x.delivery),receipt:clone(x.receipt)}));
  let confirmed=0;
  for(const item of selected){
   try{
    if((await providers[item.delivery.channel].cancel(item.delivery,item.receipt))?.cancelled===true){
     await withWrite(async state=>{
      const current=state.items[item.delivery.deliveryKey];
      if(current?.remoteCancellationPending===true)current.remoteCancellationPending=false;
     });
     confirmed++;
    }
   }catch{/* keep durable pending marker for next reconciliation */}
  }
  return {attempted:selected.length,confirmed,unconfirmed:selected.length-confirmed};
 }
 async function retractEvent(eventId){
  const affected=await withWrite(async state=>{
   assert(typeof eventId==='string'&&/^[a-f0-9]{64}$/.test(eventId),'invalid event key');
   const affected=[];
   for(const item of Object.values(state.items)){
    if(item.delivery.eventId===eventId&&item.status!=='cancelled'){
     if(item.status==='delivered'){
      item.retracted=true; // Preserve already-delivered receipt; cannot unsend.
     }else{item.status='cancelled';item.nextAttemptAt=null;}
     item.updatedAt=clock();
     affected.push({delivery:clone(item.delivery),receipt:clone(item.receipt)});
    }
   }
   return affected;
  });
  let confirmed=0;
  for(const item of affected)if(item.receipt){
   try{if((await providers[item.delivery.channel].cancel(item.delivery,item.receipt))?.cancelled===true)confirmed++;}catch{}
  }
  return {affected:affected.length,remoteCancellationConfirmed:confirmed,
   remoteCancellationUnconfirmed:affected.filter(x=>x.receipt).length-confirmed};
 }
 async function haltForReorg(){
  return withWrite(async state=>{state.halted=true;return {halted:true};});
 }
 async function resumeAfterCanonicalReplay(verifyCanonicalRebuild){
  assert(typeof verifyCanonicalRebuild==='function','trusted rebuild verification required');
  assert((await verifyCanonicalRebuild())===true,'canonical rebuild not independently verified');
  return withWrite(async state=>{state.halted=false;return {halted:false};});
 }
 async function drain({limit=20}={}){
  assert(Number.isInteger(limit)&&limit>0&&limit<=100,'invalid delivery batch');
  const items=await withWrite(async state=>{
   assert(!state.halted,'canonical reorg halt active');
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
  let delivered=0,failed=0,cancelled=0,pending=0;
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
    if(item.status==='cancelled')return {status:'cancelled'};
    if(outcome?.status==='cancelled'){item.status='cancelled';item.nextAttemptAt=null;}
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
   else if(result?.status==='cancelled'){cancelled++;
    if(candidate.receipt)try{await providers[d.channel].cancel(d,candidate.receipt);}catch{/* tombstone remains; report to operator */}}
   else if(result?.status==='pending_receipt')pending++;
   else if(error||result?.status==='retry'||result?.status==='dead_letter')failed++;
  }
  return Object.freeze({processed:items.length,delivered,failed,cancelled,pending});
 }
 async function get(key){await operation;return scrub(data.items[key]);}
 async function summary(){await operation;return {total:Object.keys(data.items).length,byStatus:counts(data)};}
 async function close(){await operation;closed=true;await rm(lock,{recursive:true});}
 return Object.freeze({enqueue,cancel,revokeSubscription,getRevocationCursor,retryRemoteCancellations,retractEvent,haltForReorg,resumeAfterCanonicalReplay,drain,get,summary,close});
}
