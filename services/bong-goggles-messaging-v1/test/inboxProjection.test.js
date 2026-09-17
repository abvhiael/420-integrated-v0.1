import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BongGogglesInboxProjector,
  paginateInbox,
  projectInboxItem,
  rebuildUnreadCount,
  sortInboxItems,
} from '../src/inboxProjection.js';

const A = '0x00000000000000000000000000000000000000aa';
const B = '0x00000000000000000000000000000000000000bb';
const C = '0x00000000000000000000000000000000000000cc';
const H1 = '0x' + '1'.repeat(64);
const H2 = '0x' + '2'.repeat(64);
const H3 = '0x' + '3'.repeat(64);
const H4 = '0x' + '4'.repeat(64);
const H5 = '0x' + '5'.repeat(64);

function conversation(id, a, b, requestedBy, state) {
  return { conversationId: id, a, b, requestedBy, state };
}

function envelope(messageId, conversationId, sender, sequence, committedAt) {
  return { messageId, conversationId, sender, sequence, committedAt };
}

test('projects incoming request and unread state from canonical records', () => {
  const item = projectInboxItem({
    conversation: conversation(H1, A, B, B, 'REQUESTED'),
    viewer: A,
    lastEnvelope: envelope(H2, H1, B, 1, 100),
    lastEnvelopeReceipt: { deliveredAt: 50, readAt: 0 },
    unreadCount: 1,
  });
  assert.equal(item.incomingRequest, true);
  assert.equal(item.outgoingRequest, false);
  assert.equal(item.unreadCount, 1);
  assert.equal(item.peer, B);
  assert.equal(item.lastMessageRead, false);
  assert.equal(item.authoritative, false);
});

test('fails closed on mismatched envelope conversation and invalid receipt ordering', () => {
  assert.throws(() => projectInboxItem({
    conversation: conversation(H1, A, B, A, 'ACTIVE'), viewer: A,
    lastEnvelope: envelope(H2, H3, B, 1, 100),
  }), /envelope conversation mismatch/);

  assert.throws(() => projectInboxItem({
    conversation: conversation(H1, A, B, A, 'ACTIVE'), viewer: A,
    lastEnvelope: envelope(H2, H1, B, 1, 100),
    lastEnvelopeReceipt: { deliveredAt: 0, readAt: 100 },
  }), /read receipt requires delivery receipt/);
});

test('rebuildUnreadCount ignores viewer-sent messages and counts unread inbound receipts', () => {
  const envelopes = [
    envelope(H2, H1, B, 1, 10),
    envelope(H3, H1, A, 1, 20),
    envelope(H4, H1, B, 2, 30),
  ];
  const receipts = {
    [H2]: { deliveredAt: 11, readAt: 12 },
    [H3]: { deliveredAt: 21, readAt: 21 },
    [H4]: { deliveredAt: 31, readAt: 0 },
  };
  assert.equal(rebuildUnreadCount({ envelopes, receiptsByMessageId: receipts, viewer: A }), 1);
});

test('sorts requests first then by latest canonical message time and deterministic id', () => {
  const items = [
    { conversationId: H3, incomingRequest: false, lastMessageAt: 300 },
    { conversationId: H1, incomingRequest: true, lastMessageAt: 10 },
    { conversationId: H2, incomingRequest: false, lastMessageAt: 300 },
  ];
  const sorted = sortInboxItems(items);
  assert.deepEqual(sorted.map((x) => x.conversationId), [H1, H2, H3]);
});

test('paginates deterministically by canonical conversation cursor', () => {
  const items = [
    { conversationId: H1, incomingRequest: false, lastMessageAt: 30 },
    { conversationId: H2, incomingRequest: false, lastMessageAt: 20 },
    { conversationId: H3, incomingRequest: false, lastMessageAt: 10 },
  ];
  const first = paginateInbox(items, { limit: 2 });
  assert.deepEqual(first.items.map((x) => x.conversationId), [H1, H2]);
  assert.equal(first.nextCursor, H2);
  const second = paginateInbox(items, { limit: 2, cursor: first.nextCursor });
  assert.deepEqual(second.items.map((x) => x.conversationId), [H3]);
  assert.equal(second.nextCursor, null);
});

test('rebuild is deterministic and reorg-safe because materialized state is derived from current canonical inputs', async () => {
  const conversations = [
    conversation(H1, A, B, A, 'ACTIVE'),
    conversation(H5, A, C, C, 'REQUESTED'),
  ];
  const messages = {
    [H1]: [envelope(H2, H1, B, 1, 100), envelope(H3, H1, A, 1, 200)],
    [H5]: [],
  };
  const receipts = {
    [H2]: { deliveredAt: 110, readAt: 0 },
    [H3]: { deliveredAt: 210, readAt: 210 },
  };
  const projector = new BongGogglesInboxProjector({
    listConversations: async () => conversations,
    listEnvelopes: async (id) => messages[id] ?? [],
    readReceipt: async (id) => receipts[id] ?? { deliveredAt: 0, readAt: 0 },
  });

  const first = await projector.rebuild(A);
  const second = await projector.rebuild(A);
  assert.deepEqual(first, second);
  assert.equal(first[0].conversationId, H5);
  assert.equal(first[1].unreadCount, 1);

  // Simulate a canonical reorg/replay that removes the inbound message.
  messages[H1] = [envelope(H3, H1, A, 1, 200)];
  const rebuilt = await projector.rebuild(A);
  const active = rebuilt.find((x) => x.conversationId === H1);
  assert.equal(active.unreadCount, 0);
  assert.equal(active.lastMessageId, H3);
});
