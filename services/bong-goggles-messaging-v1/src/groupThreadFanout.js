import { createHash } from 'node:crypto';

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

function normalizeGroup(record) {
  const r = required(record, 'group');
  if (r.exists === false || r.active !== true) throw new Error('group unavailable');
  return Object.freeze({
    groupId: bytes32(r.groupId ?? r.group_id, 'group.groupId'),
    owner: address(r.owner, 'group.owner'),
    privacy: typeof r.privacy === 'number'
      ? ({ 0: 'PUBLIC', 1: 'PRIVATE', 2: 'HIDDEN' }[r.privacy] ?? null)
      : String(required(r.privacy, 'group.privacy')).trim().toUpperCase(),
  });
}

function normalizeMember(record, accountHint = null) {
  const r = required(record, 'groupMember');
  const account = address(r.account ?? accountHint, 'groupMember.account');
  const state = typeof r.state === 'number'
    ? ({ 0: 'NONE', 1: 'PENDING', 2: 'ACTIVE', 3: 'REMOVED' }[r.state] ?? null)
    : String(required(r.state, 'groupMember.state')).trim().toUpperCase();
  const role = typeof r.role === 'number'
    ? ({ 0: 'NONE', 1: 'MEMBER', 2: 'MODERATOR', 3: 'ADMIN', 4: 'OWNER' }[r.role] ?? null)
    : String(required(r.role, 'groupMember.role')).trim().toUpperCase();
  if (!['NONE', 'PENDING', 'ACTIVE', 'REMOVED'].includes(state)) throw new Error('invalid group member state');
  if (!['NONE', 'MEMBER', 'MODERATOR', 'ADMIN', 'OWNER'].includes(role)) throw new Error('invalid group member role');
  return Object.freeze({ account, state, role });
}

export function computeMembershipDigest(groupId, members) {
  const id = bytes32(groupId, 'groupId');
  const active = members
    .map((m) => normalizeMember(m))
    .filter((m) => m.state === 'ACTIVE')
    .sort((a, b) => a.account.localeCompare(b.account));
  const encoded = [id, ...active.map((m) => `${m.account}:${m.role}`)].join('|');
  return `0x${createHash('sha256').update(encoded).digest('hex')}`;
}

export function normalizeGroupThreadDescriptor(input) {
  const r = required(input, 'groupThread');
  const members = [...required(r.members, 'groupThread.members')].map((m) => address(m, 'groupThread.member'));
  const unique = [...new Set(members)].sort();
  if (unique.length < 2 || unique.length !== members.length) throw new Error('invalid group thread members');
  return Object.freeze({
    threadId: bytes32(r.threadId ?? r.thread_id, 'groupThread.threadId'),
    groupId: bytes32(r.groupId ?? r.group_id, 'groupThread.groupId'),
    epoch: positiveInt(r.epoch, 'groupThread.epoch'),
    epochCommitment: bytes32(r.epochCommitment ?? r.epoch_commitment, 'groupThread.epochCommitment'),
    membershipDigest: bytes32(r.membershipDigest ?? r.membership_digest, 'groupThread.membershipDigest'),
    members: Object.freeze(unique),
  });
}

export function validateGroupThreadAccess({ descriptor, group, canonicalMembers, viewer }) {
  const thread = normalizeGroupThreadDescriptor(descriptor);
  const canonicalGroup = normalizeGroup(group);
  const account = address(viewer, 'viewer');
  if (thread.groupId !== canonicalGroup.groupId) throw new Error('group thread group mismatch');

  const normalizedMembers = canonicalMembers.map((m) => normalizeMember(m));
  const activeMembers = normalizedMembers.filter((m) => m.state === 'ACTIVE');
  const activeSet = new Set(activeMembers.map((m) => m.account));
  if (!activeSet.has(account)) throw new Error('viewer is not an active group member');

  const digest = computeMembershipDigest(canonicalGroup.groupId, normalizedMembers);
  if (digest !== thread.membershipDigest) throw new Error('stale group thread membership epoch');
  if (thread.members.length !== activeMembers.length || thread.members.some((m) => !activeSet.has(m))) {
    throw new Error('group thread member set mismatch');
  }

  return Object.freeze({
    threadId: thread.threadId,
    groupId: thread.groupId,
    viewer: account,
    privacy: canonicalGroup.privacy,
    epoch: thread.epoch,
    epochCommitment: thread.epochCommitment,
    membershipDigest: thread.membershipDigest,
    memberCount: thread.members.length,
    authoritative: false,
  });
}

