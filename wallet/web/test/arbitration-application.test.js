import assert from 'node:assert/strict';
import test from 'node:test';
import {createArbitrationApplication420,ARBITRATION_EVENTS_420} from '../core/arbitration-application.js';
import {arbitrationAppFixture420,ADDR,CASE_ID,DOMAIN,ORIGIN,h} from './arbitration-app-fixture.js';

const openFields={domainId:DOMAIN,respondent:ADDR.respondent,originComponentId:ORIGIN,
  originObjectId:h(500),claimHash:h(501),requestedRemedyHash:h(502)};

test('read canonical domain and dashboard without fabricating cases',async()=>{
  const f=arbitrationAppFixture420();
  const app=createArbitrationApplication420(f);
  const p=await app.policies();
  assert.equal(p.domains.length,1);
  assert.equal(p.domains[0].name,'Test Market');
  const page=await app.dashboard();
  assert.equal(page.cases.length,1);
  assert.equal(page.cases[0].id,CASE_ID);
  assert.equal(page.cases[0].role,'Claimant');
  assert.equal(page.cases[0].permissions.evidence,true);
  assert.equal(page.nextBefore,null);
  assert.equal(f.state.calls.some(x=>x[0]==='eth_sendTransaction'),false);
  app.dispose();
});

test('case details show entire policy snapshot, live round, role and canonical evidence history',async()=>{
  const f=arbitrationAppFixture420();f.addEvidence();
  const app=createArbitrationApplication420(f);
  const detail=await app.detail(CASE_ID);
  assert.equal(detail.claimant,ADDR.claimant);
  assert.equal(detail.respondent,ADDR.respondent);
  assert.equal(detail.domainId,DOMAIN);
  assert.equal(detail.originComponentId,ORIGIN);
  assert.equal(detail.maxAppeals,3);
  assert.equal(detail.permissions.appeal,false);
  assert.equal(detail.history.length,2);
  assert.equal(detail.history[0].kind,'opened');
  assert.equal(detail.history[1].kind,'evidence');
  assert.equal(detail.history[1].details.evidenceHash,h(950));
  app.dispose();
});

test('new case requires exact domain and commitments, independent simulation and gas review',async()=>{
  const f=arbitrationAppFixture420();
  const app=createArbitrationApplication420(f);
  const q=await app.review('openCase',openFields);
  assert.equal(q.summary.action,'openCase');
  assert.equal(q.summary.to,ADDR.cases);
  assert.equal(q.summary.gas,'21000');
  assert.equal(q.summary.estimatedGasCostWei,'2100000');
  assert.equal(q.summary.protocolFeeWei,'0');
  assert.equal(q.summary.requiresExplicitConfirmation,true);
  await assert.rejects(app.review('openCase',{...openFields,domainId:h(400)}),/not configured/);
  await assert.rejects(app.review('openCase',{...openFields,claimHash:h(0)}),/invalid claim commitment/);
  await assert.rejects(app.review('openCase',{...openFields,respondent:ADDR.claimant}),/must differ/);
  app.dispose();
});

test('only case parties can commit evidence, and evidence window closure fails closed',async()=>{
  const f=arbitrationAppFixture420(ADDR.claimant);
  const app=createArbitrationApplication420(f);
  const q=await app.review('submitEvidence',{caseId:CASE_ID,evidenceHash:h(451)});
  assert.equal(q.summary.to,ADDR.cases);
  assert.equal(q.summary.caseId,CASE_ID);
  f.state.now=201;
  await assert.rejects(app.review('submitEvidence',{caseId:CASE_ID,evidenceHash:h(451)}),/evidence unavailable/);
  app.dispose();
  const outsider=arbitrationAppFixture420(ADDR.resolver);
  const other=createArbitrationApplication420(outsider);
  await assert.rejects(other.review('submitEvidence',{caseId:CASE_ID,evidenceHash:h(451)}),/evidence unavailable/);
  other.dispose();
});

test('resolver workspace and ruling submit are gated by exact round resolver identity',async()=>{
  const f=arbitrationAppFixture420(ADDR.resolver);
  const app=createArbitrationApplication420(f);
  const page=await app.dashboard();
  assert.equal(page.cases.length,1);
  assert.equal(page.cases[0].permissions.rule,true);
  const q=await app.review('submitRuling',{caseId:CASE_ID,outcomeCode:1,
    rulingHash:h(720),remedyCommitment:h(721),panelCommitment:h(0)});
  assert.equal(q.summary.to,ADDR.rulings);
  f.state.record.round=1;
  await assert.rejects(app.review('submitRuling',{caseId:CASE_ID,outcomeCode:2,
    rulingHash:h(722),remedyCommitment:h(723)}),/resolver unauthorized/);
  app.dispose();
  const claimant=arbitrationAppFixture420();
  const denied=createArbitrationApplication420(claimant);
  await assert.rejects(denied.review('submitRuling',{caseId:CASE_ID,outcomeCode:1,
    rulingHash:h(720),remedyCommitment:h(721)}),/resolver unauthorized/);
  denied.dispose();
});

