import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AutomationFinalityGuard420,
  AutomationReplayGuard420,
  DEFAULT_AUT11_SECURITY_POLICY_420,
  automationObservationSigningDigest420,
  redactSecrets420,
  sanitizeMetricLabels420,
  validateBatchResourceBudget420,
  validateExecutionEnvelope420,
  verifyObservationEnvelope420,
  type AutomationExecutionEnvelope420,
  type AutomationSignedObservation420,
} from '../src/security.js';

const H32_A = `0x${'11'.repeat(32)}`;
const H32_B = `0x${'22'.repeat(32)}`;
const TARGET = `0x${'33'.repeat(20)}`;

function execution(overrides: Partial<AutomationExecutionEnvelope420> = {}): AutomationExecutionEnvelope420 {
  return {
    jobId: 'job-1',
    target: TARGET,
    calldata: '0x1234',
    gasLimit: 100_000n,
    retries: 2,
    occurrenceId: H32_A,
    authorizationHash: H32_B,
    ...overrides,
  };
}

test('AUT-11 rejects spoofed, stale, future, and wrong-chain observations', () => {
  const base: AutomationSignedObservation420 = {
    sourceId: 'oracle.primary',
    chainId: 420n,
    observedAtMs: 100_000,
    sequence: 7n,
    payloadHash: H32_A,
    signature: 'sig-ok',
  };
  const digest = automationObservationSigningDigest420(base);
  assert.equal(
    verifyObservationEnvelope420({ envelope: base, nowMs: 101_000, verifySignature: (_source, supplied) => supplied === digest }),
    digest,
  );
  assert.throws(() => verifyObservationEnvelope420({ envelope: { ...base, signature: 'forged' }, nowMs: 101_000, verifySignature: (_s, _d, sig) => sig === 'sig-ok' }), /AUT11_SIGNATURE_REJECTED/);
  assert.throws(() => verifyObservationEnvelope420({ envelope: { ...base, chainId: 1n }, nowMs: 101_000, verifySignature: () => true }), /AUT11_CHAIN_ID_MISMATCH/);
  assert.throws(() => verifyObservationEnvelope420({ envelope: { ...base, observedAtMs: 50_000 }, nowMs: 101_000, verifySignature: () => true }), /AUT11_OBSERVATION_STALE/);
  assert.throws(() => verifyObservationEnvelope420({ envelope: { ...base, observedAtMs: 200_000 }, nowMs: 101_000, verifySignature: () => true }), /AUT11_OBSERVATION_FROM_FUTURE/);
});

test('AUT-11 replay guard suppresses duplicate keys and non-monotonic source sequences', () => {
  const guard = new AutomationReplayGuard420();
  guard.consume({ replayKey: 'request-1', sourceId: 'source-a', sequence: 1n, nowMs: 1_000 });
  assert.throws(() => guard.consume({ replayKey: 'request-1', nowMs: 1_001 }), /AUT11_REPLAY_DETECTED/);
  assert.throws(() => guard.consume({ replayKey: 'request-2', sourceId: 'source-a', sequence: 1n, nowMs: 1_002 }), /AUT11_SEQUENCE_REPLAY/);
  guard.consume({ replayKey: 'request-2', sourceId: 'source-a', sequence: 2n, nowMs: 1_003 });
  assert.equal(guard.size, 2);
});

test('AUT-11 replay capacity fails closed instead of evicting live protections', () => {
  const guard = new AutomationReplayGuard420();
  const policy = { ...DEFAULT_AUT11_SECURITY_POLICY_420, replayCapacity: 2, replayTtlMs: 100 };
  guard.consume({ replayKey: 'a', nowMs: 0, policy });
  guard.consume({ replayKey: 'b', nowMs: 0, policy });
  assert.throws(() => guard.consume({ replayKey: 'c', nowMs: 1, policy }), /AUT11_REPLAY_CAPACITY_EXCEEDED/);
  assert.equal(guard.prune(100), 2);
  guard.consume({ replayKey: 'c', nowMs: 100, policy });
});

