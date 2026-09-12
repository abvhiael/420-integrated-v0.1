import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REQUIRED_RPC12_METHODS_420,
  buildRpc12CloseoutReport420,
  validateRpc12Environment420,
  type Rpc12DeploymentEvidence420,
  type Rpc12TestnetEnvironment420,
} from '../src/testnet.js';

const genesis = `0x${'11'.repeat(32)}`;
const digestA = `sha256:${'22'.repeat(32)}`;
const digestB = `sha256:${'33'.repeat(32)}`;

function environment(overrides: Partial<Rpc12TestnetEnvironment420> = {}): Rpc12TestnetEnvironment420 {
  return {
    chainId: 420n,
    environment: 'testnet',
    expectedGenesisHash: genesis,
    publicHttpUrl: 'https://rpc.testnet.420.invalid/v1',
    publicWebsocketUrl: 'wss://rpc.testnet.420.invalid/ws',
    canonicalExecutionProviderIds: ['node420-a', 'node420-b'],
    indexerProviderIds: ['indexer-a'],
    ...overrides,
  };
}

function evidence(overrides: Partial<Rpc12DeploymentEvidence420> = {}): Rpc12DeploymentEvidence420 {
  return {
    rpcRevision: '533058ba2e75af5d315dee8cb3d7ac30ce01c6ac',
    nodeRevision: 'node420-testnet-rc1',
    indexerRevision: 'indexer-testnet-rc1',
    descriptorManifestDigest: digestA,
    compiledArtifactsDigest: digestB,
    observedChainId: 420n,
    observedGenesisHash: genesis,
    canonicalProviderCount: 2,
    derivedProviderCount: 1,
    readinessReady: true,
    supportedMethods: [...REQUIRED_RPC12_METHODS_420],
    httpSmokePassed: true,
    websocketSmokePassed: true,
    submissionSmokePassed: true,
    derivedReadSmokePassed: true,
    authSmokePassed: true,
    resourceLimitSmokePassed: true,
    failoverDrillPassed: true,
    wrongChainDrillPassed: true,
    finalityConflictDrillPassed: true,
    websocketLossDrillPassed: true,
    recoveryDrillPassed: true,
    telemetryRedactionPassed: true,
    ...overrides,
  };
}

test('RPC-12 accepts an internally complete synthetic testnet evidence set', () => {
  const report = buildRpc12CloseoutReport420(environment(), evidence());
  assert.equal(report.decision, 'go');
  assert.deepEqual(report.blockers, []);
  assert.equal(report.httpOrigin, 'https://rpc.testnet.420.invalid');
  assert.equal(report.websocketOrigin, 'wss://rpc.testnet.420.invalid');
  assert.equal(report.authoritative, false);
  assert.equal(report.launchAuthority, false);
});

test('RPC-12 requires TLS public endpoints and never accepts embedded credentials', () => {
  const errors = validateRpc12Environment420(environment({
    publicHttpUrl: 'http://user:secret@rpc.testnet.420.invalid',
    publicWebsocketUrl: 'ws://rpc.testnet.420.invalid/ws',
  }));
  assert.ok(errors.some((error) => error.includes('https:')));
  assert.ok(errors.some((error) => error.includes('wss:')));
});

test('RPC-12 fails closed on wrong chain or genesis evidence', () => {
  const report = buildRpc12CloseoutReport420(environment(), evidence({
    observedChainId: 421n,
    observedGenesisHash: `0x${'44'.repeat(32)}`,
  }));
  assert.equal(report.decision, 'no-go');
  assert.ok(report.blockers.some((blocker) => blocker.includes('chain ID')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('genesis')));
});

test('RPC-12 requires at least one canonical and one derived provider plus readiness', () => {
  const report = buildRpc12CloseoutReport420(environment(), evidence({
    canonicalProviderCount: 0,
    derivedProviderCount: 0,
    readinessReady: false,
  }));
  assert.equal(report.decision, 'no-go');
  assert.ok(report.blockers.some((blocker) => blocker.includes('canonical execution provider')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('derived/indexer provider')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('readiness')));
});

test('RPC-12 requires the public Ethereum compatibility witness set', () => {
  const report = buildRpc12CloseoutReport420(environment(), evidence({
    supportedMethods: REQUIRED_RPC12_METHODS_420.filter((method) => method !== 'eth_sendRawTransaction'),
  }));
  assert.equal(report.decision, 'no-go');
  assert.ok(report.blockers.includes('required public compatibility method not witnessed: eth_sendRawTransaction'));
});

test('RPC-12 requires failure and recovery drills, not only happy-path smoke', () => {
  const report = buildRpc12CloseoutReport420(environment(), evidence({
    wrongChainDrillPassed: false,
    finalityConflictDrillPassed: false,
    websocketLossDrillPassed: false,
    recoveryDrillPassed: false,
  }));
  assert.equal(report.decision, 'no-go');
  assert.ok(report.blockers.some((blocker) => blocker.includes('wrong-chain')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('finality-conflict')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('WebSocket')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('recovery')));
});

test('RPC-12 fails closed on missing release identity or artifact evidence', () => {
  const report = buildRpc12CloseoutReport420(environment(), evidence({
    rpcRevision: 'bad',
    descriptorManifestDigest: '',
    compiledArtifactsDigest: '',
  }));
  assert.equal(report.decision, 'no-go');
  assert.ok(report.blockers.some((blocker) => blocker.includes('420RPC revision')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('descriptor manifest')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('compiled artifacts')));
});

test('RPC-12 requires auth, resource protection and telemetry redaction evidence', () => {
  const report = buildRpc12CloseoutReport420(environment(), evidence({
    authSmokePassed: false,
    resourceLimitSmokePassed: false,
    telemetryRedactionPassed: false,
  }));
  assert.equal(report.decision, 'no-go');
  assert.ok(report.blockers.some((blocker) => blocker.includes('credential')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('resource')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('telemetry')));
});
