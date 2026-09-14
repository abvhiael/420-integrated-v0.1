import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVerificationControlView420,
  createVerificationPlan420,
  recordVerificationResult420,
  submitVerification420,
  validateVerificationEvidence420,
  VerificationControlError420
} from '../src/verification-control.mjs';

const ADDRESS = '0x2222222222222222222222222222222222222222';
const RUNTIME_HASH = `0x${'aa'.repeat(32)}`;
const CREATION_HASH = `0x${'bb'.repeat(32)}`;

function network420(overrides = {}) {
  const services = { verify: 'https://verify.testnet.example' };
  return {
    name: '420 Integrated Testnet',
    environment: 'testnet',
    chainIdDecimal: '420',
    service: (name) => services[name] ?? null,
    ...overrides
  };
}

function evidence420(overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    chainId: '420',
    address: ADDRESS,
    runtimeCodeHash: RUNTIME_HASH,
    creationBytecodeHash: CREATION_HASH,
    sourceBundle: {
      format: 'solidity-standard-json',
      path: 'contracts/verification/Example420.standard-input.json',
      sha256: 'cc'.repeat(32)
    },
    compiler: {
      version: '0.8.30+commit.73712a01',
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'cancun',
      viaIR: false,
      metadataHashMode: 'ipfs'
    },
    constructorArgs: 'UNKNOWN',
    libraries: {},
    proxy: { role: 'none', relatedAddress: null },
    ...overrides
  };
}

test('verification evidence preserves canonical subject and reproducible build inputs', () => {
  const evidence = validateVerificationEvidence420(evidence420());
  assert.equal(evidence.chainId, '420');
  assert.equal(evidence.address, ADDRESS);
  assert.equal(evidence.runtimeCodeHash, RUNTIME_HASH);
  assert.equal(evidence.sourceBundle.format, 'solidity-standard-json');
  assert.equal(evidence.compiler.optimizer.runs, 200);
  assert.equal(Object.isFrozen(evidence), true);
});

test('verification evidence rejects unsupported fields, unsafe paths and zero runtime hashes', () => {
  assert.throws(() => validateVerificationEvidence420({ ...evidence420(), privateKey: `0x${'11'.repeat(32)}` }), /unsupported field: privateKey/);
  assert.throws(() => validateVerificationEvidence420({ ...evidence420(), sourceBundle: { ...evidence420().sourceBundle, path: '../secret.json' } }), VerificationControlError420);
  assert.throws(() => validateVerificationEvidence420({ ...evidence420(), runtimeCodeHash: `0x${'00'.repeat(32)}` }), /must not be zero/);
});

test('verification planning binds chain identity and the canonical 420Verify service', () => {
  const plan = createVerificationPlan420({ network: network420(), evidence: evidence420() });
  assert.equal(plan.status, 'READY_FOR_420VERIFY_SUBMISSION');
  assert.equal(plan.verificationAuthority, '420Verify');
  assert.equal(plan.service, 'https://verify.testnet.example');
  assert.equal(plan.subject.chainId, '420');
  assert.equal(plan.subject.address, ADDRESS);
  assert.equal(plan.subject.runtimeCodeHash, RUNTIME_HASH);
  assert.equal(plan.canonicalProtocolState, false);
  assert.equal(plan.verificationIsAudit, false);
  assert.equal(plan.verificationIsOfficialRegistration, false);
  assert.equal(plan.verificationGrantsWalletAuthority, false);
  assert.equal(plan.secretMaterialManaged, false);
});

test('chain mismatch, missing service and non-HTTP verify endpoints fail closed', () => {
  assert.throws(() => createVerificationPlan420({ network: network420(), evidence: evidence420({ chainId: '421' }) }), /does not match selected network/);
  assert.throws(() => createVerificationPlan420({ network: network420({ service: () => null }), evidence: evidence420() }), /no 420Verify service/);
  assert.throws(() => createVerificationPlan420({ network: network420({ service: () => 'file:\/\/\/tmp\/verify' }), evidence: evidence420() }), /must use HTTP\(S\)/);
});

test('verification result classes stay explicit and bind to the exact subject', () => {
  const plan = createVerificationPlan420({ network: network420(), evidence: evidence420() });
  for (const status of ['FULL_MATCH', 'PARTIAL_MATCH', 'MISMATCH', 'UNVERIFIABLE']) {
    const result = recordVerificationResult420(plan, {
      status,
      chainId: '420',
      address: ADDRESS,
      runtimeCodeHash: RUNTIME_HASH,
      ...(status === 'FULL_MATCH' ? {} : { reason: `${status} diagnostic` })
    });
    assert.equal(result.result.status, status);
    assert.equal(result.canonicalProtocolState, false);
    assert.equal(result.verificationIsAudit, false);
  }
});

test('non-full verification outcomes require diagnostic reasons', () => {
  const plan = createVerificationPlan420({ network: network420(), evidence: evidence420() });
  for (const status of ['PARTIAL_MATCH', 'MISMATCH', 'UNVERIFIABLE']) {
    assert.throws(() => recordVerificationResult420(plan, {
      status,
      chainId: '420',
      address: ADDRESS,
      runtimeCodeHash: RUNTIME_HASH
    }), /requires a diagnostic reason/);
  }
});

test('result binding rejects cross-chain, address and code-hash reuse', () => {
  const plan = createVerificationPlan420({ network: network420(), evidence: evidence420() });
  assert.throws(() => recordVerificationResult420(plan, { status: 'FULL_MATCH', chainId: '421', address: ADDRESS, runtimeCodeHash: RUNTIME_HASH }), /chainId does not match/);
  assert.throws(() => recordVerificationResult420(plan, { status: 'FULL_MATCH', chainId: '420', address: '0x3333333333333333333333333333333333333333', runtimeCodeHash: RUNTIME_HASH }), /address does not match/);
  assert.throws(() => recordVerificationResult420(plan, { status: 'FULL_MATCH', chainId: '420', address: ADDRESS, runtimeCodeHash: `0x${'dd'.repeat(32)}` }), /runtimeCodeHash does not match/);
});

test('submission uses only the canonical verification service and preserves 420Verify result semantics', async () => {
  const plan = createVerificationPlan420({ network: network420(), evidence: evidence420() });
  const calls = [];
  const state = await submitVerification420({
    plan,
    transport: {
      async request(endpoint, payload) {
        calls.push({ endpoint, payload });
        return {
          status: 'FULL_MATCH',
          chainId: '420',
          address: ADDRESS,
          runtimeCodeHash: RUNTIME_HASH,
          verificationId: 'ver-420'
        };
      }
    }
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].endpoint, 'https://verify.testnet.example');
  assert.equal(calls[0].payload.subject.runtimeCodeHash, RUNTIME_HASH);
  assert.equal(state.result.status, 'FULL_MATCH');
  assert.equal(state.verificationIsAudit, false);
  assert.equal(state.verificationIsOfficialRegistration, false);
});

test('control view never upgrades verification into protocol or wallet authority', () => {
  const plan = createVerificationPlan420({ network: network420(), evidence: evidence420() });
  const view = createVerificationControlView420(plan);
  assert.equal(view.nextAction, 'SUBMIT_TO_420VERIFY');
  assert.equal(view.verificationAuthority, '420Verify');
  assert.equal(view.canonicalProtocolState, false);
  assert.equal(view.verificationIsAudit, false);
  assert.equal(view.verificationIsOfficialRegistration, false);
  assert.equal(view.verificationGrantsWalletAuthority, false);
  assert.equal(view.secretMaterialManaged, false);
});
