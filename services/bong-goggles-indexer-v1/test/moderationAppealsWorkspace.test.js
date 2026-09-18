import test from 'node:test';
import assert from 'node:assert/strict';
import { BongGogglesModerationOperationsProjection } from '../src/moderationOperations.js';
import {
  buildModerationAppealsWorkspace,
  buildAppealCaseWorkspace,
  prepareAppealResolutionIntent,
} from '../src/moderationAppealsWorkspace.js';

function log(eventName, args, n = 1) {
  return { eventName, args, chainId: 420, blockNumber: n, blockHash: `0xblock${n}`, transactionHash: `0xtx${n}`, transactionIndex: 0, logIndex: 0 };
}
function projectionWithAppeal() {
  const p = new BongGogglesModerationOperationsProjection();
  p.apply(log('ReportSubmitted',{reportId:'r1',reporter:'0xreporter',subjectAccount:'0xsubject',targetType:'PROFILE',targetId:'p1',reasonCode:'abuse'},1));
  p.apply(log('CaseOpened',{caseId:'c1',reportId:'r1',operator:'0xOpener',policyVersion:'policy-v1'},2));
  p.apply(log('SafetyActionApplied',{actionId:'a1',caseId:'c1',actionType:'TEMP_ACCOUNT_RESTRICTION',operator:'0xmod',expiresAt:2000},3));
  p.apply(log('AppealFiled',{appealId:'ap1',caseId:'c1',appellant:'0xsubject'},4));
  return p;
}

test('pending appeal workspace links case and exposes separation-of-duty eligibility', () => {
  const p=projectionWithAppeal();
  const blocked=buildModerationAppealsWorkspace(p.snapshot(),{operator:'0xopener'});
  assert.equal(blocked.count,1);
  assert.equal(blocked.pendingAppeals[0].caseId,'c1');
  assert.equal(blocked.pendingAppeals[0].operatorEligibleBySeparationOfDuty,false);
  const allowed=buildModerationAppealsWorkspace(p.snapshot(),{operator:'0xother'});
  assert.equal(allowed.pendingAppeals[0].operatorEligibleBySeparationOfDuty,true);
  assert.equal(allowed.authoritative,false);
});

test('appeal workspace fails closed when canonical appeal state disagrees', () => {
  const p=projectionWithAppeal();
  assert.throws(() => buildModerationAppealsWorkspace(p.snapshot(),{
    canonical:{appeals:[{appealId:'ap1',caseId:'c1',state:'UPHELD'}]},
  }), /canonical state mismatch/);
});

test('case opener cannot prepare appeal resolution intent', async () => {
  const p=projectionWithAppeal();
  const workspace=buildAppealCaseWorkspace(p.snapshot(),'ap1');
  await assert.rejects(() => prepareAppealResolutionIntent({
    appealWorkspace:workspace,
    operator:'0xOPENER',
    uphold:true,
    deriveScope:async()=> '0xscope',
    isAuthorized:async()=> true,
  }), /case opener cannot resolve appeal/);
});

test('eligible operator can prepare uphold intent with Wallet and canonical confirmation required', async () => {
  const p=projectionWithAppeal();
  const workspace=buildAppealCaseWorkspace(p.snapshot(),'ap1');
  const intent=await prepareAppealResolutionIntent({
    appealWorkspace:workspace,
    operator:'0xresolver',
    uphold:true,
    deriveScope:async()=> '0xscope',
    isAuthorized:async ({actionId}) => actionId==='ACTION_SAFETY_APPEAL_RESOLVE',
  });
  assert.deepEqual(intent.args,['ap1',true]);
  assert.equal(intent.resolution,'UPHOLD');
  assert.equal(intent.canonicalConfirmationRequired,true);
  assert.equal(intent.localResultFinal,false);
  assert.equal(intent.walletConfirmationRequired,true);
  assert.equal(intent.signed,false);
  assert.equal(intent.broadcast,false);
});

test('overturn preparation remains non-final until canonical AppealResolved is projected', async () => {
  const p=projectionWithAppeal();
  const workspace=buildAppealCaseWorkspace(p.snapshot(),'ap1');
  const intent=await prepareAppealResolutionIntent({
    appealWorkspace:workspace,
    operator:'0xresolver',
    uphold:false,
    deriveScope:async()=> '0xscope',
    isAuthorized:async()=> true,
  });
  assert.equal(intent.resolution,'OVERTURN');
  assert.equal(workspace.appeal.state,'PENDING');
  assert.equal(workspace.caseWorkspace.latestAction.state,'ACTIVE');
  assert.equal(intent.localResultFinal,false);
});

test('overturned canonical appeal updates case/action presentation only after event projection', () => {
  const p=projectionWithAppeal();
  p.apply(log('AppealResolved',{appealId:'ap1',caseId:'c1',result:'OVERTURNED',operator:'0xresolver'},5));
  const snapshot=p.snapshot();
  const appeal=new Map(snapshot.appeals).get('ap1');
  const safetyCase=new Map(snapshot.cases).get('c1');
  const action=new Map(snapshot.actions).get('a1');
  assert.equal(appeal.state,'OVERTURNED');
  assert.equal(safetyCase.state,'RESOLVED');
  assert.equal(action.state,'REVOKED_BY_APPEAL');
});

test('appeal resolution fails closed without capability', async () => {
  const p=projectionWithAppeal();
  const workspace=buildAppealCaseWorkspace(p.snapshot(),'ap1');
  await assert.rejects(() => prepareAppealResolutionIntent({
    appealWorkspace:workspace,
    operator:'0xresolver',
    uphold:true,
    deriveScope:async()=> '0xscope',
    isAuthorized:async()=> false,
  }), /lacks appeal-resolve capability/);
});
