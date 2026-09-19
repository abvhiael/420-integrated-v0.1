import test from 'node:test';
import assert from 'node:assert/strict';
import { QualifiedProviderTransactions420, type QualifiedComputeExecutor420 } from '../src/qualified-transactions.js';
import type { CanonicalStatePort420, CanonicalWork420, Hex32 } from '../src/types.js';

const id=(x:string)=>('0x'+x.repeat(64)) as Hex32;
const addr=(x:string)=>'0x'+x.repeat(40);
const ai=id('1'), compute=id('2'), aiJob=id('3'), job=id('4'), req=id('5'), manifest=id('6'), zero=id('0');
const operator=addr('a');
function fixture(state:CanonicalWork420['computeJob']['state']='MATCHED') {
  const work: CanonicalWork420={
    provider:{providerId:ai,operatorAccount:operator as `0x${string}`,settlementAccount:addr('b') as `0x${string}`,stakeRef:id('9'),computeProviderRef:compute,state:'ACTIVE'},
    aiJob:{jobId:aiJob,requester:addr('c') as `0x${string}`,modelVersionId:id('7'),workloadClass:id('8'),requestHash:id('9'),privacyPolicyId:zero,verificationProfileId:zero,maxSpend420:100n,deadline:2000000000,computeRequestId:req,computeJobId:job,providerId:ai,state:'RUNNING'},
    computeJob:{jobId:job,requestId:req,providerId:compute,resourceId:id('a'),state,outputCommitment:id('b'),resultManifestHash:manifest},
    computeRequest:{requestId:req,requester:addr('c') as `0x${string}`,workloadClass:id('8'),inputCommitment:id('9'),maxSpend420:100n,fundedAmount420:80n,deadline:2000000000,privacyPolicyId:zero,verificationProfileId:zero}
  };
  const chain:CanonicalStatePort420={getCanonicalWork:async()=>work};
  const calls:string[]=[];
  const executor:QualifiedComputeExecutor420={chainId:420n,computeJobsAddress:addr('d'),computeReceiptsAddress:addr('e'),operatorAddress:async()=>operator,
    sendAndConfirm:async(input)=>{calls.push(input.method);return {txHash:id('f'),confirmed:true,success:true,chainId:420n,target:input.target};},
    receiptHead:async()=>({sequence:0n,receiptId:zero,units:0n,charge420:0n}),canonicalReceiptId:async()=>id('e')};
  const tx=new QualifiedProviderTransactions420(ai,compute,420n,chain,executor,async()=>aiJob);
  return {work,executor,tx,calls};
}
test('provider can accept MATCHED job only through qualified external executor',async()=>{
 const {tx,calls}=fixture();assert.equal(await tx.acceptComputeJob(job),id('f'));assert.deepEqual(calls,['accept']);
});
test('canonical state and provider identity are rechecked before every transition',async()=>{
 const f=fixture('ACCEPTED');await assert.rejects(f.tx.acceptComputeJob(job),/expected canonical Compute state MATCHED/);assert.deepEqual(f.calls,[]);
 const g=fixture();g.work.provider.state='SUSPENDED';await assert.rejects(g.tx.acceptComputeJob(job),/not operational/);assert.deepEqual(g.calls,[]);
});
test('rejects unconfirmed transactions and wrong-chain external service',async()=>{
 const f=fixture();f.executor.sendAndConfirm=async(input)=>({txHash:id('f'),confirmed:false,success:true,chainId:420n,target:input.target});await assert.rejects(f.tx.acceptComputeJob(job),/not canonically confirmed/);
 assert.throws(()=>new QualifiedProviderTransactions420(ai,compute,421n,f.tx.state,f.executor,async()=>aiJob),/chain mismatch/);
});
test('first final receipt requires matching canonical committed manifest and empty receipt head',async()=>{
 const f=fixture('RESULT_COMMITTED');assert.equal(await f.tx.submitFinalReceipt({jobId:job,cumulativeUnits:4n,cumulativeCharge420:42n,executionManifestHash:manifest,evidenceRef:zero}),id('f'));assert.deepEqual(f.calls,['submitReceipt']);
 const g=fixture('RESULT_COMMITTED');g.executor.receiptHead=async()=>({sequence:1n,receiptId:id('e'),units:4n,charge420:42n});await assert.rejects(g.tx.submitFinalReceipt({jobId:job,cumulativeUnits:4n,cumulativeCharge420:42n,executionManifestHash:manifest,evidenceRef:zero}),/already submitted/);assert.deepEqual(g.calls,[]);
});
test('receipt fails closed on overcharge or conflicting manifest',async()=>{
 const f=fixture('RESULT_COMMITTED');await assert.rejects(f.tx.submitFinalReceipt({jobId:job,cumulativeUnits:2n,cumulativeCharge420:81n,executionManifestHash:manifest,evidenceRef:zero}),/funding limits/);
 await assert.rejects(f.tx.submitFinalReceipt({jobId:job,cumulativeUnits:2n,cumulativeCharge420:42n,executionManifestHash:id('a'),evidenceRef:zero}),/manifest mismatch/);
 assert.deepEqual(f.calls,[]);
});
