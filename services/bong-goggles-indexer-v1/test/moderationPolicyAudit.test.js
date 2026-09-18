import test from 'node:test';
import assert from 'node:assert/strict';
import { BongGogglesModerationOperationsProjection } from '../src/moderationOperations.js';
import {
  projectOperatorCapabilities,
  buildModerationAuditTimeline,
  buildOperatorAnnotations,
  buildCanonicalWriteLinks,
} from '../src/moderationPolicyAudit.js';

function log(eventName,args,n=1,logIndex=0){
  return {eventName,args,chainId:420,blockNumber:n,blockHash:`0xblock${n}`,transactionHash:`0xtx${n}`,transactionIndex:0,logIndex};
}

test('capability projection exposes allowed, missing, expired and revoked states', () => {
  const projected=projectOperatorCapabilities({
    now:1000,
    requirements:[
      {actionId:'A',scope:'s1'},{actionId:'B',scope:'s2'},{actionId:'C',scope:'s3'},{actionId:'D',scope:'s4'},
    ],
    grants:[
      {actionId:'A',scope:'s1',expiresAt:2000},
      {actionId:'C',scope:'s3',expiresAt:900},
      {actionId:'D',scope:'s4',revoked:true},
    ],
  });
  const byAction=new Map(projected.capabilities.map((item)=>[item.actionId,item]));
  assert.equal(byAction.get('A').authorized,true);
  assert.equal(byAction.get('B').denialReason,'MISSING_CAPABILITY');
  assert.equal(byAction.get('C').denialReason,'EXPIRED_CAPABILITY');
  assert.equal(byAction.get('D').denialReason,'REVOKED_CAPABILITY');
});

test('audit timeline preserves canonical provenance order and remains non-authoritative', () => {
  const p=new BongGogglesModerationOperationsProjection();
  p.apply(log('ReportSubmitted',{reportId:'r1',reporter:'0xr',subjectAccount:'0xs',targetType:'POST',targetId:'p1',reasonCode:'spam'},1));
  p.apply(log('CaseOpened',{caseId:'c1',reportId:'r1',operator:'0xo',policyVersion:'v1'},2));
  p.apply(log('SafetyActionApplied',{actionId:'a1',caseId:'c1',actionType:'RESTRICT_INTERACTION',operator:'0xo',expiresAt:2000},3));
  p.apply(log('SafetyActionRevoked',{actionId:'a1',caseId:'c1',operator:'0xo2'},4));
  const timeline=buildModerationAuditTimeline(p.snapshot());
  assert.deepEqual(timeline.map((item)=>item.provenance.eventName),['ReportSubmitted','CaseOpened','SafetyActionApplied','SafetyActionRevoked']);
  assert.ok(timeline.every((item)=>item.canonicalEvent===true&&item.authoritative===false));
});

test('operator annotations remain local-only and exclude canonical evidence and decisions', () => {
  const annotations=buildOperatorAnnotations({
    caseId:'c1',
    notes:[{text:'follow up with policy team'}],
    labels:['priority-high'],
  });
  assert.equal(annotations.notes[0].localOnly,true);
  assert.equal(annotations.labels[0].localOnly,true);
  assert.equal(annotations.canonicalEvidenceIncluded,false);
  assert.equal(annotations.canonicalDecisionIncluded,false);
});

test('canonical write links point to Wallet confirmation and Explorer canonical record', () => {
  const links=buildCanonicalWriteLinks({
    contract:'BongGogglesSafetyRegistry420',
    method:'resolveAppeal',
    authoritative:false,
  },{
    walletBaseUrl:'https://wallet.420',
    explorerBaseUrl:'https://explorer.420',
    transactionHash:'0xabc',
  });
  assert.match(links.wallet,/confirm\?contract=BongGogglesSafetyRegistry420&method=resolveAppeal/);
  assert.equal(links.explorer,'https://explorer.420/tx/0xabc');
  assert.equal(links.canonicalWrite,true);
});

test('explorer link falls back to contract view before transaction exists', () => {
  const links=buildCanonicalWriteLinks({
    contract:'BongGogglesSafetyRegistry420',
    method:'openCase',
    authoritative:false,
  },{
    walletBaseUrl:'https://wallet.420/',
    explorerBaseUrl:'https://explorer.420/',
  });
  assert.equal(links.explorer,'https://explorer.420/contract/BongGogglesSafetyRegistry420');
  assert.equal(links.transactionHash,null);
});
