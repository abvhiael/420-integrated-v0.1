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

function nonNegativeInt(value, field) {
  const n = Number(value ?? 0);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`invalid ${field}`);
  return n;
}

function timestamp(value, field) {
  const n = Number(value ?? 0);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`invalid ${field}`);
  return n;
}

function normalizeState(value) {
  const state = typeof value === 'number'
    ? ({ 1: 'REQUESTED', 2: 'ACTIVE', 3: 'CLOSED' }[value] ?? null)
    : String(required(value, 'conversation.state')).trim().toUpperCase();
  if (!['REQUESTED', 'ACTIVE', 'CLOSED'].includes(state)) throw new Error('invalid conversation state');
  return state;
}

export function normalizeInboxConversation(record, viewer) {
  const r = required(record, 'conversation');
  const account = address(viewer, 'viewer');
  const a = address(r.a, 'conversation.a');
  const b = address(r.b, 'conversation.b');
  if (a === b) throw new Error('invalid conversation participants');
  if (account !== a && account !== b) throw new Error('viewer is not a conversation participant');
  const requestedBy = address(r.requestedBy ?? r.requested_by, 'conversation.requestedBy');
  if (requestedBy !== a && requestedBy !== b) throw new Error('requester is not a participant');
  const state = normalizeState(r.state);
  return Object.freeze({
    conversationId: bytes32(r.conversationId ?? r.conversation_id, 'conversation.conversationId'),
    a,
    b,
    peer: account === a ? b : a,
    requestedBy,
    state,
    incomingRequest: state === 'REQUESTED' && requestedBy !== account,
    outgoingRequest: state === 'REQUESTED' && requestedBy === account,
  });
}

export function normalizeEnvelopeSummary(record) {
  if (record === null || record === undefined) return null;
  const r = record;
  return Object.freeze({
    messageId: bytes32(r.messageId ?? r.message_id, 'envelope.messageId'),
    conversationId: bytes32(r.conversationId ?? r.conversation_id, 'envelope.conversationId'),
    sender: address(r.sender, 'envelope.sender'),
    sequence: nonNegativeInt(r.sequence, 'envelope.sequence'),
    committedAt: timestamp(r.committedAt ?? r.committed_at, 'envelope.committedAt'),
  });
}

export function normalizeReceipt(record) {
  if (record === null || record === undefined) return Object.freeze({ deliveredAt: 0, readAt: 0 });
  return Object.freeze({
    deliveredAt: timestamp(record.deliveredAt ?? record.delivered_at, 'receipt.deliveredAt'),
    readAt: timestamp(record.readAt ?? record.read_at, 'receipt.readAt'),
  });
}

export function projectInboxItem({ conversation, viewer, lastEnvelope = null, lastEnvelopeReceipt = null, unreadCount = 0 }) {
  const c = normalizeInboxConversation(conversation, viewer);
  const account = address(viewer, 'viewer');
  const envelope = normalizeEnvelopeSummary(lastEnvelope);
  const receipt = normalizeReceipt(lastEnvelopeReceipt);
  const unread = nonNegativeInt(unreadCount, 'unreadCount');

  if (envelope && envelope.conversationId !== c.conversationId) throw new Error('envelope conversation mismatch');
  if (envelope && envelope.sender !== c.a && envelope.sender !== c.b) throw new Error('envelope sender is not a participant');
  if (receipt.readAt > 0 && receipt.deliveredAt === 0) throw new Error('read receipt requires delivery receipt');

  const latestActivityAt = envelope?.committedAt ?? 0;
  return Object.freeze({
    conversationId: c.conversationId,
    peer: c.peer,
    state: c.state,
    incomingRequest: c.incomingRequest,
    outgoingRequest: c.outgoingRequest,
    unreadCount: unread,
    lastMessageId: envelope?.messageId ?? null,
    lastMessageSender: envelope?.sender ?? null,
    lastMessageSequence: envelope?.sequence ?? null,
    lastMessageAt: latestActivityAt || null,
    lastMessageDelivered: receipt.deliveredAt > 0,
    lastMessageRead: receipt.readAt > 0,
    viewerSentLast: envelope ? envelope.sender === account : false,
    authoritative: false,
  });
}

export function sortInboxItems(items) {
  return [...items].sort((x, y) => {
    const xr = x.incomingRequest ? 1 : 0;
    const yr = y.incomingRequest ? 1 : 0;
    if (xr !== yr) return yr - xr;
    const xt = x.lastMessageAt ?? 0;
    const yt = y.lastMessageAt ?? 0;
    if (xt !== yt) return yt - xt;
    return x.conversationId.localeCompare(y.conversationId);
  });
}

export function paginateInbox(items, { limit = 25, cursor = null } = {}) {
  const size = Number(limit);
  if (!Number.isSafeInteger(size) || size <= 0 || size > 100) throw new Error('invalid inbox page limit');
  const sorted = sortInboxItems(items);
  let start = 0;
  if (cursor !== null) {
    const id = bytes32(cursor, 'cursor');
    const idx = sorted.findIndex((item) => item.conversationId === id);
    if (idx < 0) throw new Error('invalid inbox cursor');
    start = idx + 1;
  }
  const page = sorted.slice(start, start + size);
  return Object.freeze({
    items: Object.freeze(page),
    nextCursor: start + size < sorted.length ? page[page.length - 1].conversationId : null,
    authoritative: false,
  });
}

export function rebuildUnreadCount({ envelopes = [], receiptsByMessageId = {}, viewer }) {
  const account = address(viewer, 'viewer');
  let count = 0;
  for (const raw of envelopes) {
    const envelope = normalizeEnvelopeSummary(raw);
    if (envelope.sender === account) continue;
    const receipt = normalizeReceipt(receiptsByMessageId[envelope.messageId]);
    if (receipt.readAt === 0) count += 1;
  }
  return count;
}

export class BongGogglesInboxProjector {
  constructor({ listConversations, listEnvelopes, readReceipt }) {
    if (typeof listConversations !== 'function') throw new Error('listConversations required');
    if (typeof listEnvelopes !== 'function') throw new Error('listEnvelopes required');
    if (typeof readReceipt !== 'function') throw new Error('readReceipt required');
    this.listConversations = listConversations;
    this.listEnvelopes = listEnvelopes;
    this.readReceipt = readReceipt;
  }

  async rebuild(viewer) {
    const account = address(viewer, 'viewer');
    const conversations = await this.listConversations(account);
    const items = [];
    for (const rawConversation of conversations) {
      const c = normalizeInboxConversation(rawConversation, account);
      const envelopes = (await this.listEnvelopes(c.conversationId))
        .map(normalizeEnvelopeSummary)
        .sort((a, b) => a.committedAt - b.committedAt || a.sequence - b.sequence || a.messageId.localeCompare(b.messageId));
      const receipts = {};
      for (const envelope of envelopes) receipts[envelope.messageId] = normalizeReceipt(await this.readReceipt(envelope.messageId));
      const lastEnvelope = envelopes.at(-1) ?? null;
      const unreadCount = rebuildUnreadCount({ envelopes, receiptsByMessageId: receipts, viewer: account });
      items.push(projectInboxItem({
        conversation: rawConversation,
        viewer: account,
        lastEnvelope,
        lastEnvelopeReceipt: lastEnvelope ? receipts[lastEnvelope.messageId] : null,
        unreadCount,
      }));
    }
    return Object.freeze(sortInboxItems(items));
  }
}
