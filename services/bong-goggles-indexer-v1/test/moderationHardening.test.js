import test from 'node:test';
import assert from 'node:assert/strict';
import { BongGogglesModerationOperationsProjection } from '../src/moderationOperations.js';
import { projectOperatorCapabilities } from '../src/moderationPolicyAudit.js';
import {
  moderationIntentFingerprint,
  assertPreparedIntentFresh,
  ModerationIntentGuard,
  detectCanonicalLocalDivergence,
  verifyModerationRestart,
  buildBoundedOperatorQueues,
} from '../src/moderationHardening.js';

function log(eventName,args,n=1,logIndex=0){
  return {eventName,args,chainId:420,blockNumber:n,blockHash:`0xblock${n}`,transactionHash:`0xtx${n}`,transactionIndex:0,logIndex};
}
function projection(){
  const p=new BongGogglesModerationOperationsProjection();
  p.apply(log('ReportSubmitted',{reportId:'r1',reporter:'0xr',subjectAccount:'0xs',targetType:'POST',targetId:'p1',reasonCode:'spam'},1));
  p.apply(log('CaseOpened',{caseId:'c1',reportId:'r1',operator:'0xo',policyVersion:'v1'},2));
  return p;
}
function intent(){
  return {
    contract:'BongGogglesSafetyRegistry420',method:'revokeAction',args:['a1'],
    capability:{actionId:'ACTION_SAFETY_ACTION_REVOKE',scope:'scope-1',authorized:true},
    walletConfirmationRequired:true,signed:false,broadcast:false,authoritative:false,
  };
}

test('duplicate intents are deterministically fingerprinted and suppressed', () => {
  const p=projection();
  const guard=new ModerationIntentGuard();
  const first=guard.reserve({intent:intent(),operator:'0xA',resourceKey:'case:c1',expectedCheckpoint:p.snapshot().checkpoint});
  assert.equal(first.fingerprint,moderationIntentFingerprint(intent(),p.snapshot().checkpoint));
  assert.throws(()=>guard.reserve({intent:intent(),operator:'0xA',resourceKey:'case:c1',expectedCheckpoint:p.snapshot().checkpoint}),/duplicate moderation intent/);
  assert.equal(guard.release(first),true);
});

test('concurrent operators cannot reserve conflicting writes for the same resource', () => {
  const p=projection();
  const guard=new ModerationIntentGuard();
  guard.reserve({intent:intent(),operator:'0xA',resourceKey:'case:c1',expectedCheckpoint:p.snapshot().checkpoint});
  const second={...intent(),method:'applyAction',args:['c1','RESTRICT_INTERACTION','0xhash',2000]};
  assert.throws(()=>guard.reserve({intent:second,operator:'0xB',resourceKey:'case:c1',expectedCheckpoint:p.snapshot().checkpoint}),/concurrent moderation conflict/);
});

test('prepared intent fails closed on stale checkpoint', () => {
  const p=projection();
  const prepared=p.snapshot().checkpoint;
  p.apply(log('SafetyActionApplied',{actionId:'a1',caseId:'c1',actionType:'RESTRICT_INTERACTION',operator:'0xo',expiresAt:2000},3));
  const caps=projectOperatorCapabilities({now:1000,requirements:[{actionId:'ACTION_SAFETY_ACTION_REVOKE',scope:'scope-1'}],grants:[{actionId:'ACTION_SAFETY_ACTION_REVOKE',scope:'scope-1',expiresAt:2000}]});
  assert.throws(()=>assertPreparedIntentFresh({intent:intent(),preparedCheckpoint:prepared,currentCheckpoint:p.snapshot().checkpoint,capabilityProjection:caps}),/stale moderation intent checkpoint/);
});

test('capability changes invalidate previously prepared local authorization immediately', () => {
  const p=projection();
  const checkpoint=p.snapshot().checkpoint;
  const revoked=projectOperatorCapabilities({now:1000,requirements:[{actionId:'ACTION_SAFETY_ACTION_REVOKE',scope:'scope-1'}],grants:[{actionId:'ACTION_SAFETY_ACTION_REVOKE',scope:'scope-1',revoked:true}]});
  assert.throws(()=>assertPreparedIntentFresh({intent:intent(),preparedCheckpoint:checkpoint,currentCheckpoint:checkpoint,capabilityProjection:revoked}),/REVOKED_CAPABILITY/);
});

test('canonical/local state divergence is detected without mutating projection', () => {
  const p=projection();
  const before=p.snapshot();
  const result=detectCanonicalLocalDivergence(before,{cases:[{caseId:'c1',state:'CLOSED'}]});
  assert.equal(result.converged,false);
  assert.deepEqual(result.divergences[0],{
    collection:'cases',id:'c1',field:'state',local:'OPEN',canonical:'CLOSED',authoritative:false,
  });
  assert.deepEqual(p.snapshot(),before);
});

test('snapshot restart verification is deterministic', () => {
  const p=projection();
  const result=verifyModerationRestart(p.snapshot());
  assert.equal(result.verified,true);
  assert.deepEqual(result.snapshot,p.snapshot());
});

test('operator queues are bounded and expose truncation without losing totals', () => {
  const p=new BongGogglesModerationOperationsProjection();
  for(let i=0;i<5;i++) p.apply(log('ReportSubmitted',{reportId:`r${i}`,reporter:'0xr',subjectAccount:'0xs',targetType:'POST',targetId:`p${i}`,reasonCode:'spam'},i+1));
  const bounded=buildBoundedOperatorQueues(p.operatorQueues(),{limit:2,maxLimit:3});
  assert.equal(bounded.untriagedReports.length,2);
  assert.equal(bounded.totals.untriagedReports,5);
  assert.equal(bounded.truncated.untriagedReports,true);
  assert.throws(()=>buildBoundedOperatorQueues(p.operatorQueues(),{limit:4,maxLimit:3}),/exceeds configured maximum/);
});
