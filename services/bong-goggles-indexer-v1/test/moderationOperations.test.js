import test from 'node:test';
import assert from 'node:assert/strict';

import { BongGogglesModerationOperationsProjection } from '../src/moderationOperations.js';

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

test('ReportSubmitted enters deterministic untriaged operator queue', () => {
  const projection = new BongGogglesModerationOperationsProjection();
  projection.apply(log('ReportSubmitted', {
    reportId: 'r1', reporter: '0xreporter', subjectAccount: '0xsubject', targetType: 'PROFILE', targetId: 'p1', reasonCode: 'spam',
  }));
  const queues = projection.operatorQueues();
  assert.equal(queues.counts.untriagedReports, 1);
  assert.equal(queues.untriagedReports[0].reportId, 'r1');
  assert.equal(queues.authoritative, false);
});

test('CaseOpened moves report out of untriaged queue and into open cases', () => {
  const projection = new BongGogglesModerationOperationsProjection();
  projection.apply(log('ReportSubmitted', {
    reportId: 'r1', reporter: '0xreporter', subjectAccount: '0xsubject', targetType: 'PROFILE', targetId: 'p1', reasonCode: 'spam',
  }, 1));
  projection.apply(log('CaseOpened', { caseId: 'c1', reportId: 'r1', operator: '0xop1', policyVersion: 'policy-v1' }, 2));
  const queues = projection.operatorQueues();
  assert.equal(queues.counts.untriagedReports, 0);
  assert.equal(queues.counts.openCases, 1);
  assert.equal(queues.openCases[0].subjectAccount, '0xsubject');
});

test('actions and revocations project without creating moderation authority', () => {
  const projection = new BongGogglesModerationOperationsProjection();
  projection.apply(log('ReportSubmitted', {
    reportId: 'r1', reporter: '0xreporter', subjectAccount: '0xsubject', targetType: 'POST', targetId: 'post1', reasonCode: 'harassment',
  }, 1));
  projection.apply(log('CaseOpened', { caseId: 'c1', reportId: 'r1', operator: '0xop1', policyVersion: 'policy-v1' }, 2));
  projection.apply(log('SafetyActionApplied', { actionId: 'a1', caseId: 'c1', actionType: 'RESTRICT_INTERACTION', operator: '0xop2', expiresAt: 999 }, 3));
  projection.apply(log('SafetyActionRevoked', { actionId: 'a1', caseId: 'c1', operator: '0xop3' }, 4));
  const snapshot = projection.snapshot();
  assert.equal(snapshot.actions[0][1].state, 'REVOKED');
  assert.equal(snapshot.actions[0][1].authoritative, false);
});

test('pending appeals are queued and overturned appeals clear queue and resolve case', () => {
  const projection = new BongGogglesModerationOperationsProjection();
  projection.apply(log('ReportSubmitted', {
    reportId: 'r1', reporter: '0xreporter', subjectAccount: '0xsubject', targetType: 'PROFILE', targetId: 'p1', reasonCode: 'abuse',
  }, 1));
  projection.apply(log('CaseOpened', { caseId: 'c1', reportId: 'r1', operator: '0xop1', policyVersion: 'policy-v1' }, 2));
  projection.apply(log('SafetyActionApplied', { actionId: 'a1', caseId: 'c1', actionType: 'TEMP_ACCOUNT_RESTRICTION', operator: '0xop2', expiresAt: 999 }, 3));
  projection.apply(log('AppealFiled', { appealId: 'ap1', caseId: 'c1', appellant: '0xsubject' }, 4));
  assert.equal(projection.operatorQueues().counts.pendingAppeals, 1);
  projection.apply(log('AppealResolved', { appealId: 'ap1', caseId: 'c1', result: 'OVERTURNED', operator: '0xop3' }, 5));
  assert.equal(projection.operatorQueues().counts.pendingAppeals, 0);
  const snapshot = projection.snapshot();
  assert.equal(snapshot.cases[0][1].state, 'RESOLVED');
  assert.equal(snapshot.actions[0][1].state, 'REVOKED_BY_APPEAL');
});

test('CaseClosed fails closed when local projection still has pending appeal', () => {
  const projection = new BongGogglesModerationOperationsProjection();
  projection.apply(log('ReportSubmitted', {
    reportId: 'r1', reporter: '0xreporter', subjectAccount: '0xsubject', targetType: 'PROFILE', targetId: 'p1', reasonCode: 'abuse',
  }, 1));
  projection.apply(log('CaseOpened', { caseId: 'c1', reportId: 'r1', operator: '0xop1', policyVersion: 'policy-v1' }, 2));
  projection.apply(log('AppealFiled', { appealId: 'ap1', caseId: 'c1', appellant: '0xsubject' }, 3));
  assert.throws(() => projection.apply(log('CaseClosed', { caseId: 'c1', operator: '0xop2' }, 4)), /pending appeal/);
});

test('emergency hides are projected as operator visibility only', () => {
  const projection = new BongGogglesModerationOperationsProjection();
  projection.apply(log('EmergencyHideSet', { targetScope: 'scope-1', hiddenUntil: 12345, operator: '0xop1' }));
  const snapshot = projection.snapshot();
  assert.equal(snapshot.emergencyHides[0][1].targetScope, 'scope-1');
  assert.equal(snapshot.emergencyHides[0][1].authoritative, false);
});

test('snapshot restore preserves deterministic moderation queues', () => {
  const original = new BongGogglesModerationOperationsProjection();
  original.apply(log('ReportSubmitted', {
    reportId: 'r2', reporter: '0xreporter', subjectAccount: '0xsubject2', targetType: 'PROFILE', targetId: 'p2', reasonCode: 'spam',
  }, 2));
  original.apply(log('ReportSubmitted', {
    reportId: 'r1', reporter: '0xreporter', subjectAccount: '0xsubject1', targetType: 'PROFILE', targetId: 'p1', reasonCode: 'spam',
  }, 1));
  const restored = new BongGogglesModerationOperationsProjection();
  restored.restore(original.snapshot());
  assert.deepEqual(restored.operatorQueues(), original.operatorQueues());
  assert.deepEqual(restored.snapshot(), original.snapshot());
});
