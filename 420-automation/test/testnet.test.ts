import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REQUIRED_AUT12_TRIGGER_CLASSES_420,
  buildAutomation12CloseoutReport420,
  validateAutomation12Environment420,
  type Automation12DeploymentEvidence420,
  type Automation12TestnetEnvironment420,
} from '../src/testnet.js';

const genesis = `0x${'11'.repeat(32)}`;
const digestA = `sha256:${'22'.repeat(32)}`;
const digestB = `sha256:${'33'.repeat(32)}`;
const jobA = `0x${'aa'.repeat(32)}`;
const jobB = `0x${'bb'.repeat(32)}`;

function environment(overrides: Partial<Automation12TestnetEnvironment420> = {}): Automation12TestnetEnvironment420 {
  return {
    chainId: 420n,
    environment: 'testnet',
    expectedGenesisHash: genesis,
    publicAutomationUrl: 'https://automation.testnet.420.invalid/v1',
    rpcProviderIds: ['rpc-a', 'rpc-b'],
    oracleProviderIds: ['oracle-a'],
    ...overrides,
  };
}

function evidence(overrides: Partial<Automation12DeploymentEvidence420> = {}): Automation12DeploymentEvidence420 {
  return {
    automationRevision: '11458b32c06a69bf34205d56fcda2e73fe86c7d7',
    nodeRevision: 'node420-testnet-rc1',
    rpcRevision: 'rpc-testnet-rc1',
    oracleRevision: 'oracle-testnet-rc1',
    descriptorManifestDigest: digestA,
    compiledArtifactsDigest: digestB,
    observedChainId: 420n,
    observedGenesisHash: genesis,
    readinessReady: true,
    schedulerReady: true,
    liveWorkerIds: ['worker.alpha', 'worker.beta'],
    registeredJobIds: [jobA, jobB],
    witnessedTriggerClasses: [...REQUIRED_AUT12_TRIGGER_CLASSES_420],
    apiCompatibilityPassed: true,
    rpcCompatibilityPassed: true,
    oracleCompatibilityPassed: true,
    developerHubCompatibilityPassed: true,
    liveJobExecutionPassed: true,
    workerLeaseFailoverDrillPassed: true,
    replaySuppressionDrillPassed: true,
    ambiguousSubmissionRecoveryDrillPassed: true,
    wrongChainDrillPassed: true,
    finalityConflictDrillPassed: true,
    hostileObservationDrillPassed: true,
    resourceAbuseDrillPassed: true,
    authScopeDrillPassed: true,
    readinessRecoveryDrillPassed: true,
    telemetryRedactionPassed: true,
    ...overrides,
  };
}

test('AUT-12 accepts an internally complete synthetic public-testnet evidence set', () => {
  const report = buildAutomation12CloseoutReport420(environment(), evidence());
  assert.equal(report.decision, 'go');
  assert.deepEqual(report.blockers, []);
  assert.equal(report.automationOrigin, 'https://automation.testnet.420.invalid');
  assert.equal(report.liveWorkerCount, 2);
  assert.equal(report.registeredJobCount, 2);
  assert.equal(report.authoritative, false);
  assert.equal(report.launchAuthority, false);
});

test('AUT-12 requires HTTPS and rejects secret-bearing public endpoints', () => {
  const errors = validateAutomation12Environment420(environment({
    publicAutomationUrl: 'http://user:secret@automation.testnet.420.invalid/v1',
  }));
  assert.ok(errors.some((error) => error.includes('https:')));
});

test('AUT-12 fails closed on wrong chain or genesis evidence', () => {
  const report = buildAutomation12CloseoutReport420(environment(), evidence({
    observedChainId: 421n,
    observedGenesisHash: `0x${'44'.repeat(32)}`,
  }));
  assert.equal(report.decision, 'no-go');
  assert.ok(report.blockers.some((blocker) => blocker.includes('chain ID')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('genesis')));
});

test('AUT-12 requires concrete live worker and registered-job witnesses plus scheduler/readiness evidence', () => {
  const report = buildAutomation12CloseoutReport420(environment(), evidence({
    liveWorkerIds: [],
    registeredJobIds: [],
    schedulerReady: false,
    readinessReady: false,
  }));
  assert.equal(report.decision, 'no-go');
  assert.ok(report.blockers.some((blocker) => blocker.includes('live Automation worker witnesses')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('registered Automation job witnesses')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('scheduler')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('readiness')));
});

test('AUT-12 rejects duplicate worker witnesses and malformed job IDs', () => {
  const report = buildAutomation12CloseoutReport420(environment(), evidence({
    liveWorkerIds: ['worker.alpha', 'worker.alpha'],
    registeredJobIds: ['not-a-job-id'],
  }));
  assert.equal(report.decision, 'no-go');
  assert.ok(report.blockers.some((blocker) => blocker.includes('worker witnesses')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('job witnesses')));
});

test('AUT-12 requires compatibility witnesses for all trigger classes', () => {
  const report = buildAutomation12CloseoutReport420(environment(), evidence({
    witnessedTriggerClasses: REQUIRED_AUT12_TRIGGER_CLASSES_420.filter((value) => value !== 'oracle'),
  }));
  assert.equal(report.decision, 'no-go');
  assert.ok(report.blockers.includes('required trigger compatibility witness missing: oracle'));
});

test('AUT-12 requires cross-service compatibility evidence', () => {
  const report = buildAutomation12CloseoutReport420(environment(), evidence({
    apiCompatibilityPassed: false,
    rpcCompatibilityPassed: false,
    oracleCompatibilityPassed: false,
    developerHubCompatibilityPassed: false,
  }));
  assert.equal(report.decision, 'no-go');
  assert.ok(report.blockers.some((blocker) => blocker.includes('Automation API')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('420RPC')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('420Oracle')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('Developer Hub')));
});

test('AUT-12 requires failure drills, replay safety and ambiguous recovery', () => {
  const report = buildAutomation12CloseoutReport420(environment(), evidence({
    workerLeaseFailoverDrillPassed: false,
    replaySuppressionDrillPassed: false,
    ambiguousSubmissionRecoveryDrillPassed: false,
    wrongChainDrillPassed: false,
    finalityConflictDrillPassed: false,
  }));
  assert.equal(report.decision, 'no-go');
  assert.ok(report.blockers.some((blocker) => blocker.includes('lease failover')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('replay suppression')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('ambiguous submission')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('wrong-chain')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('finality-conflict')));
});

test('AUT-12 requires hostile-input, resource, auth, recovery and redaction drills', () => {
  const report = buildAutomation12CloseoutReport420(environment(), evidence({
    hostileObservationDrillPassed: false,
    resourceAbuseDrillPassed: false,
    authScopeDrillPassed: false,
    readinessRecoveryDrillPassed: false,
    telemetryRedactionPassed: false,
  }));
  assert.equal(report.decision, 'no-go');
  assert.ok(report.blockers.some((blocker) => blocker.includes('hostile observation')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('resource-abuse')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('credential/scope')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('readiness recovery')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('telemetry redaction')));
});

test('AUT-12 fails closed on missing release or artifact identity', () => {
  const report = buildAutomation12CloseoutReport420(environment(), evidence({
    automationRevision: 'bad',
    descriptorManifestDigest: '',
    compiledArtifactsDigest: '',
  }));
  assert.equal(report.decision, 'no-go');
  assert.ok(report.blockers.some((blocker) => blocker.includes('420Automation revision')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('descriptor manifest')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('compiled artifacts')));
});
