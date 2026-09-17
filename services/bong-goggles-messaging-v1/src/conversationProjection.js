export const CONVERSATION_STATES = Object.freeze(['REQUESTED', 'ACTIVE', 'CLOSED']);

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`missing ${field}`);
  return value;
}

function address(value, field) {
  const normalized = String(required(value, field)).trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(normalized)) throw new Error(`invalid ${field}`);
  return normalized;
}

function bytes32(value, field) {
  const normalized = String(required(value, field)).trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(normalized)) throw new Error(`invalid ${field}`);
  return normalized;
}

export function normalizeConversation(record) {
  const r = required(record, 'conversation');
  const state = typeof r.state === 'number'
    ? ({ 1: 'REQUESTED', 2: 'ACTIVE', 3: 'CLOSED' }[r.state] ?? null)
    : String(required(r.state, 'conversation.state')).trim().toUpperCase();
  if (!CONVERSATION_STATES.includes(state)) throw new Error('invalid conversation state');
  const a = address(r.a, 'conversation.a');
  const b = address(r.b, 'conversation.b');
  if (a === b) throw new Error('invalid conversation participants');
  const requestedBy = address(r.requestedBy ?? r.requested_by, 'conversation.requestedBy');
  if (requestedBy !== a && requestedBy !== b) throw new Error('requester is not a participant');
  return Object.freeze({
    a,
    b,
    requestedBy,
    contextHash: bytes32(r.contextHash ?? r.context_hash, 'conversation.contextHash'),
    state,
    exists: r.exists !== false,
  });
}

export function normalizePrivateContext(record) {
  if (record === null || record === undefined) return null;
  const r = record;
  if (r.exists === false) return null;
  const a = address(r.a, 'privateContext.a');
  const b = address(r.b, 'privateContext.b');
  const epoch = Number(r.epoch);
  if (!Number.isSafeInteger(epoch) || epoch <= 0) throw new Error('invalid private context epoch');
  return Object.freeze({
    contextId: bytes32(r.contextId ?? r.context_id, 'privateContext.contextId'),
    messengerConversationId: bytes32(r.messengerConversationId ?? r.messenger_conversation_id, 'privateContext.messengerConversationId'),
    a,
    b,
    epoch,
    epochCommitment: bytes32(r.epochCommitment ?? r.epoch_commitment, 'privateContext.epochCommitment'),
    closed: r.closed === true,
    exists: true,
  });
}

function peerOf(conversation, viewer) {
  if (viewer === conversation.a) return conversation.b;
  if (viewer === conversation.b) return conversation.a;
  throw new Error('viewer is not a conversation participant');
}

export function projectConversation({
  conversationId,
  conversation,
  viewer,
  privateContext = null,
  blocked = false,
  canMessage = false,
}) {
  const id = bytes32(conversationId, 'conversationId');
  const c = normalizeConversation(conversation);
  if (!c.exists) throw new Error('conversation does not exist');
  const account = address(viewer, 'viewer');
  const peer = peerOf(c, account);
  const context = normalizePrivateContext(privateContext);

  if (context) {
    if (context.messengerConversationId !== id) throw new Error('private context conversation mismatch');
    const participants = new Set([context.a, context.b]);
    if (!participants.has(c.a) || !participants.has(c.b)) throw new Error('private context participant mismatch');
    if (c.state !== 'ACTIVE' && !context.closed) throw new Error('open private context requires active conversation');
  }

  const incomingRequest = c.state === 'REQUESTED' && c.requestedBy !== account;
  const outgoingRequest = c.state === 'REQUESTED' && c.requestedBy === account;
  const policyAllowsSend = c.state === 'ACTIVE' && blocked !== true && canMessage === true && context !== null && context.closed !== true;

  return Object.freeze({
    conversationId: id,
    viewer: account,
    peer,
    state: c.state,
    incomingRequest,
    outgoingRequest,
    canAccept: incomingRequest && blocked !== true,
    canClose: (c.state === 'REQUESTED' || c.state === 'ACTIVE'),
    canBindPrivateContext: c.state === 'ACTIVE' && blocked !== true && canMessage === true && context === null,
    canSend: policyAllowsSend,
    epoch: context?.epoch ?? null,
    privateContextId: context?.contextId ?? null,
    contextClosed: context?.closed ?? false,
    authoritative: false,
  });
}

export function buildConversationIntent({ action, actor, peer = null, conversationId = null, contextHash = null, epochCommitment = null }) {
  const account = address(actor, 'actor');
  const normalized = String(required(action, 'action')).trim().toLowerCase();
  switch (normalized) {
    case 'request':
      return Object.freeze({
        contract: 'MessengerConversationRegistry420',
        method: 'request',
        args: [account, address(peer, 'peer'), bytes32(contextHash, 'contextHash')],
        requiresWalletAuthorization: true,
        authoritative: false,
      });
    case 'accept':
      return Object.freeze({
        contract: 'MessengerConversationRegistry420',
        method: 'accept',
        args: [bytes32(conversationId, 'conversationId'), account],
        requiresWalletAuthorization: true,
        authoritative: false,
      });
    case 'close':
      return Object.freeze({
        contract: 'MessengerConversationRegistry420',
        method: 'close',
        args: [bytes32(conversationId, 'conversationId'), account],
        requiresWalletAuthorization: true,
        authoritative: false,
      });
    case 'bind-private-context':
      return Object.freeze({
        contract: 'BongGogglesPrivateMessaging420',
        method: 'bindDirectContext',
        args: [account, address(peer, 'peer'), bytes32(conversationId, 'conversationId'), bytes32(epochCommitment, 'epochCommitment')],
        requiresWalletAuthorization: true,
        authoritative: false,
      });
    default:
      throw new Error('unsupported conversation action');
  }
}

export class BongGogglesConversationResolver {
  constructor({ readConversation, readPrivateContext = null, isBlockedEither, canMessage }) {
    if (typeof readConversation !== 'function') throw new Error('readConversation required');
    if (readPrivateContext !== null && typeof readPrivateContext !== 'function') throw new Error('readPrivateContext must be a function');
    if (typeof isBlockedEither !== 'function') throw new Error('isBlockedEither required');
    if (typeof canMessage !== 'function') throw new Error('canMessage required');
    this.readConversation = readConversation;
    this.readPrivateContext = readPrivateContext;
    this.isBlockedEither = isBlockedEither;
    this.canMessage = canMessage;
  }

  async resolve({ conversationId, viewer, privateContextId = null }) {
    const id = bytes32(conversationId, 'conversationId');
    const account = address(viewer, 'viewer');
    const conversation = normalizeConversation(await this.readConversation(id));
    const peer = peerOf(conversation, account);
    const [blocked, messageAllowed, privateContext] = await Promise.all([
      this.isBlockedEither(account, peer),
      this.canMessage(account, peer),
      privateContextId && this.readPrivateContext ? this.readPrivateContext(bytes32(privateContextId, 'privateContextId')) : null,
    ]);
    return projectConversation({ conversationId: id, conversation, viewer: account, privateContext, blocked, canMessage: messageAllowed });
  }
}
