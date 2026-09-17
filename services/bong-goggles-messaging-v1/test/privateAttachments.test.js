import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BongGogglesPrivateAttachmentBridge,
  authorizePrivateAttachment,
  buildPrivateMediaAccess,
  normalizePrivateAttachmentDescriptor,
  validateAttachmentMediaIdentity,
} from '../src/privateAttachments.js';

const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const CID = `0x${'11'.repeat(32)}`;
const CTX = `0x${'22'.repeat(32)}`;
const EPOCH = `0x${'33'.repeat(32)}`;
const ATT = `0x${'44'.repeat(32)}`;
const ROOT = `0x${'55'.repeat(32)}`;
const MANIFEST = `0x${'66'.repeat(32)}`;
const MESSAGE = `0x${'77'.repeat(32)}`;

const attachment = {
  attachmentId: ATT,
  conversationId: CID,
  privateContextId: CTX,
  epoch: 3,
  epochCommitment: EPOCH,
  owner: A,
  manifestHash: MANIFEST,
  mediaRoot: ROOT,
  itemId: 'item-1',
  storageObjectId: 'object-1',
  messageId: MESSAGE,
  kind: 'image',
};

const conversation = { conversationId: CID, a: A, b: B, state: 'ACTIVE' };
const privateContext = {
  contextId: CTX,
  messengerConversationId: CID,
  a: A,
  b: B,
  epoch: 3,
  epochCommitment: EPOCH,
  exists: true,
  closed: false,
};
const mediaRecord = { mediaRoot: ROOT, manifestHash: MANIFEST, owner: A, exists: true };
const manifestDescriptor = {
  owner: A,
  mediaRoot: ROOT,
  items: [{ itemId: 'item-1', storageObject: { objectId: 'object-1' } }],
};

test('normalizes attachment identity and rejects secret/private route fields', () => {
  const normalized = normalizePrivateAttachmentDescriptor(attachment);
  assert.equal(normalized.kind, 'IMAGE');
  assert.equal(normalized.storageObjectId, 'object-1');
  assert.throws(() => normalizePrivateAttachmentDescriptor({ ...attachment, attachmentKey: 'secret' }), /forbidden/);
  assert.throws(() => normalizePrivateAttachmentDescriptor({ ...attachment, storageObjectId: 'https://provider/private' }), /canonical identity/);
});

test('requires exact BG-13 media/manifest/storage identity', () => {
  const result = validateAttachmentMediaIdentity({ attachment, mediaRecord, manifestDescriptor });
  assert.equal(result.attachment.mediaRoot, ROOT);
  assert.throws(() => validateAttachmentMediaIdentity({
    attachment,
    mediaRecord,
    manifestDescriptor: { ...manifestDescriptor, items: [{ itemId: 'item-1', storageObject: { objectId: 'wrong' } }] },
  }), /storage object mismatch/);
});

test('authorizes owner association only with active current conversation/context/epoch', async () => {
  const auth = await authorizePrivateAttachment({
    attachment,
    actor: A,
    conversation,
    privateContext,
    mediaRecord,
    manifestDescriptor,
    blocked: false,
    canMessage: true,
    operation: 'associate',
  });
  assert.equal(auth.operation, 'associate');
  assert.equal(auth.actor, A);
  await assert.rejects(() => authorizePrivateAttachment({
    attachment,
    actor: B,
    conversation,
    privateContext,
    mediaRecord,
    manifestDescriptor,
    blocked: false,
    canMessage: true,
    operation: 'associate',
  }), /association owner mismatch/);
});

test('both canonical participants may read while policy stays eligible', async () => {
  const auth = await authorizePrivateAttachment({
    attachment,
    actor: B,
    conversation,
    privateContext,
    mediaRecord,
    manifestDescriptor,
    blocked: false,
    canMessage: true,
    operation: 'read',
  });
  assert.equal(auth.peer, A);
  const access = buildPrivateMediaAccess({ authorization: auth, sessionId: 'session-123' });
  assert.deepEqual(access, { mode: 'private', subject: B, sessionId: 'session-123' });
});

test('fails closed after block, conversation close, context close or epoch rotation', async () => {
  const base = { attachment, actor: B, conversation, privateContext, mediaRecord, manifestDescriptor, blocked: false, canMessage: true, operation: 'read' };
  await assert.rejects(() => authorizePrivateAttachment({ ...base, blocked: true }), /policy denied/);
  await assert.rejects(() => authorizePrivateAttachment({ ...base, canMessage: false }), /policy denied/);
  await assert.rejects(() => authorizePrivateAttachment({ ...base, conversation: { ...conversation, state: 'CLOSED' } }), /not active/);
  await assert.rejects(() => authorizePrivateAttachment({ ...base, privateContext: { ...privateContext, closed: true } }), /unavailable/);
  await assert.rejects(() => authorizePrivateAttachment({ ...base, privateContext: { ...privateContext, epoch: 4 } }), /epoch mismatch/);
});

test('bridge re-reads canonical state on every authorization', async () => {
  let blocked = false;
  const bridge = new BongGogglesPrivateAttachmentBridge({
    readConversation: async () => conversation,
    readPrivateContext: async () => privateContext,
    readMediaRecord: async () => mediaRecord,
    readManifestDescriptor: async () => manifestDescriptor,
    isBlockedEither: async () => blocked,
    canMessage: async () => true,
  });
  const first = await bridge.authorize({ attachment, actor: B, operation: 'read' });
  assert.equal(first.actor, B);
  blocked = true;
  await assert.rejects(() => bridge.authorize({ attachment, actor: B, operation: 'read' }), /policy denied/);
});
