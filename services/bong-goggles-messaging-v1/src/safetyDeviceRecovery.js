const HEX32 = /^0x[0-9a-f]{64}$/;
const ADDRESS = /^0x[0-9a-f]{40}$/;

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`missing ${field}`);
  return value;
}

function address(value, field) {
  const normalized = String(required(value, field)).trim().toLowerCase();
  if (!ADDRESS.test(normalized)) throw new Error(`invalid ${field}`);
  return normalized;
}

function bytes32(value, field) {
  const normalized = String(required(value, field)).trim().toLowerCase();
  if (!HEX32.test(normalized)) throw new Error(`invalid ${field}`);
  return normalized;
}

function positiveInt(value, field) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`invalid ${field}`);
  return n;
}

function boolean(value, field) {
  if (typeof value !== 'boolean') throw new Error(`invalid ${field}`);
  return value;
}

function normalizeConversation(record, account, peer) {
  const r = required(record, 'conversation');
  const a = address(r.a, 'conversation.a');
  const b = address(r.b, 'conversation.b');
  const state = typeof r.state === 'number'
    ? ({ 1: 'REQUESTED', 2: 'ACTIVE', 3: 'CLOSED' }[r.state] ?? null)
    : String(required(r.state, 'conversation.state')).trim().toUpperCase();
  if (!['REQUESTED', 'ACTIVE', 'CLOSED'].includes(state)) throw new Error('invalid conversation state');
  if (!((a === account && b === peer) || (a === peer && b === account))) throw new Error('conversation participant mismatch');
  return Object.freeze({
    conversationId: bytes32(r.conversationId ?? r.conversation_id, 'conversation.conversationId'),
    a,
    b,
    state,
    active: state === 'ACTIVE',
  });
}

export function normalizeDeviceKeyRecord(record, { account, deviceId }) {
  const r = required(record, 'deviceKey');
  const owner = address(account, 'account');
  const id = bytes32(deviceId, 'deviceId');
  const keyCommitment = bytes32(r.keyCommitment ?? r.key_commitment, 'deviceKey.keyCommitment');
  const revision = positiveInt(r.revision, 'deviceKey.revision');
  const active = boolean(r.active, 'deviceKey.active');
  return Object.freeze({ account: owner, deviceId: id, keyCommitment, revision, active });
}

export function normalizeSafetyContext(record, { account, peer, conversationId }) {
  const r = required(record, 'privateContext');
  const owner = address(account, 'account');
  const other = address(peer, 'peer');
  const cid = bytes32(conversationId, 'conversationId');
  const a = address(r.a, 'privateContext.a');
  const b = address(r.b, 'privateContext.b');
  if (!((a === owner && b === other) || (a === other && b === owner))) throw new Error('private context participant mismatch');
  const messengerConversationId = bytes32(r.messengerConversationId ?? r.messenger_conversation_id, 'privateContext.messengerConversationId');
  if (messengerConversationId !== cid) throw new Error('private context conversation mismatch');
  return Object.freeze({
    contextId: bytes32(r.contextId ?? r.context_id, 'privateContext.contextId'),
    messengerConversationId,
    a,
    b,
    epoch: positiveInt(r.epoch, 'privateContext.epoch'),
    epochCommitment: bytes32(r.epochCommitment ?? r.epoch_commitment, 'privateContext.epochCommitment'),
    closed: Boolean(r.closed),
    exists: r.exists !== false,
  });
}

export function evaluateMessagingCapability({
  account,
  peer,
  deviceId,
  expectedDeviceRevision,
  expectedEpoch,
  expectedEpochCommitment,
  conversation,
  privateContext,
  deviceKey,
  accountActive,
  peerActive,
  blockedEither,
  canMessage,
  spamAllowed = true,
}) {
  const owner = address(account, 'account');
  const other = address(peer, 'peer');
  if (owner === other) throw new Error('peer must differ from account');
  const device = normalizeDeviceKeyRecord(deviceKey, { account: owner, deviceId });
  const c = normalizeConversation(conversation, owner, other);
  const ctx = normalizeSafetyContext(privateContext, { account: owner, peer: other, conversationId: c.conversationId });

  const reasons = [];
  if (accountActive !== true) reasons.push('ACCOUNT_INACTIVE');
  if (peerActive !== true) reasons.push('PEER_INACTIVE');
  if (!c.active) reasons.push('CONVERSATION_INACTIVE');
  if (!ctx.exists || ctx.closed) reasons.push('CONTEXT_INACTIVE');
  if (blockedEither === true) reasons.push('BLOCKED');
  if (canMessage !== true) reasons.push('MESSAGE_POLICY_DENIED');
  if (spamAllowed !== true) reasons.push('SPAM_POLICY_DENIED');
  if (!device.active) reasons.push('DEVICE_REVOKED');

  if (expectedDeviceRevision !== undefined && expectedDeviceRevision !== null) {
    const expected = positiveInt(expectedDeviceRevision, 'expectedDeviceRevision');
    if (device.revision !== expected) reasons.push('STALE_DEVICE_REVISION');
  }
  if (expectedEpoch !== undefined && expectedEpoch !== null) {
    const expected = positiveInt(expectedEpoch, 'expectedEpoch');
    if (ctx.epoch !== expected) reasons.push('STALE_PRIVATE_EPOCH');
  }
  if (expectedEpochCommitment !== undefined && expectedEpochCommitment !== null) {
    const expected = bytes32(expectedEpochCommitment, 'expectedEpochCommitment');
    if (ctx.epochCommitment !== expected) reasons.push('STALE_EPOCH_COMMITMENT');
  }

  return Object.freeze({
    account: owner,
    peer: other,
    conversationId: c.conversationId,
    contextId: ctx.contextId,
    deviceId: device.deviceId,
    deviceRevision: device.revision,
    epoch: ctx.epoch,
    epochCommitment: ctx.epochCommitment,
    eligible: reasons.length === 0,
    reasons: Object.freeze(reasons),
    authoritative: false,
  });
}

