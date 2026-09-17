import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BongGogglesSafetyRecoveryService,
  assertMessagingCapability,
  buildContextCloseIntent,
  buildDeviceRevokeIntent,
  buildDeviceSetIntent,
  buildEpochRotationIntent,
  buildRecoveryPlan,
  evaluateMessagingCapability,
} from '../src/safetyDeviceRecovery.js';

const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const CONV = `0x${'aa'.repeat(32)}`;
const CTX = `0x${'bb'.repeat(32)}`;
const DEVICE = `0x${'cc'.repeat(32)}`;
const LOST = `0x${'dd'.repeat(32)}`;
const KEY = `0x${'11'.repeat(32)}`;
const EPOCH = `0x${'22'.repeat(32)}`;
const NEXT_EPOCH = `0x${'33'.repeat(32)}`;

const conversation = { conversationId: CONV, a: A, b: B, state: 'ACTIVE' };
const privateContext = {
  contextId: CTX,
  messengerConversationId: CONV,
  a: A,
  b: B,
  epoch: 4,
  epochCommitment: EPOCH,
  closed: false,
  exists: true,
};
const deviceKey = { keyCommitment: KEY, revision: 7, active: true };

function base(overrides = {}) {
  return {
    account: A,
    peer: B,
    deviceId: DEVICE,
    expectedDeviceRevision: 7,
    expectedEpoch: 4,
    expectedEpochCommitment: EPOCH,
    conversation,
    privateContext,
    deviceKey,
    accountActive: true,
    peerActive: true,
    blockedEither: false,
    canMessage: true,
    spamAllowed: true,
    ...overrides,
  };
}

test('allows current active device/context capability', () => {
  const result = evaluateMessagingCapability(base());
  assert.equal(result.eligible, true);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.deviceRevision, 7);
  assert.equal(result.epoch, 4);
});

test('fails closed after block, policy denial or spam denial', () => {
  assert.throws(() => assertMessagingCapability(base({ blockedEither: true })), /BLOCKED/);
  assert.throws(() => assertMessagingCapability(base({ canMessage: false })), /MESSAGE_POLICY_DENIED/);
  assert.throws(() => assertMessagingCapability(base({ spamAllowed: false })), /SPAM_POLICY_DENIED/);
});

test('fails closed on inactive profiles, conversation or context', () => {
  assert.throws(() => assertMessagingCapability(base({ accountActive: false })), /ACCOUNT_INACTIVE/);
  assert.throws(() => assertMessagingCapability(base({ peerActive: false })), /PEER_INACTIVE/);
  assert.throws(() => assertMessagingCapability(base({ conversation: { ...conversation, state: 'CLOSED' } })), /CONVERSATION_INACTIVE/);
  assert.throws(() => assertMessagingCapability(base({ privateContext: { ...privateContext, closed: true } })), /CONTEXT_INACTIVE/);
});

test('revoked or revised devices invalidate cached capability', () => {
  assert.throws(() => assertMessagingCapability(base({ deviceKey: { ...deviceKey, active: false, revision: 8 } })), /DEVICE_REVOKED/);
  assert.throws(() => assertMessagingCapability(base({ deviceKey: { ...deviceKey, revision: 8 } })), /STALE_DEVICE_REVISION/);
});

test('epoch rotation invalidates stale send/read capability', () => {
  assert.throws(() => assertMessagingCapability(base({ privateContext: { ...privateContext, epoch: 5, epochCommitment: NEXT_EPOCH } })), /STALE_PRIVATE_EPOCH/);
  const result = evaluateMessagingCapability(base({ expectedEpoch: 5, expectedEpochCommitment: NEXT_EPOCH, privateContext: { ...privateContext, epoch: 5, epochCommitment: NEXT_EPOCH } }));
  assert.equal(result.eligible, true);
});

test('builds wallet-authorized device/context intents without execution', () => {
  const set = buildDeviceSetIntent({ account: A, deviceId: DEVICE, keyCommitment: KEY });
  const revoke = buildDeviceRevokeIntent({ account: A, deviceId: DEVICE });
  const rotate = buildEpochRotationIntent({ actor: A, contextId: CTX, newEpochCommitment: NEXT_EPOCH });
  const close = buildContextCloseIntent({ actor: A, contextId: CTX });
  for (const intent of [set, revoke, rotate, close]) {
    assert.equal(intent.authorization, 'wallet');
    assert.equal(intent.signs, false);
    assert.equal(intent.executes, false);
  }
});

test('recovery plan stages surviving key, revocation and epoch rotation', () => {
  const plan = buildRecoveryPlan({
    account: A,
    survivingDeviceId: DEVICE,
    survivingKeyCommitment: KEY,
    lostDeviceIds: [LOST],
    contexts: [{ contextId: CTX }],
    nextEpochCommitments: { [CTX]: NEXT_EPOCH },
  });
  assert.deepEqual(plan.sequence, ['SET_SURVIVING_DEVICE', 'REVOKE_LOST_DEVICES', 'ROTATE_CONTEXT_EPOCHS']);
  assert.equal(plan.revokeLostDevices.length, 1);
  assert.equal(plan.rotateContexts.length, 1);
  assert.equal(plan.requiresFreshCanonicalReadAfterEachStage, true);
  assert.equal(plan.exposesKeyMaterial, false);
});

test('recovery plan refuses missing replacement epoch commitments', () => {
  assert.throws(() => buildRecoveryPlan({
    account: A,
    survivingDeviceId: DEVICE,
    survivingKeyCommitment: KEY,
    contexts: [{ contextId: CTX }],
    nextEpochCommitments: {},
  }), /missing recovery epoch commitment/);
});

test('service always re-reads current canonical safety state', async () => {
  let blocked = false;
  const service = new BongGogglesSafetyRecoveryService({
    readConversation: async () => conversation,
    readPrivateContext: async () => privateContext,
    readDeviceKey: async () => deviceKey,
    isProfileActive: async () => true,
    isBlockedEither: async () => blocked,
    canMessage: async () => true,
    spamAllowed: async () => true,
  });
  const allowed = await service.authorize({
    account: A,
    peer: B,
    conversationId: CONV,
    contextId: CTX,
    deviceId: DEVICE,
    expectedDeviceRevision: 7,
    expectedEpoch: 4,
    expectedEpochCommitment: EPOCH,
  });
  assert.equal(allowed.eligible, true);
  blocked = true;
  await assert.rejects(() => service.authorize({
    account: A,
    peer: B,
    conversationId: CONV,
    contextId: CTX,
    deviceId: DEVICE,
    expectedDeviceRevision: 7,
    expectedEpoch: 4,
    expectedEpochCommitment: EPOCH,
  }), /BLOCKED/);
});
