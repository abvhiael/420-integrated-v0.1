import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  AutomationFinalityGuard420,
  buildAutomationTransactionPlan420,
  deriveAutomationJobId420,
  digestExecutionEnvelope420,
  evaluateAutomationEligibility420,
  normalizeAutomationTrigger420,
  redactSecrets420,
  type AutomationJobRegistryEntry420,
} from '../src/index.js';

const calldata = '0x12345678aabbccdd';
const calldataHash = `0x${createHash('sha256').update(Buffer.from(calldata.slice(2), 'hex')).digest('hex')}`;
const trigger = normalizeAutomationTrigger420({ kind: 'manual', requesterPolicy: 'owner' });
const envelope = {
  target: '0x1111111111111111111111111111111111111111',
  selector: '0x12345678',
  calldataHash,
  nativeValueWei: 0n,
  gasLimit: 210000n,
};
const job = {
  chainId: 420n,
  jobId: '',
  protocolId: 'protocol.alpha',
  ownerId: 'owner.alpha',
  triggerClass: trigger.triggerClass,
  triggerRef: trigger.triggerRef,
  revision: 1,
  status: 'enabled' as const,
  envelope,
  createdAt: 1,
  updatedAt: 1,
};
job.jobId = deriveAutomationJobId420(job);
const entry: AutomationJobRegistryEntry420 = { job, envelopeDigest: digestExecutionEnvelope420(envelope) };
const chain = { chainId: 420n, headBlock: 120n, safeBlock: 115n, finalizedBlock: 110n, observedAtMs: 10_000 };

const worker = {
  workerId: 'worker.alpha',
  address: '0x2222222222222222222222222222222222222222',
  async signPlan() { return '0xdeadbeef'; },
};

test('AUT-11 cross-layer: spoofed manual trigger cannot create execution eligibility', () => {
  const spoofed = evaluateAutomationEligibility420({
    entry,
    trigger,
    observation: {
      nowMs: 10_001,
      chain,
      manuals: [{ requesterId: 'attacker', requesterRole: 'owner', requestId: 'request-1' }],
    },
  });
  assert.equal(spoofed.eligible, false);
  assert.equal(spoofed.reason, 'manual-request-missing');

  const legitimate = evaluateAutomationEligibility420({
    entry,
    trigger,
    observation: {
      nowMs: 10_001,
      chain,
      manuals: [{ requesterId: 'owner.alpha', requesterRole: 'owner', requestId: 'request-1' }],
    },
  });
  assert.equal(legitimate.eligible, true);
  assert.match(legitimate.occurrenceId ?? '', /^0x[0-9a-f]{64}$/);
});

test('AUT-11 cross-layer: consumed occurrence remains suppressed under repeated trigger delivery', () => {
  const first = evaluateAutomationEligibility420({
    entry,
    trigger,
    observation: {
      nowMs: 10_001,
      chain,
      manuals: [{ requesterId: 'owner.alpha', requesterRole: 'owner', requestId: 'request-race' }],
    },
  });
  assert.equal(first.eligible, true);
  assert.ok(first.occurrenceId);

  const repeated = evaluateAutomationEligibility420({
    entry,
    trigger,
    consumedOccurrenceIds: new Set([first.occurrenceId!]),
    observation: {
      nowMs: 10_002,
      chain,
      manuals: [
        { requesterId: 'owner.alpha', requesterRole: 'owner', requestId: 'request-race' },
        { requesterId: 'owner.alpha', requesterRole: 'owner', requestId: 'request-race' },
      ],
    },
  });
  assert.equal(repeated.eligible, false);
  assert.equal(repeated.reason, 'duplicate-suppressed');
  assert.equal(repeated.occurrenceId, first.occurrenceId);
});

test('AUT-11 cross-layer: trigger eligibility cannot mutate immutable execution intent', async () => {
  const eligibility = evaluateAutomationEligibility420({
    entry,
    trigger,
    observation: {
      nowMs: 10_001,
      chain,
      manuals: [{ requesterId: 'owner.alpha', requesterRole: 'owner', requestId: 'request-plan' }],
    },
  });
  assert.equal(eligibility.eligible, true);

  const plan = await buildAutomationTransactionPlan420({
    entry,
    eligibility,
    worker,
    calldataResolver: { async resolveCalldata() { return calldata; } },
  });
  assert.equal(plan.to, envelope.target);
  assert.equal(plan.data, calldata);
  assert.equal(plan.valueWei, envelope.nativeValueWei);
  assert.equal(plan.gasLimit, envelope.gasLimit);

  await assert.rejects(
    buildAutomationTransactionPlan420({
      entry,
      eligibility,
      worker,
      calldataResolver: { async resolveCalldata() { return '0x12345678ffffffff'; } },
    }),
    /AUT4_CALLDATA_HASH_MISMATCH/,
  );
});

test('AUT-11 cross-layer: finalized-chain conflict fails closed before further trust', () => {
  const finality = new AutomationFinalityGuard420();
  const hashA = `0x${'aa'.repeat(32)}`;
  const hashB = `0x${'bb'.repeat(32)}`;
  finality.observe({ chainId: 420n, headBlock: 120n, safeBlock: 115n, finalizedBlock: 110n, finalizedHash: hashA });
  assert.throws(
    () => finality.observe({ chainId: 420n, headBlock: 121n, safeBlock: 116n, finalizedBlock: 110n, finalizedHash: hashB }),
    /AUT11_FINALITY_CONFLICT/,
  );
});

test('AUT-11 cross-layer: hostile diagnostic payloads are redacted before operator output', () => {
  const diagnostic = redactSecrets420({
    requestId: 'request-1',
    token: 'super-secret-token',
    nested: {
      authorization: 'Bearer abc',
      privateKey: `0x${'44'.repeat(32)}`,
      status: 'rejected',
    },
  });
  assert.deepEqual(diagnostic, {
    requestId: 'request-1',
    token: '[redacted]',
    nested: {
      authorization: '[redacted]',
      privateKey: '[redacted]',
      status: 'rejected',
    },
  });
});