export function assertMessagingCapability(input) {
  const result = evaluateMessagingCapability(input);
  if (!result.eligible) throw new Error(`messaging capability denied: ${result.reasons.join(',')}`);
  return result;
}

export function buildDeviceSetIntent({ account, deviceId, keyCommitment }) {
  return Object.freeze({
    contract: 'BongGogglesPrivateMessaging420',
    method: 'setDeviceKey',
    args: [address(account, 'account'), bytes32(deviceId, 'deviceId'), bytes32(keyCommitment, 'keyCommitment')],
    authorization: 'wallet',
    signs: false,
    executes: false,
  });
}

export function buildDeviceRevokeIntent({ account, deviceId }) {
  return Object.freeze({
    contract: 'BongGogglesPrivateMessaging420',
    method: 'revokeDeviceKey',
    args: [address(account, 'account'), bytes32(deviceId, 'deviceId')],
    authorization: 'wallet',
    signs: false,
    executes: false,
  });
}

export function buildEpochRotationIntent({ actor, contextId, newEpochCommitment }) {
  return Object.freeze({
    contract: 'BongGogglesPrivateMessaging420',
    method: 'rotateEpoch',
    args: [address(actor, 'actor'), bytes32(contextId, 'contextId'), bytes32(newEpochCommitment, 'newEpochCommitment')],
    authorization: 'wallet',
    signs: false,
    executes: false,
  });
}

export function buildContextCloseIntent({ actor, contextId }) {
  return Object.freeze({
    contract: 'BongGogglesPrivateMessaging420',
    method: 'closeContext',
    args: [address(actor, 'actor'), bytes32(contextId, 'contextId')],
    authorization: 'wallet',
    signs: false,
    executes: false,
  });
}

export function buildRecoveryPlan({
  account,
  survivingDeviceId,
  survivingKeyCommitment,
  lostDeviceIds = [],
  contexts = [],
  nextEpochCommitments = {},
}) {
  const owner = address(account, 'account');
  const surviving = bytes32(survivingDeviceId, 'survivingDeviceId');
  const setSurvivor = buildDeviceSetIntent({ account: owner, deviceId: surviving, keyCommitment: survivingKeyCommitment });
  const revoke = lostDeviceIds.map((deviceId) => buildDeviceRevokeIntent({ account: owner, deviceId }));
  const rotations = contexts.map((raw) => {
    const contextId = bytes32(raw.contextId ?? raw.context_id, 'context.contextId');
    const commitment = nextEpochCommitments[contextId];
    if (!commitment) throw new Error(`missing recovery epoch commitment for ${contextId}`);
    return buildEpochRotationIntent({ actor: owner, contextId, newEpochCommitment: commitment });
  });
  return Object.freeze({
    setSurvivingDevice: setSurvivor,
    revokeLostDevices: Object.freeze(revoke),
    rotateContexts: Object.freeze(rotations),
    sequence: Object.freeze(['SET_SURVIVING_DEVICE', 'REVOKE_LOST_DEVICES', 'ROTATE_CONTEXT_EPOCHS']),
    requiresFreshCanonicalReadAfterEachStage: true,
    exposesKeyMaterial: false,
    authoritative: false,
  });
}

export class BongGogglesSafetyRecoveryService {
  constructor({
    readConversation,
    readPrivateContext,
    readDeviceKey,
    isProfileActive,
    isBlockedEither,
    canMessage,
    spamAllowed = async () => true,
  }) {
    for (const [name, fn] of Object.entries({ readConversation, readPrivateContext, readDeviceKey, isProfileActive, isBlockedEither, canMessage, spamAllowed })) {
      if (typeof fn !== 'function') throw new Error(`${name} required`);
    }
    this.readConversation = readConversation;
    this.readPrivateContext = readPrivateContext;
    this.readDeviceKey = readDeviceKey;
    this.isProfileActive = isProfileActive;
    this.isBlockedEither = isBlockedEither;
    this.canMessage = canMessage;
    this.spamAllowed = spamAllowed;
  }

  async authorize({ account, peer, conversationId, contextId, deviceId, expectedDeviceRevision = null, expectedEpoch = null, expectedEpochCommitment = null }) {
    const owner = address(account, 'account');
    const other = address(peer, 'peer');
    const cid = bytes32(conversationId, 'conversationId');
    const ctxId = bytes32(contextId, 'contextId');
    const did = bytes32(deviceId, 'deviceId');
    const [conversation, privateContext, deviceKey, accountActive, peerActive, blockedEither, messageAllowed, spamAllowed] = await Promise.all([
      this.readConversation(cid),
      this.readPrivateContext(ctxId),
      this.readDeviceKey(owner, did),
      this.isProfileActive(owner),
      this.isProfileActive(other),
      this.isBlockedEither(owner, other),
      this.canMessage(owner, other),
      this.spamAllowed(owner, other),
    ]);
    return assertMessagingCapability({
      account: owner,
      peer: other,
      deviceId: did,
      expectedDeviceRevision,
      expectedEpoch,
      expectedEpochCommitment,
      conversation,
      privateContext,
      deviceKey,
      accountActive,
      peerActive,
      blockedEither,
      canMessage: messageAllowed,
      spamAllowed,
    });
  }
}
