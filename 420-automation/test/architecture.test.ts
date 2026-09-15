import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUTOMATION_ARCHITECTURE_420,
  AUTOMATION_ARCHITECTURE_VERSION_420,
  validateAutomationArchitecture420,
  type AutomationArchitecture420,
} from '../src/architecture.js';

test('AUT-0 default architecture is valid and pinned to chain 420', () => {
  assert.equal(AUTOMATION_ARCHITECTURE_420.version, AUTOMATION_ARCHITECTURE_VERSION_420);
  assert.equal(AUTOMATION_ARCHITECTURE_420.expectedChainId, 420n);
  assert.deepEqual(validateAutomationArchitecture420(), []);
});

test('triggers never grant ambient execution authority', () => {
  assert.equal(AUTOMATION_ARCHITECTURE_420.triggerGrantsExecutionAuthority, false);
  assert.equal(AUTOMATION_ARCHITECTURE_420.oracleTriggerIsRemoteExecution, false);
  assert.equal(AUTOMATION_ARCHITECTURE_420.workerMayBypassProtocolAuthorization, false);
});

test('workers cannot custody user keys or sign user transactions', () => {
  assert.equal(AUTOMATION_ARCHITECTURE_420.workerMayCustodyUserKeys, false);
  assert.equal(AUTOMATION_ARCHITECTURE_420.workerMaySignUserTransactions, false);
});

test('workers cannot invent execution intent', () => {
  assert.equal(AUTOMATION_ARCHITECTURE_420.workerMayInventTarget, false);
  assert.equal(AUTOMATION_ARCHITECTURE_420.workerMayInventCalldata, false);
  assert.equal(AUTOMATION_ARCHITECTURE_420.workerMayInventValue, false);
});

test('automation cannot become chain, finality, bridge, or Engine authority', () => {
  assert.equal(AUTOMATION_ARCHITECTURE_420.workerMayDefineCanonicalChain, false);
  assert.equal(AUTOMATION_ARCHITECTURE_420.workerMayDefineFinality, false);
  assert.equal(AUTOMATION_ARCHITECTURE_420.bridgeProofsInterchangeableWithAutomation, false);
  assert.equal(AUTOMATION_ARCHITECTURE_420.engineApiPublic, false);
});

test('all planned trigger classes are explicit', () => {
  assert.deepEqual(AUTOMATION_ARCHITECTURE_420.supportedTriggerClasses, [
    'time',
    'block',
    'event',
    'oracle',
    'manual',
  ]);
});

test('validator fails closed when a forbidden authority is enabled', () => {
  const unsafe = {
    ...AUTOMATION_ARCHITECTURE_420,
    workerMayInventTarget: true,
  } as unknown as AutomationArchitecture420;

  assert.deepEqual(validateAutomationArchitecture420(unsafe), ['workerMayInventTarget must remain false']);
});

test('validator rejects wrong-chain configuration', () => {
  const unsafe = {
    ...AUTOMATION_ARCHITECTURE_420,
    expectedChainId: 1n,
  } as AutomationArchitecture420;

  assert.deepEqual(validateAutomationArchitecture420(unsafe), ['expectedChainId must be 420']);
});
