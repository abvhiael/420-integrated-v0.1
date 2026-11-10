// Privacy-minimized durable operational incident alerts. No recipients,
// wallets, messages, headers, provider secrets or bet amounts are emitted.
import {mkdir,open,readFile,rename,rm,stat,chmod} from 'node:fs/promises';
import {dirname,basename,join,isAbsolute} from 'node:path';
import {createHash,createHmac,randomBytes} from 'node:crypto';
import {acquireDeliveryWriterLease} from './delivery-writer-lease.mjs';

const demand=(ok,why)=>{if(!ok)throw Error('420Bet alert journal: '+why);};
const codeList=new Set(['REORG_HALT','REPLAY_PENDING','WORKER_STALE','WORKER_FAILURES',
 'REVOCATION_UNAVAILABLE','REMOTE_CANCELLATION_BACKLOG','DEAD_LETTERS','PENDING_TOO_OLD']);
function incidents(health,queue,{cancellationAgeMs,pendingAgeMs}){
 const active=[];
 if(queue.halted===true)active.push('REORG_HALT');
 if(queue.replayPending===true)active.push('REPLAY_PENDING');
 if(health.stale===true)active.push('WORKER_STALE');
 if(health.consecutiveFailures>=3)active.push('WORKER_FAILURES');
 if(health.revocationFailed===true)active.push('REVOCATION_UNAVAILABLE');
 if(queue.remoteCancellationPending>0&&queue.oldestCancellationAgeMs>=cancellationAgeMs)
  active.push('REMOTE_CANCELLATION_BACKLOG');
 if(queue.byStatus?.dead_letter>0)active.push('DEAD_LETTERS');
 if(queue.oldestPendingAgeMs>=pendingAgeMs)active.push('PENDING_TOO_OLD');
 return active;
}
async function persist(path,state){
 const directory=dirname(path);
 const temp=join(directory,'.'+basename(path)+'.'+randomBytes(8).toString('hex')+'.tmp');
 let fd;
 try{
  fd=await open(temp,'wx',0o600);
  await fd.writeFile(JSON.stringify(state)+'\n');await fd.sync();await fd.close();fd=null;
  await rename(temp,path);await chmod(path,0o600);
  const parent=await open(directory,'r');try{await parent.sync();}finally{await parent.close();}
 }finally{if(fd)await fd.close();await rm(temp,{force:true});}
}
export async function openDeliveryAlertJournal({
 path,worker,outbox,send,clock=Date.now,
 cancellationAgeMs=60000,pendingAgeMs=180000,
 retryMs=15000
}={}){
 demand(isAbsolute(path)&&!path.includes('\0'),'private absolute alert path required');
 demand(typeof worker?.health==='function'&&typeof outbox?.summary==='function'&&
  typeof send==='function','qualified monitor and alert sink required');
 for(const n of [cancellationAgeMs,pendingAgeMs,retryMs])
  demand(Number.isSafeInteger(n)&&n>=100&&n<=86400000,'invalid alert thresholds');
 await mkdir(dirname(path),{recursive:true,mode:0o700});
 demand(((await stat(dirname(path)).mode&0o022)===0),'unsafe alert directory');
 const lease=await acquireDeliveryWriterLease(path+'.lock');
 let state,closed=false,chain=Promise.resolve();
 try{
  try{
   const info=await stat(path);
   demand(info.isFile()&&(info.mode&0o077)===0&&info.size<=65536,'unsafe alert state');
   state=JSON.parse(await readFile(path,'utf8'));
   demand(state.schema===1&&state.active&&typeof state.active==='object'&&
    state.pending&&typeof state.pending==='object','invalid alert checkpoint');
   for(const k of [...Object.keys(state.active),...Object.keys(state.pending)])
    demand(codeList.has(k),'unapproved alert code');
  }catch(e){
   if(e?.code!=='ENOENT')throw e;
   state={schema:1,active:{},pending:{}};
   await persist(path,state);
  }
 }catch(e){await lease.release();throw e;}
 function write(fn){
  const result=chain.then(async()=>{
   demand(!closed,'journal closed');await lease.assertOwner();
   const next=structuredClone(state),result=await fn(next);
   await lease.assertOwner();await persist(path,next);state=next;return result;
  });
  chain=result.catch(()=>{});
  return result;
 }
 async function poll(){
  const [health,queue]=await Promise.all([worker.health(),outbox.summary()]);
  const active=new Set(incidents(health,queue,{cancellationAgeMs,pendingAgeMs}));
  const t=clock();
  await write(next=>{
   for(const code of active)if(!next.active[code]){
    const firstSeenAt=t,id=createHash('sha256').update(code+'|'+firstSeenAt).digest('hex');
    next.active[code]={id,firstSeenAt};
    next.pending[code]={id,code,status:'firing',at:firstSeenAt,nextAttemptAt:0};
   }
   for(const code of Object.keys(next.active))if(!active.has(code)){
    const prior=next.active[code];
    next.pending[code]={id:prior.id,code,status:'resolved',at:t,nextAttemptAt:0};
    delete next.active[code];
   }
  });
  let sent=0,failed=0;
  for(const pending of Object.values(state.pending)){
   if(pending.nextAttemptAt>t)continue;
   // Save next retry BEFORE external request, so a crash cannot lose the alert.
   await write(next=>{if(next.pending[pending.code]?.id===pending.id)
    next.pending[pending.code].nextAttemptAt=t+retryMs;});
   try{
    await send(Object.freeze({schema:'420bet-delivery-alert-v1',
     id:pending.id,code:pending.code,status:pending.status,at:pending.at}));
    await write(next=>{
     if(next.pending[pending.code]?.id===pending.id&&
      next.pending[pending.code]?.status===pending.status)
      delete next.pending[pending.code];
    });
    sent++;
   }catch{failed++;}
  }
  return Object.freeze({active:[...active],pending:Object.keys(state.pending).length,sent,failed});
 }
 async function snapshot(){await chain;return Object.freeze({
  activeCodes:Object.keys(state.active),pendingCodes:Object.keys(state.pending)});
 }
 async function close(){await chain;closed=true;await lease.release();}
 return Object.freeze({poll,snapshot,close});
}
export function createSignedDeliveryAlertWebhook({url,secret,fetcher=fetch,timeoutMs=8000}={}){
 const uri=new URL(url);
 demand(uri.protocol==='https:'&&!uri.username&&!uri.password&&!uri.search&&!uri.hash&&
  secret?.length>=32,'private approved HTTPS alert webhook and secret required');
 return async event=>{
  const body=JSON.stringify(event);
  const signature=createHmac('sha256',secret).update(body).digest('hex');
  const response=await fetcher(uri.href,{method:'POST',cache:'no-store',
   credentials:'omit',redirect:'error',headers:{
    'Content-Type':'application/json','X-420Bet-Alert-Signature':signature,
    'X-420Bet-Alert-Id':event.id},body,signal:AbortSignal.timeout(timeoutMs)});
  demand(response?.ok,'approved alert sink unavailable');
 };
}