test('appeal is party only, deadline-inclusive and capped; finalization only after window',async()=>{
  const f=arbitrationAppFixture420();
  f.state.record.state='RULED';
  f.state.record.appealDeadline=150;
  const app=createArbitrationApplication420(f);
  const data=await app.detail(CASE_ID);
  assert.equal(data.permissions.appeal,true);
  assert.equal(data.permissions.finalize,false);
  const q=await app.review('appeal',{caseId:CASE_ID});
  assert.equal(q.summary.to,ADDR.cases);
  f.state.now=151;
  await assert.rejects(app.review('appeal',{caseId:CASE_ID}),/appeal unavailable/);
  const finalize=await app.review('finalizeRuling',{caseId:CASE_ID});
  assert.equal(finalize.summary.to,ADDR.rulings);
  f.state.record.round=3;
  f.state.now=150;
  await assert.rejects(app.review('appeal',{caseId:CASE_ID}),/appeal unavailable/);
  app.dispose();
});

test('every transaction requires explicit confirmation and device request; no early success',async()=>{
  const f=arbitrationAppFixture420(),app=createArbitrationApplication420(f);
  const q=await app.review('openCase',openFields);
  await assert.rejects(app.submit(q,async()=>false),/confirmation rejected/);
  assert.equal(f.state.sendCount,0);
  await assert.rejects(app.submit(q,async()=>true),/expired or forged/);
  const next=await app.review('openCase',openFields);
  const sub=await app.submit(next,async()=>true);
  assert.equal(f.state.sendCount,1);
  assert.equal(sub.status,'pending');
  const pending=await app.status(sub);
  assert.equal(pending.state,'pending');
  f.submitReceipt();
  const confirmed=await app.status(sub);
  assert.equal(confirmed.state,'confirmed');
  assert.equal(confirmed.canonical,true);
  app.dispose();
});

test('Wallet rejection, gas quote drift and session switching cannot submit',async()=>{
  const f=arbitrationAppFixture420(),app=createArbitrationApplication420(f);
  let q=await app.review('openCase',openFields);
  f.state.override=(method)=>method==='eth_gasPrice'?'0xc8':undefined;
  await assert.rejects(app.submit(q,async()=>true),/transaction changed/);
  assert.equal(f.state.sendCount,0);
  f.state.override=null;
  q=await app.review('openCase',openFields);
  f.changeAccount(ADDR.respondent);
  await assert.rejects(app.submit(q,async()=>true),/invalidated|session|account/);
  assert.equal(f.state.sendCount,0);
  app.dispose();
});

test('case permissions changing during device approval fail closed before broadcast',async()=>{
  const f=arbitrationAppFixture420(),app=createArbitrationApplication420(f);
  const q=await app.review('submitEvidence',{caseId:CASE_ID,evidenceHash:h(565)});
  await assert.rejects(app.submit(q,async()=>{
    f.state.record.state='FINALIZED';return true;
  }),/evidence unavailable|target or permissions changed/);
  assert.equal(f.state.sendCount,0);
  app.dispose();
});

test('invalid outcomes and expired ruling states reject; unsupported action cannot be prepared',async()=>{
  const f=arbitrationAppFixture420(ADDR.resolver),app=createArbitrationApplication420(f);
  await assert.rejects(app.review('submitRuling',{caseId:CASE_ID,outcomeCode:0,
    rulingHash:h(100),remedyCommitment:h(101)}),/outcome/);
  await assert.rejects(app.review('__proto__',{caseId:CASE_ID}),/unsupported/);
  await assert.rejects(app.review('seizeFunds',{caseId:CASE_ID}),/unsupported/);
  app.dispose();
});

test('restored pending intent must be an actual canonical account-to-contract transaction',async()=>{
  const f=arbitrationAppFixture420(),app=createArbitrationApplication420(f);
  const q=await app.review('openCase',openFields);
  const result=await app.submit(q,async()=>true);
  const metadata={txHash:result.txHash,to:result.to,from:result.from,chainId:result.chainId};
  const recovered=await app.restore(metadata);
  assert.equal(recovered.txHash,result.txHash);
  await assert.rejects(app.restore({...metadata,to:ADDR.rulings}),/identity mismatch/);
  await assert.rejects(app.restore({...metadata,chainId:1}),/another Wallet or network/);
  await assert.rejects(app.restore({...metadata,from:ADDR.respondent}),/another Wallet or network/);
  app.dispose();
});

test('rulings and finalized state are derived from on-chain state, not success of a sent transaction',async()=>{
  const f=arbitrationAppFixture420();
  f.state.record.state='RULED';
  f.state.record.appealDeadline=125;
  const app=createArbitrationApplication420(f),data=await app.detail(CASE_ID);
  assert.equal(data.rulings.length,1);
  assert.equal(data.rulings[0].outcomeCode,1n);
  assert.equal(data.permissions.finalize,true);
  f.state.record.state='FINALIZED';
  const finished=await app.detail(CASE_ID);
  assert.equal(finished.state,'FINALIZED');
  assert.equal(finished.permissions.finalize,false);
  app.dispose();
});

test('canonical chain-event mismatch is rejected, no forged history shown',async()=>{
  const f=arbitrationAppFixture420(),app=createArbitrationApplication420(f);
  f.state.logs[0].blockHash=h(700);
  await assert.rejects(app.dashboard(),/not canonical/);
  await assert.rejects(app.detail(CASE_ID),/not canonical/);
  app.dispose();
});

test('event topic IDs match chain event schema and include exact case origin event',()=>{
  assert.equal(Object.keys(ARBITRATION_EVENTS_420).length,7);
  for(const topic of Object.values(ARBITRATION_EVENTS_420))assert.match(topic,/^0x[0-9a-f]{64}$/);
});
