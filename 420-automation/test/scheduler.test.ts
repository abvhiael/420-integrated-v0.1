import assert from 'node:assert/strict';
import test from 'node:test';
import { AutomationJobRegistry420, deriveAutomationJobId420, type AutomationJobDefinition420 } from '../src/jobs.js';
import { normalizeAutomationTrigger420 } from '../src/triggers.js';
import { evaluateAutomationEligibility420, scanAutomationJobs420 } from '../src/scheduler.js';

const envelope = {
  target: '0x1111111111111111111111111111111111111111',
  selector: '0x12345678',
  calldataHash: `0x${'22'.repeat(32)}`,
  nativeValueWei: 0n,
  gasLimit: 150000n,
};

function makeJob(trigger: ReturnType<typeof normalizeAutomationTrigger420>, overrides: Partial<AutomationJobDefinition420> = {}) {
  const base = {
    protocolId: 'protocol.test',
    ownerId: 'owner.test',
    triggerClass: trigger.triggerClass,
    triggerRef: trigger.triggerRef,
    envelope,
  };
  const job: AutomationJobDefinition420 = {
    chainId: 420n,
    jobId: deriveAutomationJobId420(base),
    protocolId: base.protocolId,
    ownerId: base.ownerId,
    triggerClass: base.triggerClass,
    triggerRef: base.triggerRef,
    revision: 1,
    status: 'enabled',
    envelope,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
  const registry = new AutomationJobRegistry420();
  return registry.register(job);
}

function observation(nowMs = 10_000, safeBlock = 100n) {
  return {
    nowMs,
    chain: { chainId: 420n, headBlock: safeBlock + 2n, safeBlock, finalizedBlock: safeBlock - 1n, observedAtMs: nowMs - 100 },
  };
}

test('time once and interval triggers produce deterministic occurrences', () => {
  const once = normalizeAutomationTrigger420({ kind: 'time', mode: 'once', atMs: 5000 });
  const onceEntry = makeJob(once);
  const due = evaluateAutomationEligibility420({ entry: onceEntry, trigger: once, observation: observation() });
  assert.equal(due.eligible, true);
  assert.equal(due.reason, 'time-once-due');
  assert.ok(due.occurrenceId);
  const duplicate = evaluateAutomationEligibility420({ entry: onceEntry, trigger: once, observation: observation(), consumedOccurrenceIds: new Set([due.occurrenceId!]) });
  assert.equal(duplicate.eligible, false);
  assert.equal(duplicate.reason, 'duplicate-suppressed');

  const interval = normalizeAutomationTrigger420({ kind: 'time', mode: 'interval', startAtMs: 1000, intervalMs: 2000 });
  const decision = evaluateAutomationEligibility420({ entry: makeJob(interval), trigger: interval, observation: observation(5600) });
  assert.equal(decision.eligible, true);
  assert.equal(decision.nextEligibleAtMs, 7000);
});

test('block scheduling uses safe head and returns next block', () => {
  const trigger = normalizeAutomationTrigger420({ kind: 'block', startBlock: 50n, intervalBlocks: 10n });
  const decision = evaluateAutomationEligibility420({ entry: makeJob(trigger), trigger, observation: observation(10_000, 84n) });
  assert.equal(decision.eligible, true);
  assert.equal(decision.nextEligibleBlock, 90n);
});

test('event matching requires configured confirmations', () => {
  const address = '0x2222222222222222222222222222222222222222';
  const topic0 = `0x${'33'.repeat(32)}`;
  const trigger = normalizeAutomationTrigger420({ kind: 'event', address, topic0, minConfirmations: 2 });
  const entry = makeJob(trigger);
  const event = { address, topic0, topics: [], blockNumber: 99n, logIndex: 4, blockHash: `0x${'44'.repeat(32)}` };
  const tooEarly = evaluateAutomationEligibility420({ entry, trigger, observation: { ...observation(10_000, 100n), events: [event] } });
  assert.equal(tooEarly.eligible, false);
  const mature = evaluateAutomationEligibility420({ entry, trigger, observation: { ...observation(10_000, 101n), events: [event] } });
  assert.equal(mature.eligible, true);
  assert.equal(mature.reason, 'event-match');
});

test('oracle triggers require fresh values and exact decimal comparison', () => {
  const trigger = normalizeAutomationTrigger420({ kind: 'oracle', feedId: 'price.420usd', predicate: 'gte', threshold: '4.20', maxAgeMs: 5000 });
  const entry = makeJob(trigger);
  const fresh = evaluateAutomationEligibility420({ entry, trigger, observation: { ...observation(), oracles: [{ feedId: 'price.420usd', value: '4.2000', observedAtMs: 9000 }] } });
  assert.equal(fresh.eligible, true);
  const stale = evaluateAutomationEligibility420({ entry, trigger, observation: { ...observation(), oracles: [{ feedId: 'price.420usd', value: '5', observedAtMs: 4000 }] } });
  assert.equal(stale.eligible, false);
  assert.equal(stale.reason, 'oracle-stale');
});

test('manual trigger enforces owner/protocol identity policy', () => {
  const trigger = normalizeAutomationTrigger420({ kind: 'manual', requesterPolicy: 'owner' });
  const entry = makeJob(trigger);
  const denied = evaluateAutomationEligibility420({ entry, trigger, observation: { ...observation(), manuals: [{ requesterId: 'protocol.test', requesterRole: 'protocol', requestId: 'r1' }] } });
  assert.equal(denied.eligible, false);
  const allowed = evaluateAutomationEligibility420({ entry, trigger, observation: { ...observation(), manuals: [{ requesterId: 'owner.test', requesterRole: 'owner', requestId: 'r2' }] } });
  assert.equal(allowed.eligible, true);
});

test('disabled jobs, binding mismatch, wrong chain and stale chain fail closed', () => {
  const trigger = normalizeAutomationTrigger420({ kind: 'time', mode: 'once', atMs: 1 });
  const disabled = makeJob(trigger, { status: 'disabled' });
  assert.equal(evaluateAutomationEligibility420({ entry: disabled, trigger, observation: observation() }).reason, 'job-disabled');

  const other = normalizeAutomationTrigger420({ kind: 'time', mode: 'once', atMs: 2 });
  assert.throws(() => evaluateAutomationEligibility420({ entry: makeJob(trigger), trigger: other, observation: observation() }), /AUT3_TRIGGER_BINDING_MISMATCH/);
  assert.throws(() => evaluateAutomationEligibility420({ entry: makeJob(trigger), trigger, observation: { ...observation(), chain: { ...observation().chain, chainId: 1n } } }), /AUT3_CHAIN_ID_INVALID/);
  assert.throws(() => evaluateAutomationEligibility420({ entry: makeJob(trigger), trigger, observation: { ...observation(20_000), chain: { ...observation(20_000).chain, observedAtMs: 0 } } }), /AUT3_CHAIN_STALE/);
});

test('scheduler scan is deterministic and bounded', () => {
  const a = normalizeAutomationTrigger420({ kind: 'time', mode: 'once', atMs: 1 });
  const b = normalizeAutomationTrigger420({ kind: 'block', startBlock: 1n, intervalBlocks: 1n });
  const jobs = [{ entry: makeJob(b), trigger: b }, { entry: makeJob(a), trigger: a }];
  const decisions = scanAutomationJobs420({ jobs, observation: observation(), policy: { expectedChainId: 420n, maxObservationAgeMs: 15_000, maxJobsPerScan: 2, requireSafeHead: true } });
  assert.equal(decisions.length, 2);
  assert.deepEqual([...decisions].map((d) => d.jobId), [...decisions].map((d) => d.jobId).sort());
  assert.throws(() => scanAutomationJobs420({ jobs, observation: observation(), policy: { expectedChainId: 420n, maxObservationAgeMs: 15_000, maxJobsPerScan: 1, requireSafeHead: true } }), /AUT3_SCAN_LIMIT_EXCEEDED/);
});
