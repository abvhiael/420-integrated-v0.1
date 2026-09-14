import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTOMATION_ORACLE_FEED_TYPE_420,
  consumeCanonicalAutomationNumericRead420,
  consumeCanonicalAutomationResultRead420,
  normalizeAutomationTrigger420,
  evaluateAutomationEligibility420,
  AutomationJobRegistry420,
  deriveAutomationJobId420,
  type AutomationCanonicalNumericRead420,
  type AutomationCanonicalResultRead420,
  type AutomationJobDefinition420,
} from '../src/index.js';

const policy = {
  expectedChainId: 420n,
  routerRef: 'oracle-router.genesis',
  minConfidenceBps: 8_000,
  minSources: 2,
  maxReadAgeMs: 30_000,
  maxSpreadBps: 500,
};

const numericRead: AutomationCanonicalNumericRead420 = {
  canonical: true,
  chainId: 420n,
  routerRef: policy.routerRef,
  feedId: 'condition.numeric',
  feedType: AUTOMATION_ORACLE_FEED_TYPE_420,
  aggregation: 'MEDIAN_NUMERIC',
  value: 4_200_000_000_000_000_000n,
  updatedAtSec: 10n,
  decimals: 18,
  confidenceBps: 9_000,
  spreadBps: 20,
  sourceCount: 3,
};

const resultHash = `0x${'ab'.repeat(32)}`;
const resultRead: AutomationCanonicalResultRead420 = {
  canonical: true,
  chainId: 420n,
  routerRef: policy.routerRef,
  feedId: 'condition.result',
  feedType: AUTOMATION_ORACLE_FEED_TYPE_420,
  aggregation: 'QUORUM_EQUAL',
  resultHash,
  updatedAtSec: 10n,
  confidenceBps: 9_500,
  agreeingSources: 3,
};

const envelope = {
  target: '0x1111111111111111111111111111111111111111',
  selector: '0x12345678',
  calldataHash: `0x${'22'.repeat(32)}`,
  nativeValueWei: 0n,
  gasLimit: 150000n,
};

function makeJob(trigger: ReturnType<typeof normalizeAutomationTrigger420>) {
  const identity = { protocolId: 'protocol.test', ownerId: 'owner.test', triggerClass: trigger.triggerClass, triggerRef: trigger.triggerRef, envelope };
  const job: AutomationJobDefinition420 = {
    chainId: 420n,
    jobId: deriveAutomationJobId420(identity),
    protocolId: identity.protocolId,
    ownerId: identity.ownerId,
    triggerClass: trigger.triggerClass,
    triggerRef: trigger.triggerRef,
    revision: 1,
    status: 'enabled',
    envelope,
    createdAt: 1_000,
    updatedAt: 1_000,
  };
  return new AutomationJobRegistry420().register(job);
}

function chainObservation(nowMs = 20_000) {
  return { nowMs, chain: { chainId: 420n, headBlock: 102n, safeBlock: 100n, finalizedBlock: 99n, observedAtMs: nowMs - 100 } };
}

test('AUT-8 consumes canonical provider-neutral numeric automation reads', () => {
  const fact = consumeCanonicalAutomationNumericRead420(numericRead, policy, 20_000);
  assert.equal(fact.observation.value, '4.2');
  assert.equal(fact.observation.observedAtMs, 10_000);
  assert.equal(fact.provenance.source, '420OracleRouter');
  assert.equal(fact.provenance.providerNeutral, true);
  assert.equal(fact.provenance.canonical, true);
});

test('AUT-8 rejects wrong chain, router, feed type and provider-shaped extra fields', () => {
  assert.throws(() => consumeCanonicalAutomationNumericRead420({ ...numericRead, chainId: 1n }, policy, 20_000), /AUT8_CHAIN_ID_MISMATCH/);
  assert.throws(() => consumeCanonicalAutomationNumericRead420({ ...numericRead, routerRef: 'other-router' }, policy, 20_000), /AUT8_ROUTER_MISMATCH/);
  assert.throws(() => consumeCanonicalAutomationNumericRead420({ ...numericRead, feedType: '420/ORACLE/FEED/PRICE/V1' as typeof AUTOMATION_ORACLE_FEED_TYPE_420 }, policy, 20_000), /AUT8_FEED_TYPE_INVALID/);
  const providerPayload = { ...numericRead, providerId: 'vendor.alpha' };
  assert.throws(() => consumeCanonicalAutomationNumericRead420(providerPayload, policy, 20_000), /AUT8_READ_FIELD_UNKNOWN/);
});

test('AUT-8 enforces local freshness, confidence, quorum and spread policy', () => {
  assert.throws(() => consumeCanonicalAutomationNumericRead420({ ...numericRead, updatedAtSec: 100n }, policy, 20_000), /AUT8_READ_FROM_FUTURE/);
  assert.throws(() => consumeCanonicalAutomationNumericRead420({ ...numericRead, updatedAtSec: 0n }, { ...policy, maxReadAgeMs: 5_000 }, 20_000), /AUT8_READ_STALE/);
  assert.throws(() => consumeCanonicalAutomationNumericRead420({ ...numericRead, confidenceBps: 7_999 }, policy, 20_000), /AUT8_CONFIDENCE_INSUFFICIENT/);
  assert.throws(() => consumeCanonicalAutomationNumericRead420({ ...numericRead, sourceCount: 1 }, policy, 20_000), /AUT8_QUORUM_INSUFFICIENT/);
  assert.throws(() => consumeCanonicalAutomationNumericRead420({ ...numericRead, spreadBps: 501 }, policy, 20_000), /AUT8_SPREAD_EXCEEDED/);
});

test('AUT-8 consumes exact-result quorum reads', () => {
  const fact = consumeCanonicalAutomationResultRead420({ ...resultRead, resultHash: resultHash.toUpperCase().replace('0X', '0x') }, policy, 20_000);
  assert.equal(fact.observation.resultHash, resultHash);
  assert.equal(fact.provenance.aggregation, 'QUORUM_EQUAL');
  assert.equal(fact.provenance.sourceCount, 3);
  assert.throws(() => consumeCanonicalAutomationResultRead420({ ...resultRead, resultHash: '0x1234' }, policy, 20_000), /AUT8_RESULT_HASH_INVALID/);
  assert.throws(() => consumeCanonicalAutomationResultRead420({ ...resultRead, agreeingSources: 1 }, policy, 20_000), /AUT8_QUORUM_INSUFFICIENT/);
});

test('AUT-8 exact-result trigger uses canonical router fact as eligibility evidence only', () => {
  const trigger = normalizeAutomationTrigger420({ kind: 'oracle', mode: 'result', feedId: resultRead.feedId, expectedResultHash: resultHash, maxAgeMs: 30_000 });
  const entry = makeJob(trigger);
  const fact = consumeCanonicalAutomationResultRead420(resultRead, policy, 20_000);
  const eligible = evaluateAutomationEligibility420({ entry, trigger, observation: { ...chainObservation(), oracleResults: [fact.observation] } });
  assert.equal(eligible.eligible, true);
  assert.equal(eligible.reason, 'oracle-result-match');
  assert.ok(eligible.occurrenceId);

  const mismatch = evaluateAutomationEligibility420({ entry, trigger, observation: { ...chainObservation(), oracleResults: [{ ...fact.observation, resultHash: `0x${'cd'.repeat(32)}` }] } });
  assert.equal(mismatch.eligible, false);
  assert.equal(mismatch.reason, 'oracle-result-mismatch');
});
