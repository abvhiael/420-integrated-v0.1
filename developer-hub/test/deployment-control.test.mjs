import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDeploymentControlView420,
  createDeploymentPlan420,
  DeploymentControlError420,
  recordDeploymentReceipt420,
  validateDeploymentRequest420
} from '../src/deployment-control.mjs';

const DEPLOYER = '0x1111111111111111111111111111111111111111';
const CONTRACT = '0x2222222222222222222222222222222222222222';
const TX = `0x${'ab'.repeat(32)}`;

function network420(overrides = {}) {
  const services = { verify: 'https://verify.testnet.example' };
  return {
    name: '420 Integrated Testnet',
    environment: 'testnet',
    chainIdDecimal: '420',
    rpc: { http: ['https://rpc.testnet.example'], websocket: [] },
    service: (name) => services[name] ?? null,
    ...overrides
  };
}

function request420(overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    project: 'example-app',
    chainId: '420',
    artifact: {
      contract: 'Example420',
      path: 'contracts/out/Example420.sol/Example420.json',
      sha256: 'a'.repeat(64)
    },
    deployer: DEPLOYER,
    executor: '420-wallet',
    constructorArgs: [],
    requestVerification: true,
    requestRegistration: false,
    ...overrides
  };
}

test('deployment request validates provenance and external signer metadata', () => {
  const request = validateDeploymentRequest420(request420());
  assert.equal(request.deployer, DEPLOYER);
  assert.equal(request.executor, '420-wallet');
  assert.equal(request.artifact.sha256, 'a'.repeat(64));
  assert.equal(Object.isFrozen(request), true);
});

test('deployment request rejects secret or unsupported fields', () => {
  assert.throws(() => validateDeploymentRequest420({ ...request420(), privateKey: `0x${'11'.repeat(32)}` }), /unsupported field: privateKey/);
  assert.throws(() => validateDeploymentRequest420({ ...request420(), mnemonic: 'do not accept this' }), /unsupported field: mnemonic/);
});

test('deployment request rejects unsafe artifact paths and zero provenance hashes', () => {
  assert.throws(() => validateDeploymentRequest420(request420({ artifact: { ...request420().artifact, path: '../secret.json' } })), DeploymentControlError420);
  assert.throws(() => validateDeploymentRequest420(request420({ artifact: { ...request420().artifact, sha256: '0'.repeat(64) } })), /must not be all zeroes/);
});

test('deployment plan binds exactly to selected network and canonical RPC', () => {
  const plan = createDeploymentPlan420({ network: network420(), request: request420() });
  assert.equal(plan.network.chainId, '420');
  assert.equal(plan.network.rpc, 'https://rpc.testnet.example');
  assert.equal(plan.status, 'READY_FOR_EXTERNAL_SIGNER');
  assert.equal(plan.secretMaterialManaged, false);
  assert.equal(plan.canonicalDeploymentProof, false);
  assert.equal(plan.verification.service, 'https://verify.testnet.example');
});

test('chain mismatch and absent verification service fail closed', () => {
  assert.throws(() => createDeploymentPlan420({ network: network420(), request: request420({ chainId: '421' }) }), /does not match selected network/);
  assert.throws(() => createDeploymentPlan420({ network: network420({ service: () => null }), request: request420() }), /no 420Verify service/);
});

test('DEVHUB-9 mainnet deployment is disabled', () => {
  assert.throws(() => createDeploymentPlan420({ network: network420({ environment: 'mainnet' }), request: request420() }), /mainnet deployment is disabled/);
});

test('deployment stages preserve wallet, RPC, verify and registry authority boundaries', () => {
  const plan = createDeploymentPlan420({ network: network420(), request: request420({ requestRegistration: true }) });
  const stages = Object.fromEntries(plan.stages.map((stage) => [stage.id, stage]));
  assert.equal(stages.deploy.authority, '420-wallet');
  assert.equal(stages.deploy.requiresExternalSignature, true);
  assert.equal(stages.receipt.authority, '420-chain-rpc');
  assert.equal(stages.verify.authority, '420Verify');
  assert.equal(stages.register.authority, '420Registry/420AppStore');
});

test('externally supplied receipt remains non-canonical until RPC confirmation', () => {
  const plan = createDeploymentPlan420({ network: network420(), request: request420() });
  const recorded = recordDeploymentReceipt420(plan, { transactionHash: TX, contractAddress: CONTRACT, chainId: '420' });
  assert.equal(recorded.status, 'RECEIPT_RECORDED_REQUIRES_RPC_CONFIRMATION');
  assert.equal(recorded.requiresRpcConfirmation, true);
  assert.equal(recorded.canonicalDeploymentProof, false);
  assert.equal(recorded.receipt.contractAddress, CONTRACT);
});

test('control view exposes next action without signer authority', () => {
  const plan = createDeploymentPlan420({ network: network420(), request: request420() });
  const view = createDeploymentControlView420(plan);
  assert.equal(view.nextAction, 'HAND_OFF_TO_EXTERNAL_SIGNER');
  assert.equal(view.secretMaterialManaged, false);
  assert.equal(view.canonicalDeploymentProof, false);
});