test('AUT-11 rejects malicious execution envelopes and resource abuse', () => {
  validateExecutionEnvelope420(execution());
  assert.throws(() => validateExecutionEnvelope420(execution({ target: '0x1234' })), /AUT11_TARGET_INVALID/);
  assert.throws(() => validateExecutionEnvelope420(execution({ calldata: '0x1' })), /AUT11_CALLDATA_INVALID/);
  assert.throws(() => validateExecutionEnvelope420(execution({ gasLimit: DEFAULT_AUT11_SECURITY_POLICY_420.maxExecutionGas + 1n })), /AUT11_GAS_LIMIT_INVALID/);
  assert.throws(() => validateExecutionEnvelope420(execution({ retries: DEFAULT_AUT11_SECURITY_POLICY_420.maxRetries + 1 })), /AUT11_RETRY_LIMIT_INVALID/);

  const smallPolicy = { ...DEFAULT_AUT11_SECURITY_POLICY_420, maxBatchJobs: 1, maxBatchBytes: 2 };
  assert.throws(() => validateBatchResourceBudget420({ jobs: [execution(), execution({ jobId: 'job-2' })], policy: smallPolicy }), /AUT11_BATCH_JOB_LIMIT/);
  assert.throws(() => validateBatchResourceBudget420({ jobs: [execution({ calldata: '0x123456' })], policy: smallPolicy }), /AUT11_BATCH_BYTE_LIMIT/);
});

test('AUT-11 finality guard rejects rollback and finalized hash conflicts', () => {
  const guard = new AutomationFinalityGuard420();
  guard.observe({ chainId: 420n, headBlock: 120n, safeBlock: 115n, finalizedBlock: 110n, finalizedHash: H32_A });
  guard.observe({ chainId: 420n, headBlock: 121n, safeBlock: 116n, finalizedBlock: 110n, finalizedHash: H32_A });
  assert.throws(() => guard.observe({ chainId: 420n, headBlock: 121n, safeBlock: 116n, finalizedBlock: 109n, finalizedHash: H32_A }), /AUT11_FINALITY_REGRESSION/);
  assert.throws(() => guard.observe({ chainId: 420n, headBlock: 121n, safeBlock: 116n, finalizedBlock: 110n, finalizedHash: H32_B }), /AUT11_FINALITY_CONFLICT/);
  assert.throws(() => guard.observe({ chainId: 420n, headBlock: 121n, safeBlock: 109n, finalizedBlock: 109n, finalizedHash: H32_A }), /AUT11_FINALITY_REGRESSION|AUT11_SAFE_HEAD_BEHIND_FINALITY/);
});

test('AUT-11 redaction removes common secret fields recursively', () => {
  const redacted = redactSecrets420({
    token: 'bearer-abc',
    nested: { privateKey: H32_A, ok: 'visible' },
    headers: { authorization: 'Bearer secret', requestId: 'r-1' },
  }) as Record<string, unknown>;
  assert.equal(redacted.token, '[redacted]');
  assert.deepEqual(redacted.nested, { privateKey: '[redacted]', ok: 'visible' });
  assert.deepEqual(redacted.headers, { authorization: '[redacted]', requestId: 'r-1' });
});

test('AUT-11 observability labels remain bounded and low-cardinality', () => {
  assert.deepEqual(sanitizeMetricLabels420({ status: 'ok', trigger: 'event' }), { status: 'ok', trigger: 'event' });
  assert.throws(() => sanitizeMetricLabels420({ authorization: 'secret' }), /AUT11_METRIC_SECRET_LABEL/);
  assert.throws(() => sanitizeMetricLabels420({ wallet: TARGET }), /AUT11_METRIC_HIGH_CARDINALITY/);
  const tooMany = Object.fromEntries(Array.from({ length: DEFAULT_AUT11_SECURITY_POLICY_420.maxMetricLabels + 1 }, (_, i) => [`label_${i}`, 'x']));
  assert.throws(() => sanitizeMetricLabels420(tooMany), /AUT11_METRIC_LABEL_LIMIT/);
});
