import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { buildAutomationTransactionPlan420, coordinateAutomationExecution420, deriveAutomationJobId420, digestExecutionEnvelope420 } from '../src/index.js';
import type { AutomationEligibility420, AutomationJobRegistryEntry420 } from '../src/index.js';

const calldata = '0x12345678aabbccdd';
const calldataHash = `0x${createHash('sha256').update(Buffer.from(calldata.slice(2), 'hex')).digest('hex')}`;
const envelope = {
  target: '0x1111111111111111111111111111111111111111',
  selector: '0x12345678',
  calldataHash,
  nativeValueWei: 42n,
  gasLimit: 210000n,
};
const baseJob = {
  chainId: 420n,
  jobId: '',
  protocolId: 'protocol.alpha',
  ownerId: 'owner.alpha',
  triggerClass: 'manual' as const,
  triggerRef: 'manual-trigger',
  revision: 1,
  status: 'enabled' as const,
  envelope,
  createdAt: 1,
  updatedAt: 1,
};
baseJob.jobId = deriveAutomationJobId420(baseJob);
const entry: AutomationJobRegistryEntry420 = { job: baseJob, envelopeDigest: digestExecutionEnvelope420(envelope) };
const eligibility: AutomationEligibility420 = { jobId: baseJob.jobId, eligible: true, reason: 'manual-request', occurrenceId: `0x${'ab'.repeat(32)}`, nextEligibleAtMs: null, nextEligibleBlock: null };

function worker(overrides: Partial<{ workerId: string; address: string }> = {}) {
  return {
    workerId: overrides.workerId ?? 'worker.alpha',
    address: overrides.address ?? '0x2222222222222222222222222222222222222222',
    async signPlan(plan: unknown) {
      assert.ok(plan);
      return '0xdeadbeef';
    },
  };
}

const resolver = { async resolveCalldata() { return calldata; } };

test('AUT-4 builds immutable plan from AUT-1 envelope and AUT-3 occurrence', async () => {
  const plan = await buildAutomationTransactionPlan420({ entry, eligibility, worker: worker(), calldataResolver: resolver });
  assert.equal(plan.to, envelope.target);
  assert.equal(plan.data, calldata);
  assert.equal(plan.valueWei, 42n);
  assert.equal(plan.gasLimit, 210000n);
  assert.equal(plan.occurrenceId, eligibility.occurrenceId);
  assert.match(plan.intentDigest, /^0x[0-9a-f]{64}$/);
});

test('AUT-4 rejects calldata that does not match committed selector or hash', async () => {
  await assert.rejects(buildAutomationTransactionPlan420({ entry, eligibility, worker: worker(), calldataResolver: { async resolveCalldata() { return '0x99999999'; } } }), /AUT4_SELECTOR_MISMATCH/);
  await assert.rejects(buildAutomationTransactionPlan420({ entry, eligibility, worker: worker(), calldataResolver: { async resolveCalldata() { return '0x1234567800'; } } }), /AUT4_CALLDATA_HASH_MISMATCH/);
});

test('AUT-4 refuses disabled or ineligible occurrences', async () => {
  await assert.rejects(buildAutomationTransactionPlan420({ entry, eligibility: { ...eligibility, eligible: false }, worker: worker(), calldataResolver: resolver }), /AUT4_OCCURRENCE_NOT_ELIGIBLE/);
  await assert.rejects(buildAutomationTransactionPlan420({ entry: { ...entry, job: { ...entry.job, status: 'disabled' } }, eligibility, worker: worker(), calldataResolver: resolver }), /AUT4_JOB_DISABLED/);
});

test('AUT-4 requires canonical-ready RPC on the same chain', async () => {
  const baseRpc = { chainId: 420n, ready: true, canonicalSafe: true, async submitSignedPayload() { return { status: 'accepted' as const, transactionHash: `0x${'cd'.repeat(32)}` }; } };
  await assert.rejects(coordinateAutomationExecution420({ entry, eligibility, worker: worker(), calldataResolver: resolver, rpc: { ...baseRpc, chainId: 1n } }), /AUT4_RPC_CHAIN_ID_MISMATCH/);
  await assert.rejects(coordinateAutomationExecution420({ entry, eligibility, worker: worker(), calldataResolver: resolver, rpc: { ...baseRpc, ready: false } }), /AUT4_RPC_NOT_READY/);
  await assert.rejects(coordinateAutomationExecution420({ entry, eligibility, worker: worker(), calldataResolver: resolver, rpc: { ...baseRpc, canonicalSafe: false } }), /AUT4_RPC_NOT_READY/);
});

test('AUT-4 records accepted, rejected and ambiguous outcomes without implicit replay', async () => {
  const accepted = await coordinateAutomationExecution420({ entry, eligibility, worker: worker(), calldataResolver: resolver, rpc: { chainId: 420n, ready: true, canonicalSafe: true, async submitSignedPayload() { return { status: 'accepted', transactionHash: `0x${'ef'.repeat(32)}` } as const; } } });
  assert.equal(accepted.status, 'submitted');
  assert.equal(accepted.retryable, false);

  const rejected = await coordinateAutomationExecution420({ entry, eligibility, worker: worker(), calldataResolver: resolver, rpc: { chainId: 420n, ready: true, canonicalSafe: true, async submitSignedPayload() { return { status: 'rejected', code: 'fee-too-low', retryable: true } as const; } } });
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.retryable, true);

  let calls = 0;
  const ambiguous = await coordinateAutomationExecution420({ entry, eligibility, worker: worker(), calldataResolver: resolver, rpc: { chainId: 420n, ready: true, canonicalSafe: true, async submitSignedPayload() { calls += 1; return { status: 'ambiguous', code: 'transport-timeout' } as const; } } });
  assert.equal(ambiguous.status, 'ambiguous');
  assert.equal(ambiguous.retryable, false);
  assert.equal(calls, 1);
});

test('AUT-4 rejects malformed worker and signed payload identities', async () => {
  await assert.rejects(buildAutomationTransactionPlan420({ entry, eligibility, worker: worker({ address: '0x1234' }), calldataResolver: resolver }), /AUT4_WORKER_ADDRESS_INVALID/);
  await assert.rejects(coordinateAutomationExecution420({ entry, eligibility, worker: { ...worker(), async signPlan() { return 'not-hex'; } }, calldataResolver: resolver, rpc: { chainId: 420n, ready: true, canonicalSafe: true, async submitSignedPayload() { throw new Error('should not submit'); } } }), /AUT4_SIGNED_PAYLOAD_INVALID/);
});
