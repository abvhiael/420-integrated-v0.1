const HEX32 = /^0x[0-9a-f]{64}$/;
const ADDRESS = /^0x[0-9a-f]{40}$/;

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`missing ${field}`);
  return value;
}

function bytes32(value, field) {
  const normalized = String(required(value, field)).trim().toLowerCase();
  if (!HEX32.test(normalized)) throw new Error(`invalid ${field}`);
  return normalized;
}

function address(value, field) {
  const normalized = String(required(value, field)).trim().toLowerCase();
  if (!ADDRESS.test(normalized)) throw new Error(`invalid ${field}`);
  return normalized;
}

function positiveSequence(value, field = 'sequence') {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`invalid ${field}`);
  return n;
}

function normalizeConversation(record) {
  const r = required(record, 'conversation');
  const state = typeof r.state === 'number'
    ? ({ 1: 'REQUESTED', 2: 'ACTIVE', 3: 'CLOSED' }[r.state] ?? null)
    : String(required(r.state, 'conversation.state')).trim().toUpperCase();
  if (state !== 'ACTIVE') throw new Error('conversation is not active');
  const a = address(r.a, 'conversation.a');
  const b = address(r.b, 'conversation.b');
  if (a === b) throw new Error('invalid conversation participants');
  return Object.freeze({ a, b, state });
}

function peerOf(conversation, sender) {
  if (sender === conversation.a) return conversation.b;
  if (sender === conversation.b) return conversation.a;
  throw new Error('sender is not a conversation participant');
}

function normalizeContext(record, conversationId, sender, recipient) {
  const r = required(record, 'privateContext');
  if (r.exists === false || r.closed === true) throw new Error('private context unavailable');
  const messengerConversationId = bytes32(
    r.messengerConversationId ?? r.messenger_conversation_id,
    'privateContext.messengerConversationId',
  );
  if (messengerConversationId !== conversationId) throw new Error('private context conversation mismatch');
  const a = address(r.a, 'privateContext.a');
  const b = address(r.b, 'privateContext.b');
  const participants = new Set([a, b]);
  if (!participants.has(sender) || !participants.has(recipient)) throw new Error('private context participant mismatch');
  const epoch = Number(r.epoch);
  if (!Number.isSafeInteger(epoch) || epoch <= 0) throw new Error('invalid private context epoch');
  return Object.freeze({
    contextId: bytes32(r.contextId ?? r.context_id, 'privateContext.contextId'),
    messengerConversationId,
    epoch,
    epochCommitment: bytes32(r.epochCommitment ?? r.epoch_commitment, 'privateContext.epochCommitment'),
  });
}

export function normalizeTransportEnvelope(input) {
  const r = required(input, 'transportEnvelope');
  const forbidden = ['plaintext', 'body', 'message', 'privateKey', 'sessionSecret', 'credential'];
  for (const field of forbidden) {
    if (r[field] !== undefined && r[field] !== null) throw new Error(`forbidden ${field}`);
  }
  return Object.freeze({
    conversationId: bytes32(r.conversationId ?? r.conversation_id, 'transportEnvelope.conversationId'),
    sender: address(r.sender, 'transportEnvelope.sender'),
    recipient: address(r.recipient, 'transportEnvelope.recipient'),
    sequence: positiveSequence(r.sequence),
    envelopeHash: bytes32(r.envelopeHash ?? r.envelope_hash, 'transportEnvelope.envelopeHash'),
    storageRefHash: bytes32(r.storageRefHash ?? r.storage_ref_hash, 'transportEnvelope.storageRefHash'),
    epoch: positiveSequence(r.epoch, 'transportEnvelope.epoch'),
    epochCommitment: bytes32(r.epochCommitment ?? r.epoch_commitment, 'transportEnvelope.epochCommitment'),
    ciphertextRef: String(required(r.ciphertextRef ?? r.ciphertext_ref, 'transportEnvelope.ciphertextRef')).trim(),
  });
}

export function validateOutboundEnvelope({
  transportEnvelope,
  conversation,
  privateContext,
  lastSequence = 0,
  blocked = false,
  canMessage = false,
}) {
  const envelope = normalizeTransportEnvelope(transportEnvelope);
  const canonicalConversation = normalizeConversation(conversation);
  const recipient = peerOf(canonicalConversation, envelope.sender);
  if (recipient !== envelope.recipient) throw new Error('recipient mismatch');
  if (blocked === true || canMessage !== true) throw new Error('message policy denied');
  const context = normalizeContext(privateContext, envelope.conversationId, envelope.sender, envelope.recipient);
  if (context.epoch !== envelope.epoch || context.epochCommitment !== envelope.epochCommitment) {
    throw new Error('private epoch mismatch');
  }
  const previous = Number(lastSequence);
  if (!Number.isSafeInteger(previous) || previous < 0) throw new Error('invalid last sequence');
  if (envelope.sequence !== previous + 1) throw new Error('invalid message sequence');
  if (envelope.ciphertextRef.length === 0 || envelope.ciphertextRef.length > 512) throw new Error('invalid ciphertext reference');

  return Object.freeze({
    ...envelope,
    privateContextId: context.contextId,
    authoritative: false,
  });
}

