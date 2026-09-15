import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AutomationJobRegistry420,
  deriveAutomationJobId420,
  digestExecutionEnvelope420,
  type AutomationExecutionEnvelope420,
  type AutomationJobDefinition420,
} from '../src/jobs.js';

const envelope: AutomationExecutionEnvelope420 = {
  target: '0x1111111111111111111111111111111111111111',
  selector: '0x12345678',
  calldataHash: '0x' + 'ab'.repeat(32),
  nativeValueWei: 0n,
  gasLimit: 250000n,
};

function makeJob(overrides: Partial<AutomationJobDefinition420> = {}): AutomationJobDefinition420 {
  const base = {
    chainId: 420n,
    protocolId: '420Swap',
    ownerId: 'protocol:420Swap',
    triggerClass: 'block' as const,
    triggerRef: 'rebalance-v1',
    envelope,
  };
  const jobId = deriveAutomationJobId420(base);
  return {
    ...base,
    jobId,
    revision: 1,
    status: 'enabled',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

test('derives stable job identity from immutable execution intent', () => {
  const a = makeJob();
  const b = makeJob();
  assert.equal(a.jobId, b.jobId);
  assert.equal(digestExecutionEnvelope420(a.envelope), digestExecutionEnvelope420(b.envelope));
});

test('job identity changes if execution intent changes', () => {
  const base = makeJob();
  const changedEnvelope = { ...envelope, gasLimit: 300000n };
  const changedId = deriveAutomationJobId420({
    protocolId: base.protocolId,
    ownerId: base.ownerId,
    triggerClass: base.triggerClass,
    triggerRef: base.triggerRef,
    envelope: changedEnvelope,
  });
  assert.notEqual(changedId, base.jobId);
});

test('registers and discovers immutable jobs', () => {
  const registry = new AutomationJobRegistry420();
  const job = makeJob();
  const registered = registry.register(job);
  assert.equal(registered.job.jobId, job.jobId);
  assert.equal(registry.get(job.jobId)?.envelopeDigest, digestExecutionEnvelope420(envelope));
  assert.equal(registry.list('enabled').length, 1);
});

test('rejects duplicate registration', () => {
  const registry = new AutomationJobRegistry420();
  const job = makeJob();
  registry.register(job);
  assert.throws(() => registry.register(job), /AUT1_JOB_ALREADY_EXISTS/);
});

test('rejects wrong-chain jobs', () => {
  const registry = new AutomationJobRegistry420();
  assert.throws(() => registry.register(makeJob({ chainId: 1n })), /AUT1_CHAIN_ID_INVALID/);
});

test('rejects mismatched job IDs', () => {
  const registry = new AutomationJobRegistry420();
  assert.throws(() => registry.register(makeJob({ jobId: '0x' + '00'.repeat(32) })), /AUT1_JOB_ID_MISMATCH/);
});

test('rejects malformed targets, selectors and calldata commitments', () => {
  const registry = new AutomationJobRegistry420();
  assert.throws(() => registry.register(makeJob({ envelope: { ...envelope, target: '0x1234' } })), /AUT1_TARGET_INVALID/);
  assert.throws(() => registry.register(makeJob({ envelope: { ...envelope, selector: '0x12' } })), /AUT1_SELECTOR_INVALID/);
  assert.throws(() => registry.register(makeJob({ envelope: { ...envelope, calldataHash: '0x12' } })), /AUT1_CALLDATA_HASH_INVALID/);
});

test('rejects negative native value and non-positive gas limits', () => {
  const registry = new AutomationJobRegistry420();
  assert.throws(() => registry.register(makeJob({ envelope: { ...envelope, nativeValueWei: -1n } })), /AUT1_NATIVE_VALUE_INVALID/);
  assert.throws(() => registry.register(makeJob({ envelope: { ...envelope, gasLimit: 0n } })), /AUT1_GAS_LIMIT_INVALID/);
});

test('status transitions advance revision without mutating execution envelope', () => {
  const registry = new AutomationJobRegistry420();
  const job = makeJob();
  const initial = registry.register(job);
  const disabled = registry.setStatus(job.jobId, 'disabled', 1100);
  assert.equal(disabled.job.revision, 2);
  assert.equal(disabled.job.status, 'disabled');
  assert.equal(disabled.envelopeDigest, initial.envelopeDigest);
  assert.deepEqual(disabled.job.envelope, initial.job.envelope);
});

test('registry never exposes an execution-intent replacement path', () => {
  const registry = new AutomationJobRegistry420();
  assert.throws(() => registry.replaceExecutionIntent(), /AUT1_EXECUTION_ENVELOPE_IMMUTABLE/);
});

test('returned registry entries are defensive copies', () => {
  const registry = new AutomationJobRegistry420();
  const job = makeJob();
  const registered = registry.register(job);
  registered.job.envelope.gasLimit = 1n;
  assert.equal(registry.get(job.jobId)?.job.envelope.gasLimit, 250000n);
});
