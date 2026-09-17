import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BongGogglesConversationResolver,
  buildConversationIntent,
  normalizeConversation,
  projectConversation,
} from '../src/conversationProjection.js';

const A = `0x${'1'.repeat(40)}`;
const B = `0x${'2'.repeat(40)}`;
const ID = `0x${'a'.repeat(64)}`;
const HASH = `0x${'b'.repeat(64)}`;
const CTX = `0x${'c'.repeat(64)}`;
const EPOCH = `0x${'d'.repeat(64)}`;

function conversation(state = 'ACTIVE', requestedBy = A) {
  return { a: A, b: B, requestedBy, contextHash: HASH, state, exists: true };
}

function privateContext(overrides = {}) {
  return {
    contextId: CTX,
    messengerConversationId: ID,
    a: A,
    b: B,
    epoch: 2,
    epochCommitment: EPOCH,
    closed: false,
    exists: true,
    ...overrides,
  };
}

test('normalizes canonical messenger state without message payload fields', () => {
  const result = normalizeConversation({ ...conversation(), state: 2, plaintext: 'never project me', ciphertext: 'never project me' });
  assert.equal(result.state, 'ACTIVE');
  assert.equal('plaintext' in result, false);
  assert.equal('ciphertext' in result, false);
});

test('incoming request can be accepted but cannot send or bind a private context yet', () => {
  const view = projectConversation({ conversationId: ID, conversation: conversation('REQUESTED', B), viewer: A, blocked: false, canMessage: true });
  assert.equal(view.incomingRequest, true);
  assert.equal(view.canAccept, true);
  assert.equal(view.canBindPrivateContext, false);
  assert.equal(view.canSend, false);
});

test('active canonical conversation can bind private context only when current social policy allows it', () => {
  const allowed = projectConversation({ conversationId: ID, conversation: conversation(), viewer: A, blocked: false, canMessage: true });
  assert.equal(allowed.canBindPrivateContext, true);
  const blocked = projectConversation({ conversationId: ID, conversation: conversation(), viewer: A, blocked: true, canMessage: true });
  assert.equal(blocked.canBindPrivateContext, false);
});

test('bound active context exposes epoch and send eligibility but remains non-authoritative', () => {
  const view = projectConversation({ conversationId: ID, conversation: conversation(), viewer: B, privateContext: privateContext(), blocked: false, canMessage: true });
  assert.equal(view.canSend, true);
  assert.equal(view.epoch, 2);
  assert.equal(view.privateContextId, CTX);
  assert.equal(view.authoritative, false);
});

test('blocked, closed or policy-denied state fails send eligibility closed', () => {
  for (const input of [
    { blocked: true, canMessage: true, privateContext: privateContext() },
    { blocked: false, canMessage: false, privateContext: privateContext() },
    { blocked: false, canMessage: true, privateContext: privateContext({ closed: true }) },
  ]) {
    const view = projectConversation({ conversationId: ID, conversation: conversation(), viewer: A, ...input });
    assert.equal(view.canSend, false);
  }
});

test('private context must bind the exact canonical conversation and participants', () => {
  assert.throws(() => projectConversation({ conversationId: ID, conversation: conversation(), viewer: A, privateContext: privateContext({ messengerConversationId: HASH }), canMessage: true }), /conversation mismatch/);
  assert.throws(() => projectConversation({ conversationId: ID, conversation: conversation(), viewer: A, privateContext: privateContext({ b: `0x${'3'.repeat(40)}` }), canMessage: true }), /participant mismatch/);
});

test('wallet intents target canonical Messenger and Bong Goggles contracts and never self-execute', () => {
  const request = buildConversationIntent({ action: 'request', actor: A, peer: B, contextHash: HASH });
  assert.equal(request.contract, 'MessengerConversationRegistry420');
  assert.equal(request.method, 'request');
  assert.equal(request.requiresWalletAuthorization, true);
  assert.equal(request.authoritative, false);

  const bind = buildConversationIntent({ action: 'bind-private-context', actor: A, peer: B, conversationId: ID, epochCommitment: EPOCH });
  assert.equal(bind.contract, 'BongGogglesPrivateMessaging420');
  assert.equal(bind.method, 'bindDirectContext');
  assert.equal(bind.requiresWalletAuthorization, true);
});

test('resolver re-reads current block/message policy instead of caching permission', async () => {
  let blocked = false;
  let allowed = true;
  const resolver = new BongGogglesConversationResolver({
    readConversation: async () => conversation(),
    readPrivateContext: async () => privateContext(),
    isBlockedEither: async () => blocked,
    canMessage: async () => allowed,
  });
  assert.equal((await resolver.resolve({ conversationId: ID, viewer: A, privateContextId: CTX })).canSend, true);
  blocked = true;
  assert.equal((await resolver.resolve({ conversationId: ID, viewer: A, privateContextId: CTX })).canSend, false);
  blocked = false;
  allowed = false;
  assert.equal((await resolver.resolve({ conversationId: ID, viewer: A, privateContextId: CTX })).canSend, false);
});
