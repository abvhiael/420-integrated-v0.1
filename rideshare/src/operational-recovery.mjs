import {createHash} from 'node:crypto';
import {validateDutyCoverage,assessEscalation} from './operational-safety.mjs';
import {createRecoveryWorker} from './reliability.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code})};
const id=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(s);
const digest=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const integer=n=>Number.isSafeInteger(n)&&n>=0;
/** Verify restored data, migrations, private records and held evidence before any resume. */
export function verifyRecoveryProof({source,restored,expectedSha,now}){
 if(!digest(expectedSha)||!integer(now)||!source||!restored)fail('RECOVERY_PROOF_INVALID');
 for(const x of [source,restored]){
  if(!digest(x.imageDigest)||!digest(x.migrationDigest)||!digest(x.dataDigest)||
     !digest(x.auditDigest)||!digest(x.holdDigest)||!integer(x.recordCount)||
     !integer(x.verifiedAt)||x.verifiedAt>now||x.releaseSha!==expectedSha)
     fail('RECOVERY_PROOF_INVALID');
 }
 if(source.migrationDigest!==restored.migrationDigest||
    source.dataDigest!==restored.dataDigest||
    source.auditDigest!==restored.auditDigest||
    source.holdDigest!==restored.holdDigest||
    source.recordCount!==restored.recordCount)fail('RECOVERY_INTEGRITY_MISMATCH');
 return Object.freeze({integrityVerified:true,releaseSha:expectedSha,trafficEnabled:false});
}
/** A controlled, private recovery coordinator. Never provides production traffic authority. */
export function createOperationalRecovery({queue,handlers,recovery,audit,escalation,roster,clock=()=>Math.floor(Date.now()/1000),workerId}){
 if(!id(workerId)||!queue||!recovery||!audit||!escalation||!roster||
 typeof recovery.pause!=='function'||typeof recovery.rollback!=='function'||
 typeof recovery.verifyRestore!=='function'||typeof audit.append!=='function'||
 typeof escalation.deliver!=='function'||typeof roster.current!=='function')
 fail('OPERATIONAL_RECOVERY_UNAVAILABLE');
 const worker=createRecoveryWorker(queue,{workerId,handlers});
 const now=()=>{const n=clock();if(!integer(n))fail('RECOVERY_CLOCK_INVALID');return n};
 let paused=true;
 async function append(action,commandId,result){
  // Audit is an independently durable append; no personal data or provider details.
  const receipt=await audit.append(Object.freeze({domain:'liftd.recovery',action,commandId,at:now(),result}));
  if(!id(receipt?.receiptId)||!digest(receipt?.digest))fail('RECOVERY_AUDIT_UNCONFIRMED');
  return receipt;
 }
 return Object.freeze({
  async recoverJob(){if(!paused)fail('RECOVERY_NOT_PAUSED');return worker.runOnce()},
  async pauseAndEscalate({commandId,incidentId,createdAt}){
   if(!id(commandId)||!id(incidentId)||!integer(createdAt)||createdAt>now())fail('RECOVERY_COMMAND_INVALID');
   const duty=validateDutyCoverage(await roster.current(),now());
   const result=await recovery.pause({commandId,incidentId});
   if(result?.paused!==true)fail('RECOVERY_PAUSE_UNCONFIRMED');
   paused=true;
   const route=assessEscalation({createdAt,acknowledgedAt:null,primary:duty.primary,backup:duty.backup,supervisor:duty.supervisor},now());
   const receipt=await escalation.deliver(Object.freeze({incidentId,commandId,route:route.route}));
   if(!id(receipt?.receiptId))fail('RECOVERY_ESCALATION_UNCONFIRMED');
   await append('pause',commandId,'PAUSED');
   return Object.freeze({paused:true,escalated:true});
  },
  async rollback({commandId,approvedBy,independentApprover,expectedRevision,source,restored,expectedSha}){
   if(!paused||!id(commandId)||!id(approvedBy)||!id(independentApprover)||approvedBy===independentApprover||
      !integer(expectedRevision))fail('RECOVERY_ROLLBACK_DENIED');
   const proof=verifyRecoveryProof({source,restored,expectedSha,now:now()});
   const before=await recovery.verifyRestore({commandId,expectedRevision});
   if(before?.verified!==true||before?.revision!==expectedRevision)fail('RECOVERY_RESTORE_UNCONFIRMED');
   const result=await recovery.rollback({commandId,expectedRevision,approvedBy,independentApprover,releaseSha:proof.releaseSha});
   if(result?.rolledBack!==true||result?.revision!==expectedRevision+1)fail('RECOVERY_ROLLBACK_UNCONFIRMED');
   await append('rollback',commandId,'ROLLED_BACK');
   return Object.freeze({rolledBack:true,trafficEnabled:false,revision:result.revision});
  }
 });
}
