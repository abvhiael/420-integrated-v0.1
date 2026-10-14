import test from 'node:test';
import assert from 'node:assert/strict';
import {HighCountryGameClaimsAdapter420,claimIdToBytes32,R054_CANONICAL_ABI} from '../src/gameclaims-adapter.js';
const h=x=>'0x'+x.repeat(64),a=x=>'0x'+x.repeat(40);
const config={chainId:'420',gameId:h('a'),claims:a('1'),bridge:a('2'),migration:a('3'),operator:a('4')};
const wallet=a('5'),guest=h('b'),payload=h('c'),id=claimIdToBytes32('77');
let claim,read,write,operator;
const create=()=>{
 claim={claimId:id,gameId:config.gameId,targetAccount:wallet,
  guestStateCommitment:guest,migrationPayloadHash:payload,validUntil:'9999999999',
  consumed:false,cancelled:false,exists:true};
 read={chainId:async()=>420,readContract:async ({address,functionName,args})=>{
  if(address===config.migration&&functionName==='guestStateCommitment')return guest;
  if(address===config.migration&&functionName==='migrationPayloadHash')return payload;
  if(address===config.claims&&functionName==='claim')return claim;
  if(address===config.bridge&&functionName==='growerProfileIdOfMigrationClaim')return '12';
  if(address===config.migration&&functionName==='isReadyToApply')return true;
  if(address===config.migration&&functionName==='appliedMigration')return {exists:false};
  throw Error('unexpected read');
 }};
 write=[];
 operator={chainId:async()=>420,account:async()=>config.operator,
  writeContract:async tx=>{write.push(tx);return h('d');}};
 return new HighCountryGameClaimsAdapter420({config,readClient:read,operatorClient:operator});
};
const issue={claimId:'77',targetWallet:wallet,guestAccountCommitment:h('6'),saveRevision:'12',
 stateHash:h('7'),growerId:'12',schemaVersion:'7',payloadBodyHash:h('8'),validUntil:'9999999999'};
test('R05.4 ABI mappings and u64 to canonical bytes32 only',()=>{
 assert.equal(id,'0x'+'0'.repeat(62)+'4d');
 assert.equal(R054_CANONICAL_ABI.claims.issue,'issue(bytes32,bytes32,address,bytes32,bytes32,uint64)');
 assert.throws(()=>claimIdToBytes32('18446744073709551616'),/r054-invalid-claim-id/);
 assert.throws(()=>claimIdToBytes32(h('a')),/r054-invalid-claim-id/);
});
test('issuance always reconciles existing canonical claim instead of replaying',async()=>{
 const sdk=create();const result=await sdk.issue(issue);
 assert.equal(result.alreadyIssued,true);assert.equal(write.length,0);
 claim={...claim,migrationPayloadHash:h('e')};
 await assert.rejects(()=>sdk.issue(issue),/r054-claim-conflict/);
 assert.equal(write.length,0);
});
test('missing claim submits exact canonical ABI arguments using restricted operator',async()=>{
 const sdk=create();
 read.readContract=async ({functionName})=>{
  if(functionName==='guestStateCommitment')return guest;
  if(functionName==='migrationPayloadHash')return payload;
  const e=new Error('missing');e.code='ClaimNotFound';throw e;
 };
 const res=await sdk.issue(issue);
 assert.equal(res.alreadyIssued,false);
 assert.deepEqual(write[0],{address:config.claims,functionName:'issue',
  args:[id,config.gameId,wallet,guest,payload,'9999999999'],account:config.operator});
});
test('wallet consumption and grower binding never use operator wallet',async()=>{
 const sdk=create();const consume=await sdk.targetWalletConsume({claimId:'77',targetWallet:wallet});
 assert.equal(consume.functionName,'consume');assert.equal(consume.requiredSigner,wallet);assert.equal(write.length,0);
 await assert.rejects(()=>sdk.targetWalletConsume({claimId:'77',targetWallet:a('7')}),/r054-consume-unavailable/);
 claim={...claim,consumed:true};
 const binding=await sdk.targetWalletBind({claimId:'77',targetWallet:wallet,growerId:'12',payloadHash:payload});
 assert.equal(binding.functionName,'bindConsumedMigrationClaim');assert.equal(binding.requiredSigner,wallet);
 assert.deepEqual(binding.args,[id,'12',payload]);assert.equal(write.length,0);
 await assert.rejects(()=>sdk.targetWalletBind({claimId:'77',targetWallet:wallet,growerId:'12',payloadHash:h('f')}),/r054-binding-denied/);
});
test('read verifies consumed, bound exact payload and never asserts finality',async()=>{
 const sdk=create();claim={...claim,consumed:true};
 const proof=await sdk.verifyConsumedBound({claimId:'77',targetWallet:wallet,growerId:'12',
  guestStateCommitment:guest,payloadHash:payload});
 assert.equal(proof.canonicalFinality,'UNVERIFIED');
 await assert.rejects(()=>sdk.verifyConsumedBound({claimId:'77',targetWallet:wallet,growerId:'13',
  guestStateCommitment:guest,payloadHash:payload}),/r054-unbound-or-unready/);
});
test('wrong chain and unauthorized operator fail closed',async()=>{
 const sdk=create();read.chainId=async()=>421;
 await assert.rejects(()=>sdk.readClaim('77'),/r054-wrong-chain/);
 read.chainId=async()=>420;operator.account=async()=>a('e');claim=null;
 await assert.rejects(()=>sdk.issue(issue),/r054-not-game-operator/);
});
test('receipt matching and repeat recover from onchain state; mismatches reject',async()=>{
 const sdk=create();const args={claimId:'77',growerId:'12',guestStateCommitment:guest,payloadHash:payload};
 const submitted=await sdk.operatorReceiptRequest(args);
 assert.equal(submitted.status,'SUBMITTED_UNFINALIZED');
 assert.equal(write[0].functionName,'markApplied');
 read.readContract=async ({functionName})=>{
  if(functionName==='appliedMigration')return {exists:true,growerProfileId:'12',
    guestStateCommitment:guest,migrationPayloadHash:payload,appliedAt:'1'};
  throw Error('unexpected');
 };
 assert.equal((await sdk.operatorReceiptRequest(args)).alreadySubmitted,true);
 assert.equal(write.length,1);
 read.readContract=async ({functionName})=>{
  if(functionName==='appliedMigration')return {exists:true,growerProfileId:'22',
    guestStateCommitment:guest,migrationPayloadHash:payload,appliedAt:'1'};
  throw Error('unexpected');
 };
 await assert.rejects(()=>sdk.receiptState(args),/r054-receipt-mismatch/);
});
