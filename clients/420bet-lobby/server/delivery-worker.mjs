// BET-AUDIT-7: single-instance operational scheduler. No keys, addresses or
// private messages in monitoring state. Checkpoint and delivery state have
// independent fsync/rename durability guarantees.
import {mkdir,open,readFile,rename,rm,stat,chmod} from 'node:fs/promises';
import {dirname,basename,join,isAbsolute} from 'node:path';
import {randomBytes} from 'node:crypto';

const requireValid=(value,message)=>{if(!value)throw Error('420Bet delivery worker: '+message);};
const isInt=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const initial=()=>({schema:1,cycles:0,completed:0,failures:0,consecutiveFailures:0,
 recoveryCount:0,inFlight:false,lastStartedAt:null,lastCompletedAt:null,
 lastSuccessAt:null,lastFailureAt:null,lastErrorCode:null,lastPublish:null,lastDrain:null});
function sanitizedError(error){
 if(error?.name==='AbortError'||error?.name==='TimeoutError')return 'TIMEOUT';
 const message=String(error?.message??'');
 if(/reorg|canonical/i.test(message))return 'CANONICAL_HALT';
 if(/consent|revocation|subscription/i.test(message))return 'CONSENT_AUTHORITY';
 if(/registry|indexer|manifest|chain/i.test(message))return 'CANONICAL_DEPENDENCY';
 if(/mail|notifications|provider|delivery/i.test(message))return 'DELIVERY_DEPENDENCY';
 return 'WORKER_FAILURE';
}
async function persist(path,value){
 const dir=dirname(path),tmp=join(dir,'.'+basename(path)+'.'+randomBytes(8).toString('hex')+'.tmp');
 let file;
 try{
  file=await open(tmp,'wx',0o600);await file.writeFile(JSON.stringify(value)+'\n','utf8');
  await file.sync();await file.close();file=null;
  await rename(tmp,path);await chmod(path,0o600);
  const fd=await open(dir,'r');try{await fd.sync();}finally{await fd.close();}
 }finally{if(file)await file.close();await rm(tmp,{force:true});}
}
function validate(state){
 requireValid(state?.schema===1&&isInt(state.cycles,0,Number.MAX_SAFE_INTEGER)&&
  isInt(state.completed,0,state.cycles)&&isInt(state.failures,0,state.cycles)&&
  isInt(state.consecutiveFailures,0,state.cycles)&&
  isInt(state.recoveryCount,0,Number.MAX_SAFE_INTEGER)&&typeof state.inFlight==='boolean',
  'invalid persistent monitoring checkpoint');
 for(const field of ['lastStartedAt','lastCompletedAt','lastSuccessAt','lastFailureAt'])
  requireValid(state[field]===null||isInt(state[field],1,Number.MAX_SAFE_INTEGER),
   'invalid monitored timestamp');
 requireValid(state.lastErrorCode===null||['TIMEOUT','CANONICAL_HALT','CONSENT_AUTHORITY',
  'CANONICAL_DEPENDENCY','DELIVERY_DEPENDENCY','WORKER_FAILURE'].includes(state.lastErrorCode),
  'invalid monitored failure');
}
export async function openBetOperationalDeliveryWorker({
 runtime,statePath,indexerCheckpointPath=null,intervalMs=5000,retryMaxMs=60000,staleAfterMs=30000,
 maxBlocks=64,drainLimit=20,clock=Date.now
}={}){
 requireValid(runtime&&typeof runtime.publish==='function'&&typeof runtime.drain==='function'&&
  typeof runtime.syncRevocations==='function'&&typeof runtime.stop==='function'&&
  typeof runtime.outbox?.summary==='function'&&typeof runtime.outbox?.getRevocationCursor==='function',
  'qualified runtime required');
 requireValid(typeof statePath==='string'&&isAbsolute(statePath)&&!statePath.includes('\0'),
  'absolute private monitoring checkpoint required');
 for(const [value,min,max,label] of [[intervalMs,100,3600000,'interval'],[retryMaxMs,intervalMs,3600000,'retry window'],
 [staleAfterMs,intervalMs,86400000,'staleness'],[maxBlocks,1,64,'block batch'],
 [drainLimit,1,100,'delivery batch']])requireValid(isInt(value,min,max),'invalid '+label);
 requireValid(typeof clock==='function','clock required');
 requireValid(indexerCheckpointPath===null||(typeof indexerCheckpointPath==='string'&&
  isAbsolute(indexerCheckpointPath)&&indexerCheckpointPath!==statePath&&!indexerCheckpointPath.includes('\0')),
  'invalid separate Indexer checkpoint path');
 const parent=dirname(statePath);
 await mkdir(parent,{recursive:true,mode:0o700});
 requireValid(((await stat(parent)).mode&0o022)===0,'monitoring directory unsafe');
 const lock=statePath+'.lock';
 await mkdir(lock,{mode:0o700}); // Fail closed on orphaned/active writer lock.
 let state,closed=false,stopping=false,started=false,timer=null,inFlight=null;
 let indexerLockFile=null,ownsIndexerLock=false;
 try{
  if(indexerCheckpointPath!==null){
   const cpdir=dirname(indexerCheckpointPath);
   await mkdir(cpdir,{recursive:true,mode:0o700});
   requireValid(((await stat(cpdir)).mode&0o022)===0,'Indexer checkpoint directory unsafe');
   // Other Indexer writers already use this same .lock path.
   indexerLockFile=indexerCheckpointPath+'.lock';
   const guard=await open(indexerLockFile,'wx',0o600);
   ownsIndexerLock=true;
   await guard.close();
  }
  try{
   const info=await stat(statePath);
   requireValid(info.isFile()&&(info.mode&0o077)===0&&info.size<=65536,
    'monitoring checkpoint insecure or too large');
   state=JSON.parse(await readFile(statePath,'utf8'));validate(state);
  }catch(error){
   if(error?.code!=='ENOENT')throw error;
   state=initial();await persist(statePath,state);
  }
  if(state.inFlight){
   state.recoveryCount++;
   state.inFlight=false;
   state.lastErrorCode='WORKER_FAILURE';
   state.lastSuccessAt=null; // prior health cannot authorize dispatch after crash
   await persist(statePath,state);
  }
 }catch(error){if(ownsIndexerLock)await rm(indexerLockFile,{force:true});
  await rm(lock,{recursive:true,force:true});throw error;}
 const snapshot=()=>structuredClone(state);
 function health(){
  const time=clock();
  const stale=state.lastSuccessAt===null||time-state.lastSuccessAt>staleAfterMs;
  return Object.freeze({service:'420Bet delivery worker',running:started&&!stopping&&!closed,
   ready:started&&!stopping&&!closed&&!stale&&state.consecutiveFailures===0&&
    runtime.revocationHealth?.().failed!==true,
   stale,cycles:state.cycles,completed:state.completed,failures:state.failures,
   consecutiveFailures:state.consecutiveFailures,recoveryCount:state.recoveryCount,
   inFlight:state.inFlight,lastSuccessAt:state.lastSuccessAt,
   lastFailureAt:state.lastFailureAt,lastErrorCode:state.lastErrorCode});
 }
 async function checkpoint(next){validate(next);await persist(statePath,next);state=next;}
 async function execute(){
  requireValid(!stopping&&!closed,'worker stopped');
  requireValid(!inFlight,'delivery cycle already running');
  const work=(async()=>{
   const t=clock();
   const begin={...snapshot(),cycles:state.cycles+1,inFlight:true,lastStartedAt:t};
   await checkpoint(begin);
   try{
    // Strict ordering: revoked audiences first, finalized source next,
    // then outbound transport and provider receipt reconciliation.
    const revoke=await runtime.syncRevocations();
    const published=await runtime.publish({maxBlocks});
    requireValid(published?.halted!==true&&
     (published?.reorganized!==true||published?.recovered===true),
     'canonical reorg halt requires independently verified full replay');
    const drained=await runtime.drain({limit:drainLimit});
    const summary=await runtime.outbox.summary();
    requireValid(summary?.halted!==true&&summary?.replayPending!==true,
     'outbox canonical halt or incomplete replay');
    const completed={...snapshot(),inFlight:false,completed:state.completed+1,
     consecutiveFailures:0,lastCompletedAt:clock(),lastSuccessAt:clock(),lastErrorCode:null,
     lastPublish:{queued:published.queued??0,scanned:published.scanned??null,
      nextBlock:published.nextBlock??null},
     lastDrain:{processed:drained.processed??0,delivered:drained.delivered??0,
      failed:drained.failed??0,pending:drained.pending??0,cancelled:drained.cancelled??0}};
    await checkpoint(completed);
    return Object.freeze({revocations:revoke?.processed??0,published:completed.lastPublish,
     delivery:completed.lastDrain,ready:true});
   }catch(error){
    const failed={...snapshot(),inFlight:false,failures:state.failures+1,
     consecutiveFailures:state.consecutiveFailures+1,lastFailureAt:clock(),
     lastCompletedAt:clock(),lastErrorCode:sanitizedError(error)};
    await checkpoint(failed);throw error;
   }
  })();
  inFlight=work;
  try{return await work;}finally{inFlight=null;}
 }
 function schedule(delay){
  if(stopping||closed)return;
  timer=setTimeout(async()=>{
   timer=null;
   try{await execute();}catch{/* dashboard exposes sanitized state, never secrets */}
   if(!stopping&&!closed){
    const exp=Math.min(state.consecutiveFailures,10);
    schedule(Math.min(retryMaxMs,intervalMs*2**exp));
   }
  },delay);
  timer.unref?.();
 }
 function start(){
  requireValid(!started&&!closed&&!stopping,'worker already running or stopped');
  started=true;schedule(0);
 }
 async function stop(){
  if(closed)return;
  stopping=true;if(timer){clearTimeout(timer);timer=null;}
  if(inFlight)await inFlight.catch(()=>{});
  closed=true;
  // The outbox must close before the worker lock is released.
  try{await runtime.stop();}finally{
   if(ownsIndexerLock)await rm(indexerLockFile,{force:true});
   await rm(lock,{recursive:true,force:true});
  }
 }
 return Object.freeze({start,runOnce:execute,health,checkpoint:()=>snapshot(),stop});
}
