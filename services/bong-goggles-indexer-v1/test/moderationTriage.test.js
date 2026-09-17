import test from 'node:test';
import assert from 'node:assert/strict';

import {
  groupRelatedReports,
  prepareCaseOpenIntent,
  resolveModerationPolicy,
} from '../src/moderationTriage.js';

function report(overrides = {}) {
  return {
    reportId: 'r1',
    reporter: '0xreporter',
    subjectAccount: '0xsubject',
    targetType: 'PROFILE',
    targetId: 'p1',
    reasonCode: 'abuse',
    caseId: null,
    triageState: 'UNTRIAGED',
    authoritative: false,
    ...overrides,
  };
}

test('related report grouping is deterministic and non-authoritative', () => {
  const groups = groupRelatedReports([
    report({ reportId: 'r2' }),
    report({ reportId: 'r1' }),
    report({ reportId: 'r3', reasonCode: 'spam' }),
  ]);
  assert.equal(groups.length, 2);
  const abuse = groups.find((item) => item.reportIds.includes('r1'));
  assert.deepEqual(abuse.reportIds, ['r1', 'r2']);
  assert.equal(abuse.duplicateCandidate, true);
  assert.equal(abuse.authoritative, false);
});

test('reason code maps to explicit policy version', () => {
  const policy = resolveModerationPolicy('abuse', { abuse: 'policy-v3' });
  assert.equal(policy.policyVersion, 'policy-v3');
  assert.throws(() => resolveModerationPolicy('unknown', { abuse: 'policy-v3' }), /no moderation policy version/);
});

test('case-open preparation uses canonical scope derivation and capability gate', async () => {
  const calls = [];
  const intent = await prepareCaseOpenIntent({
    report: report(),
    policyMap: { abuse: 'policy-v3' },
    deriveScope: async (targetType, targetId, subjectAccount) => {
      calls.push([targetType, targetId, subjectAccount]);
      return '0xscope';
    },
    isAuthorized: async ({ actionId, scope }) => actionId === 'ACTION_SAFETY_CASE_OPEN' && scope === '0xscope',
  });

  assert.deepEqual(calls, [['PROFILE', 'p1', '0xsubject']]);
  assert.deepEqual(intent.args, ['r1', 'policy-v3']);
  assert.equal(intent.walletConfirmationRequired, true);
  assert.equal(intent.signed, false);
  assert.equal(intent.broadcast, false);
  assert.equal(intent.authoritative, false);
});

test('case-open preparation fails closed without capability', async () => {
  await assert.rejects(() => prepareCaseOpenIntent({
    report: report(),
    policyMap: { abuse: 'policy-v3' },
    deriveScope: async () => '0xscope',
    isAuthorized: async () => false,
  }), /lacks case-open capability/);
});

test('case-open preparation rejects already-triaged reports', async () => {
  await assert.rejects(() => prepareCaseOpenIntent({
    report: report({ triageState: 'CASE_OPENED', caseId: 'c1' }),
    policyMap: { abuse: 'policy-v3' },
    deriveScope: async () => '0xscope',
    isAuthorized: async () => true,
  }), /untriaged report required/);
});
