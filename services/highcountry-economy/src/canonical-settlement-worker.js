// R04.8 durable canonical transfer dispatch with cross-worker lease and reconciliation.
// Chain submission is external to the database transaction; no false atomicity claim.
// The canonical on-chain operation ID remains deterministic and idempotent.
import {SettlementError} from './buds-ledger.js';
const valid=x=>typeof x==='string'&&/^[a-zA-Z0-9:_-]{1,128}$/.test(x);
export class CanonicalSettlementWorker {
 constructor({store,settlement,authority,submitCanonical,clock=()=>Date.now(),leaseMs=60000}){
  if(typeof store?.transact!=='function'||typeof settlement?.finalize!=='function'||
     typeof settlement?.abort!=='function'||typeof authority?.confirmedReservedTransfer!=='function'||
     typeof authority?.proveUnexecutedAndCancelled!=='function'||typeof submitCanonical!=='function'||
     !Number.isSafeInteger(leaseMs)||leaseMs<1000||leaseMs>300000)
    throw new SettlementError('invalid settlement worker configuration');
  Object.assign(this,{store,settlement,authority,submitCanonical,clock,leaseMs});
 }
 async tick(transferOp){
  if(!valid(transferOp))throw new SettlementError('invalid transfer operation');
  const now=this.clock();
  // Row-level SERIALIZABLE transaction ensures one active claim across instances.
  const claim=await this.store.transact(s=>{
   const intent=s.transferIntents.get(transferOp);
   if(!intent||intent.status!=='prepared')return null;
   const job=s.settlementJobs.get(transferOp)||{attempts:0,leaseUntil:0,txHash:null};
   if(job.leaseUntil>now)return {busy:true};
   if(job.attempts>=50)throw new SettlementError('worker attempts exhausted');
   job.leaseUntil=now+this.leaseMs;job.attempts++;
   s.settlementJobs.set(transferOp,job);
   return {intent:{...intent},job:{...job}};
  });
  if(claim===null)return {status:'resolved'};
  if(claim.busy)return {status:'leased'};
  const release=async hash=>this.store.transact(s=>{
   const job=s.settlementJobs.get(transferOp);
   if(job && job.leaseUntil===now+this.leaseMs){
     job.leaseUntil=0;if(hash)job.txHash=hash;
   }
  });
  try{
   if(await this.authority.confirmedReservedTransfer(transferOp)){
    const result=await this.settlement.finalize('finalize:'+transferOp,transferOp);
    await release();
    return {status:'finalized',result};
   }
   if(await this.authority.proveUnexecutedAndCancelled(
      transferOp,claim.intent.listingId,claim.intent.buyer)){
    const result=await this.settlement.abort('abort:'+transferOp,transferOp);
    await release();
    return {status:'cancelled',result};
   }
   // Never automatically submit twice once txHash has been durably recorded.
   // A post-broadcast/pre-record crash relies on deterministic on-chain replay protection.
   if(claim.job.txHash){await release();return {status:'awaiting-finality',txHash:claim.job.txHash};}
   // A prior broadcast may have succeeded before its hash reached PostgreSQL.
   // An indeterminate dispatch must be reconciled on-chain, never rebroadcast.
   if(claim.job.dispatchStarted){await release();return {status:'reconcile-dispatch'};}
   if(typeof this.authority.requireSubmissionAllowed==='function')await this.authority.requireSubmissionAllowed(claim.intent);
   // Commit the write-ahead dispatch marker BEFORE calling a non-transactional RPC.
   // Recovery is fail-closed if a process dies after broadcasting but before hash persistence.
   await this.store.transact(s=>{
    const t=s.transferIntents.get(transferOp),job=s.settlementJobs.get(transferOp);
    if(!t||t.status!=='prepared'||!job||job.leaseUntil!==now+this.leaseMs||job.dispatchStarted)
     throw new SettlementError('lost canonical dispatch lease');
    job.dispatchStarted=true;
   });
   const submission=await this.submitCanonical({...claim.intent});
   if(!submission||!valid(submission.txHash))throw new SettlementError('invalid chain submission');
   await release(submission.txHash);
   return {status:'submitted',txHash:submission.txHash};
  }catch(error){
   await release();
   throw error;
  }
 }
}
