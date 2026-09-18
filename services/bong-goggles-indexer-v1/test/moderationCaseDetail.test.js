import test from 'node:test';
import assert from 'node:assert/strict';

import { BongGogglesModerationOperationsProjection } from '../src/moderationOperations.js';
import { buildModerationCaseDetail } from '../src/moderationCaseDetail.js';

function log(eventName, args, n = 1) {
  return {
    eventName,
    args,
    chainId: 420,
    blockNumber: n,
    blockHash: `0xblock${n}`,
    transactionHash: `0xtx${n}`,
    transactionIndex: 0,
    logIndex: 0,
  };
}

function projectionWithCase() {
  const projection = new BongGogglesModerationOperationsProjection();
  projection.apply(log('ReportSubmitted', {
    reportId: 'r1', reporter: '0xreporter', subjectAccount: '0xsubject', targetType: 'PROFILE', targetId: 'p1', reasonCode: 'abuse',
  }, 1));
  projection.apply(log('CaseOpened', { caseId: 'c1', reportId: 'r1', operator: '0xop1', policyVersion: 'policy-v1' }, 2));
  projection.apply(log('SafetyActionApplied', { actionId: 'a1', caseId: 'c1', actionType: 'TEMP_ACCOUNT_RESTRICTION', operator: '0xop2', expiresAt: 999 }, 3));
  projection.apply(log('AppealFiled', { appealId: 'ap1', caseId: 'c1', appellant: '0xsubject' }, 4));
  return projection;
}

test('case detail links report, action, appeal and provenance deterministically', () => {
  const projection = projectionWithCase();
  const detail = buildModerationCaseDetail(projection.snapshot(), 'c1', {
    report: { reportId: 'r1', subjectAccount: '0xsubject', targetId: 'p1', evidenceHash: '0xevidence' },
    caseRecord: { caseId: 'c1', reportId: 'r1', subjectAccount: '0xsubject', targetId: 'p1' },
    actions: [{ actionId: 'a1', caseId: 'c1', rationaleHash: '0xrationale' }],
    appeals: [{ appealId: 'ap1', caseId: 'c1' }],
  });

  assert.equal(detail.caseId, 'c1');
  assert.equal(detail.report.reportId, 'r1');
  assert.equal(detail.actions.length, 1);
  assert.equal(detail.appeals.length, 1);
  assert.deepEqual(detail.timeline.map((item) => item.type), ['REPORT_SUBMITTED', 'CASE_OPENED', 'ACTION_APPLIED', 'APPEAL_FILED']);
  assert.equal(detail.authoritative, false);
  assert.ok(detail.timeline.every((item) => item.provenance));
});

test('evidence view exposes only canonical hashes, never evidence bodies', () => {
  const projection = projectionWithCase();
  const detail = buildModerationCaseDetail(projection.snapshot(), 'c1', {
    report: { reportId: 'r1', subjectAccount: '0xsubject', targetId: 'p1', evidenceHash: '0xevidence', evidence: 'private body' },
    caseRecord: { caseId: 'c1', reportId: 'r1', subjectAccount: '0xsubject', targetId: 'p1' },
    actions: [{ actionId: 'a1', caseId: 'c1', rationaleHash: '0xrationale', rationale: 'private rationale' }],
  });

  assert.deepEqual(detail.evidence.map((item) => item.reference), ['0xevidence', '0xrationale']);
  assert.ok(detail.evidence.every((item) => item.contentIncluded === false));
  assert.equal(JSON.stringify(detail).includes('private body'), false);
  assert.equal(JSON.stringify(detail).includes('private rationale'), false);
});

test('case detail fails closed when canonical hydration disagrees with projection', () => {
  const projection = projectionWithCase();
  assert.throws(() => buildModerationCaseDetail(projection.snapshot(), 'c1', {
    report: { reportId: 'r1', subjectAccount: '0xother', targetId: 'p1' },
  }), /canonical projection mismatch/);
});

test('case detail fails closed when linked projection records are missing', () => {
  const projection = projectionWithCase();
  const snapshot = projection.snapshot();
  snapshot.actions = [];
  assert.throws(() => buildModerationCaseDetail(snapshot, 'c1'), /latest action projection missing/);
});

test('resolved appeal and closed-case provenance remain visible in timeline', () => {
  const projection = projectionWithCase();
  projection.apply(log('AppealResolved', { appealId: 'ap1', caseId: 'c1', result: 'UPHELD', operator: '0xop3' }, 5));
  projection.apply(log('CaseClosed', { caseId: 'c1', operator: '0xop4' }, 6));
  const detail = buildModerationCaseDetail(projection.snapshot(), 'c1');
  assert.deepEqual(detail.timeline.map((item) => item.type), ['REPORT_SUBMITTED', 'CASE_OPENED', 'ACTION_APPLIED', 'APPEAL_RESOLVED', 'CASE_CLOSED']);
  assert.equal(detail.timeline[3].secondaryProvenance.eventName, 'AppealResolved');
  assert.equal(detail.timeline[4].provenance.eventName, 'CaseClosed');
});