export function buildEnvelopeCommitIntent(validatedEnvelope) {
  const envelope = normalizeTransportEnvelope(validatedEnvelope);
  return Object.freeze({
    contract: 'MessengerEnvelopeRegistry420',
    method: 'commit',
    args: [
      envelope.sender,
      envelope.conversationId,
      envelope.sequence,
      envelope.envelopeHash,
      envelope.storageRefHash,
    ],
    requiresWalletAuthorization: true,
    authoritative: false,
  });
}

export function validateInboundEnvelope({
  canonicalEnvelope,
  conversation,
  privateContext,
  recipient,
  transportEnvelope,
  blocked = false,
  canMessage = false,
}) {
  const canonical = required(canonicalEnvelope, 'canonicalEnvelope');
  const transport = normalizeTransportEnvelope(transportEnvelope);
  const conversationId = bytes32(canonical.conversationId ?? canonical.conversation_id, 'canonicalEnvelope.conversationId');
  const sender = address(canonical.sender, 'canonicalEnvelope.sender');
  const sequence = positiveSequence(canonical.sequence, 'canonicalEnvelope.sequence');
  const envelopeHash = bytes32(canonical.envelopeHash ?? canonical.envelope_hash, 'canonicalEnvelope.envelopeHash');
  const storageRefHash = bytes32(canonical.storageRefHash ?? canonical.storage_ref_hash, 'canonicalEnvelope.storageRefHash');
  const account = address(recipient, 'recipient');
  const c = normalizeConversation(conversation);
  const expectedRecipient = peerOf(c, sender);
  if (expectedRecipient !== account) throw new Error('recipient is not canonical peer');
  if (blocked === true || canMessage !== true) throw new Error('message policy denied');
  const context = normalizeContext(privateContext, conversationId, sender, account);

  if (
    transport.conversationId !== conversationId ||
    transport.sender !== sender ||
    transport.recipient !== account ||
    transport.sequence !== sequence ||
    transport.envelopeHash !== envelopeHash ||
    transport.storageRefHash !== storageRefHash
  ) throw new Error('transport envelope does not match canonical commitment');
  if (transport.epoch !== context.epoch || transport.epochCommitment !== context.epochCommitment) {
    throw new Error('private epoch mismatch');
  }

  return Object.freeze({
    messageId: bytes32(canonical.messageId ?? canonical.message_id, 'canonicalEnvelope.messageId'),
    conversationId,
    sender,
    recipient: account,
    sequence,
    envelopeHash,
    storageRefHash,
    ciphertextRef: transport.ciphertextRef,
    epoch: context.epoch,
    privateContextId: context.contextId,
    authoritative: false,
  });
}

export function buildReceiptIntent({ recipient, messageId, markRead = false }) {
  return Object.freeze({
    contract: 'MessengerReceiptRegistry420',
    method: 'acknowledge',
    args: [address(recipient, 'recipient'), bytes32(messageId, 'messageId'), markRead === true],
    requiresWalletAuthorization: true,
    authoritative: false,
  });
}

export class BongGogglesEncryptedEnvelopeBridge {
  constructor({ readConversation, readPrivateContext, readLastSequence, isBlockedEither, canMessage }) {
    if (typeof readConversation !== 'function') throw new Error('readConversation required');
    if (typeof readPrivateContext !== 'function') throw new Error('readPrivateContext required');
    if (typeof readLastSequence !== 'function') throw new Error('readLastSequence required');
    if (typeof isBlockedEither !== 'function') throw new Error('isBlockedEither required');
    if (typeof canMessage !== 'function') throw new Error('canMessage required');
    this.readConversation = readConversation;
    this.readPrivateContext = readPrivateContext;
    this.readLastSequence = readLastSequence;
    this.isBlockedEither = isBlockedEither;
    this.canMessage = canMessage;
  }

  async prepareOutbound({ transportEnvelope, privateContextId }) {
    const envelope = normalizeTransportEnvelope(transportEnvelope);
    const [conversation, context, lastSequence, blocked, messageAllowed] = await Promise.all([
      this.readConversation(envelope.conversationId),
      this.readPrivateContext(bytes32(privateContextId, 'privateContextId')),
      this.readLastSequence(envelope.conversationId, envelope.sender),
      this.isBlockedEither(envelope.sender, envelope.recipient),
      this.canMessage(envelope.sender, envelope.recipient),
    ]);
    return validateOutboundEnvelope({
      transportEnvelope: envelope,
      conversation,
      privateContext: context,
      lastSequence,
      blocked,
      canMessage: messageAllowed,
    });
  }
}
