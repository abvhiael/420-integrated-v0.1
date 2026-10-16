import test from 'node:test';
import assert from 'node:assert/strict';
import {createR057MigrationFinalityHooks420} from '../src/r057-migration-finality-hooks.js';
const H=x=>'0x'+x.repeat(64),W=x=>'0x'+x.repeat(40);
const payload=H('a'),guest=H('b'),sourceCommit=H('c'),receiptTx=H('d');
const chainId='420',registry=W('e'),wallet=W('f'),gameId=H('1');
const source={accountId:'alice',gameId,migrationId:'mig1',claimId:'42',chainId,registry,
 targetWallet:wallet,targetGrower:'7',payloadHash:payload,
 guestStateCommitment:guest,sourceCommitment:sourceCommit};
const key={accountId:'alice',gameId,migrationId:'mig1',claimId:'42'};
let verified=true,receipted=true;
const canonical={migrationBinding:async args=>({accepted:verified,chainId,
 claimId:'0x'+BigInt(42).toString(16).padStart(64,'0'),targetWallet:wallet,
 growerId:'7',payloadHash:payload,blockHash:H('2'),evidenceDigest:H('3')}),
 migrationTransaction:async args=>({accepted:receipted,state:'FINALIZED',txHash:receiptTx,blockHash:H('4'),receiptDigest:H('5')})};
const create=()=>createR057MigrationFinalityHooks420({canonical,chainId,registry,
 sourceForMigration:async()=>source});
test('R05.7 R05.4 coordinator hook accepts only separately pinned proof and immutable intent',async()=>{
 verified=true;
 const x=await create().canonicalFinality({key,source,observed:{
  targetWallet:wallet,payloadHash:payload,growerId:'7',canonicalFinality:'UNVERIFIED'}});
 assert.equal(x.accepted,true);assert.equal(x.registry,registry);
 verified=false;
 await assert.rejects(()=>create().canonicalFinality({key,source,observed:{
  targetWallet:wallet,payloadHash:payload,growerId:'7',canonicalFinality:'UNVERIFIED'}}),
 /r057-hook-proof-invalid/);
 verified=true;
 await assert.rejects(()=>create().canonicalFinality({key,source,observed:{
  targetWallet:wallet,payloadHash:payload,growerId:'7',canonicalFinality:'FINALIZED'}}),
 /r057-hook-source-mismatch/);
});
test('R05.7 migration receipt cannot become finalized from adapter state alone',async()=>{
 const x=create(),expected={claim_id:'42',target_grower:'7',payload_hash:payload,
  source_commitment:sourceCommit,target_wallet:wallet,receipt_tx:null};
 assert.deepEqual(await x.receiptFinality({accountId:'alice',gameId,migrationId:'mig1',
  expected,observed:{status:'APPLIED_UNFINALIZED'}}),{state:'RETRY'});
 const y=await x.receiptFinality({accountId:'alice',gameId,migrationId:'mig1',
  expected:{...expected,receipt_tx:receiptTx},observed:{status:'APPLIED_UNFINALIZED'}});
 assert.equal(y.state,'FINALIZED');assert.equal(y.txHash,receiptTx);
 receipted=false;
 await assert.rejects(()=>x.receiptFinality({accountId:'alice',gameId,migrationId:'mig1',
  expected:{...expected,receipt_tx:receiptTx},observed:{status:'APPLIED_UNFINALIZED'}}),
 /r057-receipt-unverified/);
 receipted=true;
});
