import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { BongGogglesModerationOperationsProjection } from '../src/moderationOperations.js';
import { buildAppealCaseWorkspace, prepareAppealResolutionIntent } from '../src/moderationAppealsWorkspace.js';
import { buildBoundedOperatorQueues, verifyModerationRestart } from '../src/moderationHardening.js';

function log(eventName,args,n,logIndex=0){
  return {eventName,args,chainId:420,blockNumber:n,blockHash:`0xblock${n}`,transactionHash:`0xtx${n}`,transactionIndex:0,logIndex};
}

test('BG-17.9 bounded moderation load remains responsive and bounded', () => {
  const p=new BongGogglesModerationOperationsProjection();
  const start=performance.now();
  for(let i=0;i<1000;i++){
    p.apply(log('ReportSubmitted',{
      reportId:`r${String(i).padStart(4,'0')}`,reporter:'0xreporter',subjectAccount:'0xsubject',
      targetType:'POST',targetId:`p${i}`,reasonCode:'spam',
    },i+1));
  }
  const ingestMs=performance.now()-start;
  const queueStart=performance.now();
  const bounded=buildBoundedOperatorQueues(p.operatorQueues(),{limit:100,maxLimit:500});
  const queueMs=performance.now()-queueStart;
  assert.equal(bounded.untriagedReports.length,100);
  assert.equal(bounded.totals.untriagedReports,1000);
  assert.equal(bounded.truncated.untriagedReports,true);
  assert.ok(ingestMs < 5000,`1000-report ingest exceeded closeout budget: ${ingestMs}ms`);
  assert.ok(queueMs < 2000,`bounded queue projection exceeded closeout budget: ${queueMs}ms`);
});

test('BG-17.9 report-to-case-action-appeal-overturn-emergency-hide drill converges canonically', () => {
  const p=new BongGogglesModerationOperationsProjection();
  p.apply(log('ReportSubmitted',{reportId:'r1',reporter:'0xr',subjectAccount:'0xsubject',targetType:'POST',targetId:'p1',reasonCode:'abuse'},1));
  p.apply(log('CaseOpened',{caseId:'c1',reportId:'r1',operator:'0xopener',policyVersion:'policy-v1'},2));
  p.apply(log('SafetyActionApplied',{actionId:'a1',caseId:'c1',actionType:'RESTRICT_INTERACTION',operator:'0xopener',expiresAt:5000},3));
  p.apply(log('AppealFiled',{appealId:'ap1',caseId:'c1',appellant:'0xsubject'},4));
  p.apply(log('AppealResolved',{appealId:'ap1',caseId:'c1',result:'OVERTURNED',operator:'0xresolver'},5));
  p.apply(log('EmergencyHideSet',{targetScope:'scope-1',hiddenUntil:6000,operator:'0xresolver'},6));

  const snap=p.snapshot();
  const safetyCase=new Map(snap.cases).get('c1');
  const action=new Map(snap.actions).get('a1');
  const appeal=new Map(snap.appeals).get('ap1');
  const hide=new Map(snap.emergencyHides).get('scope-1');

  assert.equal(safetyCase.state,'RESOLVED');
  assert.equal(safetyCase.pendingAppealId,null);
  assert.equal(action.state,'REVOKED_BY_APPEAL');
  assert.equal(appeal.state,'OVERTURNED');
  assert.equal(hide.hiddenUntil,6000);
  assert.equal(verifyModerationRestart(snap).verified,true);
});

test('BG-17.9 separation-of-duty regression blocks opener and permits distinct capable resolver', async () => {
  const p=new BongGogglesModerationOperationsProjection();
  p.apply(log('ReportSubmitted',{reportId:'r1',reporter:'0xr',subjectAccount:'0xsubject',targetType:'POST',targetId:'p1',reasonCode:'abuse'},1));
  p.apply(log('CaseOpened',{caseId:'c1',reportId:'r1',operator:'0xOpener',policyVersion:'policy-v1'},2));
  p.apply(log('AppealFiled',{appealId:'ap1',caseId:'c1',appellant:'0xsubject'},3));
  const workspace=buildAppealCaseWorkspace(p.snapshot(),'ap1');

  await assert.rejects(()=>prepareAppealResolutionIntent({
    appealWorkspace:workspace,operator:'0xopener',uphold:true,
    deriveScope:async()=> 'scope-1',isAuthorized:async()=>true,
  }),/case opener cannot resolve appeal/);

  const prepared=await prepareAppealResolutionIntent({
    appealWorkspace:workspace,operator:'0xresolver',uphold:false,
    deriveScope:async()=> 'scope-1',
    isAuthorized:async ({actionId})=>actionId==='ACTION_SAFETY_APPEAL_RESOLVE',
  });
  assert.equal(prepared.method,'resolveAppeal');
  assert.deepEqual(prepared.args,['ap1',false]);
  assert.equal(prepared.walletConfirmationRequired,true);
  assert.equal(prepared.localResultFinal,false);
});

test('BG-17.9 replay/restart remains deterministic after full safety event stream', () => {
  const events=[
    log('ReportSubmitted',{reportId:'r1',reporter:'0xr',subjectAccount:'0xs',targetType:'POST',targetId:'p1',reasonCode:'spam'},1),
    log('CaseOpened',{caseId:'c1',reportId:'r1',operator:'0xo',policyVersion:'v1'},2),
    log('SafetyActionApplied',{actionId:'a1',caseId:'c1',actionType:'RESTRICT_INTERACTION',operator:'0xo',expiresAt:5000},3),
    log('SafetyActionRevoked',{actionId:'a1',caseId:'c1',operator:'0xo2'},4),
    log('CaseClosed',{caseId:'c1',operator:'0xo2'},5),
    log('EmergencyHideSet',{targetScope:'scope-1',hiddenUntil:7000,operator:'0xo2'},6),
  ];
  const a=new BongGogglesModerationOperationsProjection();
  const b=new BongGogglesModerationOperationsProjection();
  for(const event of events){ a.apply(event); b.apply(structuredClone(event)); }
  assert.deepEqual(a.snapshot(),b.snapshot());
  assert.deepEqual(verifyModerationRestart(a.snapshot()).snapshot,a.snapshot());
});
