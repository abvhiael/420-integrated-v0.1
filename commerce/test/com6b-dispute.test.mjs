import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,checkout,seller,buyer,attacker,b32} from './fixtures.mjs';
import {MARKET_ARBITRATION_DOMAIN,MARKET_ORIGIN_COMPONENT} from '../src/arbitration.mjs';

test('COM-6B seller dispute intent is durable, idempotent, canonical and not a fabricated Arbitration case',async t=>{
 const f=setup();t.after(()=>f.close());
 const {store,attempt,order}=await checkout(f);order.status='2';f.orders.set(attempt.orderId,order);
 const request={disputeHash:b32(702)};
 const first=await f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute',request);
 assert.equal(first.executed,false);assert.equal(first.disputed,false);
 assert.equal(first.proposal.intent.method,'disputeOrder');
 assert.deepEqual(first.proposal.intent.args,[attempt.orderId,b32(702)]);
 assert.equal(first.proposal.arbitrationCaseOpened,false);
 const again=await f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute',request);
 assert.equal(again.proposal.requestId,first.proposal.requestId);
 assert.equal(f.db.get('SELECT COUNT(*) AS n FROM dispute_requests').n,1);
 const pending=await f.service.merchantDisputes(seller.address,store.store_id);
 assert.equal(pending.items[0].marketDisputed,false);
 assert.equal(pending.items[0].arbitrationCaseOpened,false);
 order.status='6';order.disputeHash=b32(702);
 const confirmed=await f.service.merchantDisputes(seller.address,store.store_id);
 assert.equal(confirmed.items[0].marketDisputed,true);
 assert.equal(confirmed.items[0].state,'MARKET_DISPUTE_FINALIZED');
 assert.equal(confirmed.items[0].remedyExecuted,false);
 await assert.rejects(()=>f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute',request),e=>e.code==='dispute_not_eligible');
});
test('COM-6B rejects cross-store, buyer, other wallet, forged evidence and conflicting requests',async t=>{
 const f=setup();t.after(()=>f.close());const {store,attempt,order}=await checkout(f);order.status='3';f.orders.set(attempt.orderId,order);
 await assert.rejects(()=>f.service.merchantRemedy(buyer.address,store.store_id,attempt.attemptId,'dispute',{disputeHash:b32(8)}),e=>e.code==='forbidden');
 await assert.rejects(()=>f.service.merchantRemedy(attacker.address,store.store_id,attempt.attemptId,'dispute',{disputeHash:b32(8)}),e=>e.code==='forbidden');
 for(const invalid of [{},{disputeHash:b32(0)},{disputeHash:b32(8),admin:true}])await assert.rejects(()=>f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute',invalid));
 await f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute',{disputeHash:b32(8)});
 await assert.rejects(()=>f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute',{disputeHash:b32(9)}),e=>e.code==='dispute_conflict');
 order.status='6';order.disputeHash=b32(9);
 await assert.rejects(()=>f.service.merchantDisputes(seller.address,store.store_id),e=>e.code==='dispute_commitment_mismatch');
 await assert.rejects(()=>f.service.merchantDisputes(attacker.address,store.store_id),e=>e.code==='forbidden');
});
test('COM-6B refuses expired market eligibility and noncanonical seller',async t=>{
 const f=setup();t.after(()=>f.close());const {store,attempt,order}=await checkout(f);f.orders.set(attempt.orderId,order);
 for(const state of ['1','4','5','6','7']){order.status=state;await assert.rejects(()=>f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute',{disputeHash:b32(5)}),e=>e.code==='dispute_not_eligible');}
 order.status='2';order.seller=attacker.address.toLowerCase();
 await assert.rejects(()=>f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute',{disputeHash:b32(5)}),e=>e.code==='dispute_party_mismatch');
});

function qualifiedArbitration(f,orderId,claimHash,remedyHash){
 const resolver=attacker.address.toLowerCase(),record={
  exists:true,claimant:seller.address.toLowerCase(),respondent:buyer.address.toLowerCase(),
  domainId:MARKET_ARBITRATION_DOMAIN,originComponentId:MARKET_ORIGIN_COMPONENT,originObjectId:orderId,
  claimHash,requestedRemedyHash:remedyHash,resolver,appealResolver:resolver,
  evidenceDeadline:String(Math.floor(f.now()/1000)+200),appealDeadline:'0',maxAppeals:'1',round:'0',state:'1'
 };
 f.source.blockTimestamp=Math.floor(f.now()/1000);
 f.source.arbitration={
  domainId:MARKET_ARBITRATION_DOMAIN,componentId:MARKET_ORIGIN_COMPONENT,
  policy:async()=>({exists:true,active:true,resolver,appealResolver:resolver,evidenceWindow:'200',appealWindow:'100',maxAppeals:'1'}),
  getCase:async()=>record,
  getRuling:async()=>({exists:true,outcomeCode:'1',resolver,rulingHash:b32(707),remedyCommitment:b32(708)}),
  intent:(method,args)=>({method,args,chainId:'420',contract:'ArbitrationCaseRegistry420',target:'0x'+'2a'.padStart(40,'0'),requiresWalletAuthorization:true,canonicalAuthority:false})
 };
 return record;
}
test('COM-6B independently verifies authorized Arbitration case, appeal status and final ruling without executing remedies',async t=>{
 const f=setup();t.after(()=>f.close());const {store,attempt,order}=await checkout(f);
 order.status='2';f.orders.set(attempt.orderId,order);
 await f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute',{disputeHash:b32(701)});
 order.status='6';order.disputeHash=b32(701);
 const remedy=b32(702),caseId=b32(703),record=qualifiedArbitration(f,attempt.orderId,b32(701),remedy);
 const plan=await f.service.merchantArbitrationPrepare(seller.address,store.store_id,attempt.attemptId,{remedyHash:remedy});
 assert.equal(plan.intent.method,'openCase');assert.equal(plan.caseOpened,false);
 assert.deepEqual(plan.intent.args,[MARKET_ARBITRATION_DOMAIN,buyer.address.toLowerCase(),MARKET_ORIGIN_COMPONENT,attempt.orderId,b32(701),remedy]);
 const duplicate=await f.service.merchantArbitrationPrepare(seller.address,store.store_id,attempt.attemptId,{remedyHash:remedy});
 assert.deepEqual(duplicate.intent.args,plan.intent.args);
 await assert.rejects(()=>f.service.merchantArbitrationPrepare(seller.address,store.store_id,attempt.attemptId,{remedyHash:b32(704)}),e=>e.code==='arbitration_remedy_conflict');
 assert.equal(f.db.get('SELECT arbitration_case_id FROM dispute_requests').arbitration_case_id,null);
 const bound=await f.service.merchantArbitrationBind(seller.address,store.store_id,attempt.attemptId,{caseId});
 assert.equal(bound.arbitrationCaseOpened,true);assert.equal(bound.finalized,true);
 await f.service.merchantArbitrationBind(seller.address,store.store_id,attempt.attemptId,{caseId});
 const snapshot=await f.service.merchantDisputes(seller.address,store.store_id);
 assert.equal(snapshot.items[0].arbitrationCase.caseState,'OPEN');
 assert.equal(snapshot.items[0].remedyExecuted,false);
 const evidence=await f.service.merchantArbitrationAction(seller.address,store.store_id,attempt.attemptId,'submitEvidence',{evidenceHash:b32(705)});
 assert.deepEqual(evidence.intent.args,[caseId,b32(705)]);
 record.state='2';record.appealDeadline=String(f.source.blockTimestamp+100);
 const appeal=await f.service.merchantArbitrationAction(seller.address,store.store_id,attempt.attemptId,'appeal',{});
 assert.equal(appeal.intent.method,'appeal');assert.equal(appeal.executed,false);
 const ruled=await f.service.merchantDisputes(seller.address,store.store_id);
 assert.equal(ruled.items[0].arbitrationRulingFinalized,false);
 assert.equal(ruled.items[0].arbitrationCase.ruling.finalized,false);
 record.state='3';
 const finalized=await f.service.merchantDisputes(seller.address,store.store_id);
 assert.equal(finalized.items[0].arbitrationRulingFinalized,true);
 assert.equal(finalized.items[0].state,'ARBITRATION_FINALIZED_REMEDY_NOT_EXECUTED');
 assert.equal(finalized.items[0].remedyExecuted,false);
 await assert.rejects(()=>f.service.merchantArbitrationAction(seller.address,store.store_id,attempt.attemptId,'appeal',{}),e=>e.code==='arbitration_appeal_closed');
});
test('COM-6B fail closed on absent service, forged Arbitration identity, unauthorized caller and invalid ruling',async t=>{
 const f=setup();t.after(()=>f.close());const {store,attempt,order}=await checkout(f);
 order.status='2';f.orders.set(attempt.orderId,order);
 await f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute',{disputeHash:b32(701)});
 order.status='6';order.disputeHash=b32(701);
 await assert.rejects(()=>f.service.merchantArbitrationPrepare(seller.address,store.store_id,attempt.attemptId,{remedyHash:b32(702)}),e=>e.code==='arbitration_unavailable');
 const record=qualifiedArbitration(f,attempt.orderId,b32(701),b32(702));
 await assert.rejects(()=>f.service.merchantArbitrationPrepare(attacker.address,store.store_id,attempt.attemptId,{remedyHash:b32(702)}),e=>e.code==='forbidden');
 await f.service.merchantArbitrationPrepare(seller.address,store.store_id,attempt.attemptId,{remedyHash:b32(702)});
 record.respondent=attacker.address.toLowerCase();
 await assert.rejects(()=>f.service.merchantArbitrationBind(seller.address,store.store_id,attempt.attemptId,{caseId:b32(703)}),e=>e.code==='arbitration_case_mismatch');
 record.respondent=buyer.address.toLowerCase();
 await f.service.merchantArbitrationBind(seller.address,store.store_id,attempt.attemptId,{caseId:b32(703)});
 await assert.rejects(()=>f.service.merchantArbitrationBind(seller.address,store.store_id,attempt.attemptId,{caseId:b32(704)}),e=>e.code==='arbitration_case_conflict');
 record.state='3';
 f.source.arbitration.getRuling=async()=>({exists:true,outcomeCode:'1',resolver:buyer.address.toLowerCase(),rulingHash:b32(707),remedyCommitment:b32(708)});
 await assert.rejects(()=>f.service.merchantDisputes(seller.address,store.store_id),e=>e.code==='arbitration_ruling_invalid');
 f.source.arbitration=null;
 await assert.rejects(()=>f.service.merchantDisputes(seller.address,store.store_id),e=>e.code==='arbitration_binding_unavailable');
});