function normalizeDirectRoute(record, sender, recipient) {
  const r = required(record, 'directRoute');
  const conversationId = bytes32(r.conversationId ?? r.conversation_id, 'directRoute.conversationId');
  const privateContextId = bytes32(r.privateContextId ?? r.private_context_id, 'directRoute.privateContextId');
  const a = address(r.a, 'directRoute.a');
  const b = address(r.b, 'directRoute.b');
  const participants = new Set([a, b]);
  if (!participants.has(sender) || !participants.has(recipient)) throw new Error('direct route participant mismatch');
  if (r.conversationActive !== true) throw new Error('direct conversation unavailable');
  if (r.contextClosed === true) throw new Error('direct private context unavailable');
  if (r.blocked === true || r.canMessage !== true) throw new Error('direct message policy denied');
  return Object.freeze({
    recipient,
    conversationId,
    privateContextId,
    directEpoch: positiveInt(r.epoch, 'directRoute.epoch'),
    directEpochCommitment: bytes32(r.epochCommitment ?? r.epoch_commitment, 'directRoute.epochCommitment'),
  });
}

export function buildGroupFanoutPlan({ descriptor, group, canonicalMembers, sender, directRoutesByRecipient }) {
  const access = validateGroupThreadAccess({ descriptor, group, canonicalMembers, viewer: sender });
  const thread = normalizeGroupThreadDescriptor(descriptor);
  const account = address(sender, 'sender');
  const recipients = thread.members.filter((m) => m !== account);
  const routes = recipients.map((recipient) => normalizeDirectRoute(directRoutesByRecipient?.[recipient], account, recipient));

  return Object.freeze({
    threadId: access.threadId,
    groupId: access.groupId,
    sender: account,
    groupEpoch: access.epoch,
    groupEpochCommitment: access.epochCommitment,
    membershipDigest: access.membershipDigest,
    recipients: Object.freeze(routes),
    deliveryMode: 'DIRECT_MESSENGER_FANOUT',
    authoritative: false,
  });
}

export function requiresGroupEpochRotation({ descriptor, groupId, canonicalMembers }) {
  const thread = normalizeGroupThreadDescriptor(descriptor);
  const id = bytes32(groupId, 'groupId');
  if (thread.groupId !== id) throw new Error('group thread group mismatch');
  return computeMembershipDigest(id, canonicalMembers) !== thread.membershipDigest;
}

export class BongGogglesGroupThreadCoordinator {
  constructor({ readGroup, listActiveMembers, resolveDirectRoute }) {
    if (typeof readGroup !== 'function') throw new Error('readGroup required');
    if (typeof listActiveMembers !== 'function') throw new Error('listActiveMembers required');
    if (typeof resolveDirectRoute !== 'function') throw new Error('resolveDirectRoute required');
    this.readGroup = readGroup;
    this.listActiveMembers = listActiveMembers;
    this.resolveDirectRoute = resolveDirectRoute;
  }

  async prepareFanout({ descriptor, sender }) {
    const thread = normalizeGroupThreadDescriptor(descriptor);
    const account = address(sender, 'sender');
    const [group, canonicalMembers] = await Promise.all([
      this.readGroup(thread.groupId),
      this.listActiveMembers(thread.groupId),
    ]);
    validateGroupThreadAccess({ descriptor: thread, group, canonicalMembers, viewer: account });
    const routes = {};
    for (const recipient of thread.members) {
      if (recipient === account) continue;
      routes[recipient] = await this.resolveDirectRoute({ sender: account, recipient, groupId: thread.groupId });
    }
    return buildGroupFanoutPlan({ descriptor: thread, group, canonicalMembers, sender: account, directRoutesByRecipient: routes });
  }
}
