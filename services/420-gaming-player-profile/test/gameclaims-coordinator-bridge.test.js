import test from 'node:test';
import assert from 'node:assert/strict';
import {createR054MigrationCoordinator420,submitR054LeasedReceipt420} from '../src/gameclaims-coordinator-bridge.js';
const h=c=>'0x'+c.repeat(64), w=c=>'0x'+c.repeat(40);
const key={accountId:'alpha',gameId:h('1'),migrationId:'m-one',claimId:'77'};
const source={...key,chainId:'420',registry:w('2'),sourceCommitment:h('3'),
  guestStateCommitment:h('3'),sourceRevision:'1',payloadHash:h('4'),rulesetId:h('5'),
  policyHash:h('6'),targetWallet:w('7'),targetGrower:'9',evidenceDigest:h('8'),
  save:{schemaLabel:'highcountry-state-v1',stateHash:h('9'),
    providerId:'verified',objectRef:'backup',byteLength:'128'},saveConsentId:'consent'};
const observed={ready:true,canonicalFinality:'UNVERIFIED',gameId:key.gameId,
  targetWallet:source.targetWallet,payloadHash:source.payloadHash,growerId:source.targetGrower};
const evidence={accepted:true,blockHash:h('a'),evidenceDigest:h('b'),
 chainId:source.chainId,registry:source.registry,claimId:key.claimId,
 targetWallet:source.targetWallet,payloadHash:source.payloadHash,growerId:source.targetGrower};
test('R05.4 bridge rejects untrusted finality before opening a DB connection',async()=>{
 let poolUsed=0;
 const pool={connect:async()=>{poolUsed++;throw Error('should not connect');}};
 const claims={verifyConsumedBound:async()=>observed,receiptState:async()=>({status:'NOT_APPLIED'})};
 const opts={operatorPool:pool,claims,sourceForMigration:async()=>source};
 const coordinator=createR054MigrationCoordinator420({...opts,
  canonicalFinality:async()=>({...evidence,accepted:false}),
  receiptFinality:async()=>{throw Error('unexpected');}});
 await assert.rejects(()=>coordinator.apply(key),/migration-binding-unavailable/);
 assert.equal(poolUsed,0);
 for(const mutation of [{gameId:h('f')},{targetWallet:w('e')},{payloadHash:h('d')}]){
  const target=createR054MigrationCoordinator420({...opts,
   sourceForMigration:async()=>({...source,...mutation}),
   canonicalFinality:async()=>evidence,
   receiptFinality:async()=>{throw Error('unexpected');}});
  await assert.rejects(()=>target.apply(key),/migration-binding-unavailable/);
 }
 assert.equal(poolUsed,0);
});
test('R05.4 bridge requires separate canonical and receipt proof authorities',()=>{
 const pool={connect:async()=>{}};
 const claims={verifyConsumedBound:async()=>observed,receiptState:async()=>({status:'NOT_APPLIED'})};
 assert.throws(()=>createR054MigrationCoordinator420({operatorPool:pool,claims,
  sourceForMigration:async()=>source}),/r054-bridge-configuration/);
});

test('R05.4 operator worker submits only an exact leased source and never claims finality',async()=>{
 const lease={account_id:key.accountId,game_id:key.gameId,migration_id:key.migrationId,
  claim_id:key.claimId,chain_id:source.chainId,registry:source.registry,
  source_commitment:source.sourceCommitment,payload_hash:source.payloadHash,
  target_wallet:source.targetWallet,target_grower:source.targetGrower,
  evidence_digest:source.evidenceDigest,lease_token:'unique-lease'};
 let called=0;
 const claims={operatorReceiptRequest:async args=>{
  called++;assert.deepEqual(args,{claimId:key.claimId,growerId:source.targetGrower,
   guestStateCommitment:source.guestStateCommitment,payloadHash:source.payloadHash});
  return {status:'SUBMITTED_UNFINALIZED',tx:h('c')};
 }};
 const result=await submitR054LeasedReceipt420({lease,claims,sourceForMigration:async()=>source});
 assert.equal(result.finalized,false);
 assert.equal(result.leaseToken,'unique-lease');
 assert.equal(called,1);
 await assert.rejects(()=>submitR054LeasedReceipt420({lease,claims,
  sourceForMigration:async()=>({...source,targetWallet:w('8')})}),/r054-receipt-source-mismatch/);
 assert.equal(called,1);
 await assert.rejects(()=>submitR054LeasedReceipt420({lease:{...lease,lease_token:null},claims,
  sourceForMigration:async()=>source}),/r054-receipt-lease-invalid/);
 assert.equal(called,1);
});
