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

function positiveInt(value, field) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`invalid ${field}`);
  return n;
}

function opaqueId(value, field, max = 256) {
  const normalized = String(required(value, field)).trim().toLowerCase();
  if (!normalized || normalized.length > max) throw new Error(`invalid ${field}`);
  if (/^https?:\/\//i.test(normalized)) throw new Error(`${field} must be canonical identity, not a URL`);
  return normalized;
}

function rejectSecrets(record, prefix = 'attachment') {
  const forbidden = [
    'key', 'attachmentKey', 'decryptionKey', 'privateKey', 'token', 'credential', 'cookie',
    'sessionSecret', 'signedUrl', 'privateUrl', 'providerUrl', 'payload', 'body', 'plaintext', 'ciphertext',
  ];
  for (const field of forbidden) {
    if (record?.[field] !== undefined && record[field] !== null) throw new Error(`forbidden ${prefix}.${field}`);
  }
}

function normalizeConversation(record, conversationId, actor) {
  const r = required(record, 'conversation');
  const state = typeof r.state === 'number'
    ? ({ 1: 'REQUESTED', 2: 'ACTIVE', 3: 'CLOSED' }[r.state] ?? null)
    : String(required(r.state, 'conversation.state')).trim().toUpperCase();
  if (state !== 'ACTIVE') throw new Error('attachment conversation is not active');
  const a = address(r.a, 'conversation.a');
  const b = address(r.b, 'conversation.b');
  if (a === b || (actor !== a && actor !== b)) throw new Error('attachment actor is not a conversation participant');
  const id = bytes32(r.conversationId ?? r.conversation_id ?? conversationId, 'conversation.conversationId');
  if (id !== conversationId) throw new Error('attachment conversation mismatch');
  return Object.freeze({ conversationId: id, a, b, peer: actor === a ? b : a, state });
}

function normalizeContext(record, descriptor, conversation) {
  const r = required(record, 'privateContext');
  if (r.exists === false || r.closed === true) throw new Error('attachment private context unavailable');
  const contextId = bytes32(r.contextId ?? r.context_id, 'privateContext.contextId');
  if (contextId !== descriptor.privateContextId) throw new Error('attachment private context mismatch');
  const messengerConversationId = bytes32(
    r.messengerConversationId ?? r.messenger_conversation_id,
    'privateContext.messengerConversationId',
  );
  if (messengerConversationId !== descriptor.conversationId || messengerConversationId !== conversation.conversationId) {
    throw new Error('attachment private context conversation mismatch');
  }
  const a = address(r.a, 'privateContext.a');
  const b = address(r.b, 'privateContext.b');
  if (new Set([a, b]).size !== 2 || ![a, b].includes(conversation.a) || ![a, b].includes(conversation.b)) {
    throw new Error('attachment private context participant mismatch');
  }
  const epoch = positiveInt(r.epoch, 'privateContext.epoch');
  const epochCommitment = bytes32(r.epochCommitment ?? r.epoch_commitment, 'privateContext.epochCommitment');
  if (epoch !== descriptor.epoch || epochCommitment !== descriptor.epochCommitment) throw new Error('attachment private epoch mismatch');
  return Object.freeze({ contextId, messengerConversationId, a, b, epoch, epochCommitment });
}

export function normalizePrivateAttachmentDescriptor(input) {
  const r = required(input, 'attachment');
  rejectSecrets(r);
  const kind = String(r.kind ?? 'MEDIA').trim().toUpperCase();
  if (!['MEDIA', 'DOCUMENT', 'AUDIO', 'VIDEO', 'IMAGE'].includes(kind)) throw new Error('invalid attachment kind');
  return Object.freeze({
    version: 'bg-private-attachment-v1',
    attachmentId: bytes32(r.attachmentId ?? r.attachment_id, 'attachment.attachmentId'),
    conversationId: bytes32(r.conversationId ?? r.conversation_id, 'attachment.conversationId'),
    privateContextId: bytes32(r.privateContextId ?? r.private_context_id, 'attachment.privateContextId'),
    epoch: positiveInt(r.epoch, 'attachment.epoch'),
    epochCommitment: bytes32(r.epochCommitment ?? r.epoch_commitment, 'attachment.epochCommitment'),
    owner: address(r.owner, 'attachment.owner'),
    manifestHash: bytes32(r.manifestHash ?? r.manifest_hash, 'attachment.manifestHash'),
    mediaRoot: bytes32(r.mediaRoot ?? r.media_root, 'attachment.mediaRoot'),
    itemId: opaqueId(r.itemId ?? r.item_id, 'attachment.itemId'),
    storageObjectId: opaqueId(r.storageObjectId ?? r.storage_object_id, 'attachment.storageObjectId'),
    messageId: r.messageId || r.message_id ? bytes32(r.messageId ?? r.message_id, 'attachment.messageId') : null,
    kind,
    authoritative: false,
  });
}

export function validateAttachmentMediaIdentity({ attachment, mediaRecord, manifestDescriptor }) {
  const a = normalizePrivateAttachmentDescriptor(attachment);
  const media = required(mediaRecord, 'mediaRecord');
  const manifest = required(manifestDescriptor, 'manifestDescriptor');
  const mediaRoot = bytes32(media.mediaRoot ?? media.media_root, 'mediaRecord.mediaRoot');
  const manifestHash = bytes32(media.manifestHash ?? media.manifest_hash, 'mediaRecord.manifestHash');
  const owner = address(media.owner, 'mediaRecord.owner');
  if (mediaRoot !== a.mediaRoot || manifestHash !== a.manifestHash || owner !== a.owner) {
    throw new Error('attachment media registry mismatch');
  }
  if (media.exists === false) throw new Error('attachment media record unavailable');

  const manifestOwner = address(manifest.owner, 'manifestDescriptor.owner');
  const manifestRoot = bytes32(manifest.mediaRoot ?? manifest.media_root, 'manifestDescriptor.mediaRoot');
  if (manifestOwner !== a.owner || manifestRoot !== a.mediaRoot) throw new Error('attachment manifest identity mismatch');
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  const item = items.find((candidate) => String(candidate.itemId ?? candidate.item_id).trim().toLowerCase() === a.itemId);
  if (!item) throw new Error('attachment item missing from manifest');
  const storageObject = item.storageObject ?? item.storage_object;
  if (!storageObject) throw new Error('attachment storage object missing');
  const objectId = opaqueId(storageObject.objectId ?? storageObject.object_id, 'manifestDescriptor.item.storageObject.objectId');
  if (objectId !== a.storageObjectId) throw new Error('attachment storage object mismatch');
  return Object.freeze({ attachment: a, item, authoritative: false });
}

export async function authorizePrivateAttachment({
  attachment,
  actor,
  conversation,
  privateContext,
  mediaRecord,
  manifestDescriptor,
  blocked = false,
  canMessage = false,
  operation = 'read',
}) {
  const a = normalizePrivateAttachmentDescriptor(attachment);
  const account = address(actor, 'actor');
  const op = String(operation).trim().toLowerCase();
  if (!['associate', 'read'].includes(op)) throw new Error('invalid attachment operation');
  const c = normalizeConversation(conversation, a.conversationId, account);
  if (blocked === true || canMessage !== true) throw new Error('attachment message policy denied');
  const context = normalizeContext(privateContext, a, c);
  const verifiedMedia = validateAttachmentMediaIdentity({ attachment: a, mediaRecord, manifestDescriptor });
  if (op === 'associate' && a.owner !== account) throw new Error('attachment association owner mismatch');

  return Object.freeze({
    attachment: a,
    actor: account,
    peer: c.peer,
    operation: op,
    privateContextId: context.contextId,
    mediaItem: verifiedMedia.item,
    authoritative: false,
  });
}

export function buildPrivateMediaAccess({ authorization, sessionId }) {
  const auth = required(authorization, 'authorization');
  if (auth.operation !== 'read') throw new Error('read authorization required');
  const session = String(required(sessionId, 'sessionId')).trim();
  if (!session || session.length > 256) throw new Error('invalid sessionId');
  return Object.freeze({ mode: 'private', subject: auth.actor, sessionId: session });
}

export class BongGogglesPrivateAttachmentBridge {
  constructor({ readConversation, readPrivateContext, readMediaRecord, readManifestDescriptor, isBlockedEither, canMessage }) {
    if (typeof readConversation !== 'function') throw new Error('readConversation required');
    if (typeof readPrivateContext !== 'function') throw new Error('readPrivateContext required');
    if (typeof readMediaRecord !== 'function') throw new Error('readMediaRecord required');
    if (typeof readManifestDescriptor !== 'function') throw new Error('readManifestDescriptor required');
    if (typeof isBlockedEither !== 'function') throw new Error('isBlockedEither required');
    if (typeof canMessage !== 'function') throw new Error('canMessage required');
    Object.assign(this, { readConversation, readPrivateContext, readMediaRecord, readManifestDescriptor, isBlockedEither, canMessage });
  }

  async authorize({ attachment, actor, operation = 'read' }) {
    const a = normalizePrivateAttachmentDescriptor(attachment);
    const account = address(actor, 'actor');
    const [conversation, privateContext, mediaRecord, manifestDescriptor] = await Promise.all([
      this.readConversation(a.conversationId),
      this.readPrivateContext(a.privateContextId),
      this.readMediaRecord(a.mediaRoot),
      this.readManifestDescriptor(a.manifestHash),
    ]);
    const peer = account === address(conversation.a, 'conversation.a')
      ? address(conversation.b, 'conversation.b')
      : address(conversation.a, 'conversation.a');
    const [blocked, allowed] = await Promise.all([
      this.isBlockedEither(account, peer),
      this.canMessage(account, peer),
    ]);
    return authorizePrivateAttachment({
      attachment: a,
      actor: account,
      conversation,
      privateContext,
      mediaRecord,
      manifestDescriptor,
      blocked,
      canMessage: allowed,
      operation,
    });
  }
}
