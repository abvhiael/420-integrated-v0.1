import test from 'node:test';
import assert from 'node:assert/strict';
import { BongGogglesModerationOperationsProjection } from '../src/moderationOperations.js';
import {
  buildModerationCaseWorkspace,
  prepareSafetyActionIntent,
  prepareSafetyActionRevocationIntent,
} from '../src/moderationCaseWorkspace.js';

function log(eventName, args, n = 1) {
  return { eventName, args, chainId: 420, blockNumber: n, blockHash: `0xblock${n}`, transactionHash: `0xtx${n}`, transactionIndex: 0, logIndex: 0 };
}
function workspaceWithAction() {
  const projection = new BongGogglesModerationOperationsProjection();
  projection.apply(log('ReportSubmitted', { reportId: 'r1', reporter: '0xreporter', subjectAccount: '0xsubject', targetType: 'PROFILE', targetId: 'p1', reasonCode: 'abuse' }, 1));
  projection.apply(log('CaseOpened', { caseId: 'c1', reportId: 'r1', operator: '0xop1', policyVersion: 'policy-v1' }, 2));
  projection.apply(log('SafetyActionApplied', { actionId: 'a1', caseId: 'c1', actionType: 'TEMP_ACCOUNT_RESTRICTION', operator: '0xop2', expiresAt: 2000 }, 3));
  return buildModerationCaseWorkspace(projection.snapshot(), 'c1');
}

test('workspace exposes chronological case detail plus active/latest action visibility', () => {
  const workspace = workspaceWithAction();
  assert.equal(workspace.latestAction.actionId, 'a1');
  assert.deepEqual(workspace.activeActions.map((item) => item.actionId), ['a1']);
  assert.equal(workspace.actionCounts.total, 1);
  assert.equal(workspace.actionCounts.active, 1);
  assert.deepEqual(workspace.timeline.map((item) => item.type), ['REPORT_SUBMITTED', 'CASE_OPENED', 'ACTION_APPLIED']);
  assert.equal(workspace.authoritative, false);
});

test('action preparation is capability gated, unsigned and Wallet-bound', async () => {
  const intent = await prepareSafetyActionIntent({
    workspace: workspaceWithAction(),
    actionType: 'RESTRICT_INTERACTION',
    rationaleHash: '0xrationale',
    expiresAt: 2000,
    now: 1000,
    deriveScope: async () => '0xscope',
    isAuthorized: async ({ actionId, scope }) => actionId === 'ACTION_SAFETY_ACTION_APPLY' && scope === '0xscope',
  });
  assert.deepEqual(intent.args, ['c1', 'RESTRICT_INTERACTION', '0xrationale', 2000]);
  assert.equal(intent.rationaleContentIncluded, false);
  assert.equal(intent.walletConfirmationRequired, true);
  assert.equal(intent.signed, false);
  assert.equal(intent.broadcast, false);
});

test('temporary action rejects absent or expired future window', async () => {
  await assert.rejects(() => prepareSafetyActionIntent({
    workspace: workspaceWithAction(),
    actionType: 'TEMP_ACCOUNT_RESTRICTION',
    rationaleHash: '0xrationale',
    expiresAt: 1000,
    now: 1000,
    deriveScope: async () => '0xscope',
    isAuthorized: async () => true,
  }), /future expiry/);
});

test('permanent account suspension remains unavailable from Bong Goggles workspace', async () => {
  await assert.rejects(() => prepareSafetyActionIntent({
    workspace: workspaceWithAction(),
    actionType: 'ACCOUNT_SUSPENSION',
    rationaleHash: '0xrationale',
    now: 1000,
    deriveScope: async () => '0xscope',
    isAuthorized: async () => true,
  }), /reserved/);
});

test('action application fails closed without capability', async () => {
  await assert.rejects(() => prepareSafetyActionIntent({
    workspace: workspaceWithAction(),
    actionType: 'RESTRICT_INTERACTION',
    rationaleHash: '0xrationale',
    expiresAt: 2000,
    now: 1000,
    deriveScope: async () => '0xscope',
    isAuthorized: async () => false,
  }), /lacks action-apply capability/);
});

test('active action revocation prepares canonical revokeAction intent', async () => {
  const intent = await prepareSafetyActionRevocationIntent({
    workspace: workspaceWithAction(),
    actionId: 'a1',
    deriveScope: async () => '0xscope',
    isAuthorized: async ({ actionId }) => actionId === 'ACTION_SAFETY_ACTION_REVOKE',
  });
  assert.deepEqual(intent.args, ['a1']);
  assert.equal(intent.method, 'revokeAction');
  assert.equal(intent.walletConfirmationRequired, true);
  assert.equal(intent.authoritative, false);
});

test('revocation rejects non-active projected action', async () => {
  const projection = new BongGogglesModerationOperationsProjection();
  projection.apply(log('ReportSubmitted', { reportId: 'r1', reporter: '0xreporter', subjectAccount: '0xsubject', targetType: 'PROFILE', targetId: 'p1', reasonCode: 'abuse' }, 1));
  projection.apply(log('CaseOpened', { caseId: 'c1', reportId: 'r1', operator: '0xop1', policyVersion: 'policy-v1' }, 2));
  projection.apply(log('SafetyActionApplied', { actionId: 'a1', caseId: 'c1', actionType: 'RESTRICT_INTERACTION', operator: '0xop2', expiresAt: 2000 }, 3));
  projection.apply(log('SafetyActionRevoked', { actionId: 'a1', caseId: 'c1', operator: '0xop3' }, 4));
  const workspace = buildModerationCaseWorkspace(projection.snapshot(), 'c1');
  await assert.rejects(() => prepareSafetyActionRevocationIntent({
    workspace, actionId: 'a1', deriveScope: async () => '0xscope', isAuthorized: async () => true,
  }), /active moderation action required/);
});
