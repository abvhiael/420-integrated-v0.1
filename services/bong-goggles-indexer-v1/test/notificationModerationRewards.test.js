import test from 'node:test';
import assert from 'node:assert/strict';
import { BongGogglesNotificationPipeline, notificationCandidatesForEvent } from '../src/notificationPipeline.js';
import { bongGogglesNotificationDescriptor } from '../src/notificationCatalog.js';

function log(eventName, args = {}, blockNumber = 50, logIndex = 0) {
  return {
    chainId: 420,
    blockNumber,
    blockHash: `0xb${blockNumber}`,
    transactionIndex: 0,
    transactionHash: `0xtx-${blockNumber}`,
    logIndex,
    eventName,
    args,
  };
}

test('applied moderation action targets the canonical safety subject', () => {
  const [item] = notificationCandidatesForEvent(log('SafetyActionApplied', {
    actionId: 'a1', caseId: 'c1', actionType: 'LIMIT_DISTRIBUTION', operator: '0xMOD', expiresAt: 90,
  }), {
    safetyCase: { exists: true, subjectAccount: '0xSUBJECT' },
    safetyAction: { exists: true, actionId: 'a1', caseId: 'c1', actionType: 'LIMIT_DISTRIBUTION', expiresAt: 90 },
  });
  assert.equal(item.recipient, '0xsubject');
  assert.equal(item.actor, '0xmod');
  assert.equal(item.kind, 'MODERATION_ACTION');
  assert.equal(item.metadata.status, 'APPLIED');
  assert.equal(item.authoritative, false);
});

test('moderation notification fails closed on canonical action mismatch', () => {
  const items = notificationCandidatesForEvent(log('SafetyActionApplied', {
    actionId: 'a1', caseId: 'c1', operator: '0xMOD',
  }), {
    safetyCase: { exists: true, subjectAccount: '0xSUBJECT' },
    safetyAction: { exists: true, actionId: 'different', caseId: 'c1' },
  });
  assert.deepEqual(items, []);
});

test('revocation and case closure are presentation-only moderation updates', () => {
  const [revoked] = notificationCandidatesForEvent(log('SafetyActionRevoked', {
    actionId: 'a1', caseId: 'c1', operator: '0xMOD',
  }), {
    safetyCase: { exists: true, subjectAccount: '0xSUBJECT' },
    safetyAction: { exists: true, actionId: 'a1', caseId: 'c1', actionType: 'LABEL' },
  });
  assert.equal(revoked.metadata.status, 'REVOKED');

  const [closed] = notificationCandidatesForEvent(log('CaseClosed', {
    caseId: 'c1', operator: '0xMOD',
  }, 51), {
    safetyCase: { exists: true, subjectAccount: '0xSUBJECT', state: 'CLOSED', closedAt: 123 },
  });
  assert.equal(closed.metadata.status, 'CASE_CLOSED');
  assert.equal(closed.metadata.caseState, 'CLOSED');
});

test('resolved appeal targets canonical appellant with canonical result', () => {
  const [item] = notificationCandidatesForEvent(log('AppealResolved', {
    appealId: 'ap1', caseId: 'c1', result: 'OVERTURNED', operator: '0xREVIEWER',
  }), {
    appeal: { exists: true, appealId: 'ap1', caseId: 'c1', appellant: '0xSUBJECT', state: 'OVERTURNED', resolvedAt: 200 },
  });
  assert.equal(item.recipient, '0xsubject');
  assert.equal(item.kind, 'APPEAL_UPDATED');
  assert.equal(item.metadata.result, 'OVERTURNED');
  assert.equal(item.metadata.resolvedAt, 200);
});

test('Bong Goggles reward adapter emits contribution submitted, not earned', () => {
  const [item] = notificationCandidatesForEvent(log('RewardContributionSubmitted', {
    contributionId: 'rc1', sourceKey: 'source1', contributionType: 'SOCIAL_OBJECT', beneficiary: '0xBEN', evidenceHash: '0xevidence', relay: '0xRELAY',
  }), {
    rewardContribution: { exists: true, contributionId: 'rc1', beneficiary: '0xBEN', sourceKey: 'source1', contributionType: 'SOCIAL_OBJECT', status: 'SUBMITTED' },
  });
  assert.equal(item.recipient, '0xben');
  assert.equal(item.kind, 'REWARD_CONTRIBUTION_SUBMITTED');
  assert.equal(item.metadata.rewardState, 'SUBMITTED');
  assert.notEqual(item.kind, 'REWARD_EARNED');
});

test('earned and payout catalog kinds are reserved but synthetic source events do not emit', () => {
  assert.equal(bongGogglesNotificationDescriptor('REWARD_EARNED').topic, 'rewards');
  assert.equal(bongGogglesNotificationDescriptor('REWARD_PAYOUT_UPDATED').topic, 'rewards');
  assert.deepEqual(notificationCandidatesForEvent(log('RewardEarned', { rewardId: 'r1' }), { rewardState: { exists: true, earned: true, beneficiary: '0xBEN' } }), []);
  assert.deepEqual(notificationCandidatesForEvent(log('RewardPayoutUpdated', { rewardId: 'r1' }), { rewardState: { exists: true, beneficiary: '0xBEN' } }), []);
});

test('moderation and reward replay remains deterministic and deduplicated', () => {
  const pipeline = new BongGogglesNotificationPipeline();
  const source = log('RewardContributionSubmitted', {
    contributionId: 'rc1', sourceKey: 'source1', contributionType: 'REVIEW', beneficiary: '0xBEN', relay: '0xRELAY',
  }, 60);
  const state = {
    rewardContribution: { exists: true, contributionId: 'rc1', beneficiary: '0xBEN', sourceKey: 'source1', contributionType: 'REVIEW', status: 'SUBMITTED' },
  };
  assert.equal(pipeline.process(source, state).length, 1);
  assert.equal(pipeline.process(source, state).length, 0);
});
