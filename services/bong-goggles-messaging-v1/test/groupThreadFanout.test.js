import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGroupFanoutPlan,
  computeMembershipDigest,
  requiresGroupEpochRotation,
  validateGroupThreadAccess,
} from '../src/groupThreadFanout.js';

const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const C = '0x3333333333333333333333333333333333333333';
const GROUP = `0x${'ab'.repeat(32)}`;
const THREAD = `0x${'cd'.repeat(32)}`;
const EPOCH = `0x${'ef'.repeat(32)}`;
const C1 = `0x${'01'.repeat(32)}`;
const C2 = `0x${'02'.repeat(32)}`;
const P1 = `0x${'11'.repeat(32)}`;
const P2 = `0x${'12'.repeat(32)}`;
const DE1 = `0x${'21'.repeat(32)}`;
const DE2 = `0x${'22'.repeat(32)}`;

const group = { groupId: GROUP, owner: A, privacy: 'PRIVATE', active: true, exists: true };
const members = [
  { account: A, state: 'ACTIVE', role: 'OWNER' },
  { account: B, state: 'ACTIVE', role: 'MEMBER' },
  { account: C, state: 'ACTIVE', role: 'MODERATOR' },
];

function descriptor(overrides = {}) {
  return {
    threadId: THREAD,
    groupId: GROUP,
    epoch: 3,
    epochCommitment: EPOCH,
    membershipDigest: computeMembershipDigest(GROUP, members),
    members: [A, B, C],
    ...overrides,
  };
}

function routes() {
  return {
    [B]: {
      conversationId: C1,
      privateContextId: P1,
      a: A,
      b: B,
      conversationActive: true,
      contextClosed: false,
      blocked: false,
      canMessage: true,
      epoch: 5,
      epochCommitment: DE1,
    },
    [C]: {
      conversationId: C2,
      privateContextId: P2,
      a: A,
      b: C,
      conversationActive: true,
      contextClosed: false,
      blocked: false,
      canMessage: true,
      epoch: 8,
      epochCommitment: DE2,
    },
  };
}

test('membership digest is deterministic regardless of member order', () => {
  assert.equal(
    computeMembershipDigest(GROUP, members),
    computeMembershipDigest(GROUP, [members[2], members[0], members[1]]),
  );
});

test('active group member may access a current group thread descriptor', () => {
  const projected = validateGroupThreadAccess({ descriptor: descriptor(), group, canonicalMembers: members, viewer: B });
  assert.equal(projected.groupId, GROUP);
  assert.equal(projected.epoch, 3);
  assert.equal(projected.memberCount, 3);
  assert.equal(projected.authoritative, false);
});

test('removed member is denied and membership change requires epoch rotation', () => {
  const changed = members.map((m) => m.account === C ? { ...m, state: 'REMOVED', role: 'NONE' } : m);
  assert.equal(requiresGroupEpochRotation({ descriptor: descriptor(), groupId: GROUP, canonicalMembers: changed }), true);
  assert.throws(
    () => validateGroupThreadAccess({ descriptor: descriptor(), group, canonicalMembers: changed, viewer: C }),
    /not an active group member|stale group thread membership epoch/,
  );
});

test('pending member cannot read a private group thread', () => {
  const pending = members.map((m) => m.account === B ? { ...m, state: 'PENDING', role: 'NONE' } : m);
  const d = descriptor({ membershipDigest: computeMembershipDigest(GROUP, pending), members: [A, C] });
  assert.throws(
    () => validateGroupThreadAccess({ descriptor: d, group, canonicalMembers: pending, viewer: B }),
    /not an active group member/,
  );
});

test('fanout plan uses one canonical direct Messenger/private route per peer', () => {
  const plan = buildGroupFanoutPlan({
    descriptor: descriptor(),
    group,
    canonicalMembers: members,
    sender: A,
    directRoutesByRecipient: routes(),
  });
  assert.equal(plan.deliveryMode, 'DIRECT_MESSENGER_FANOUT');
  assert.deepEqual(plan.recipients.map((r) => r.recipient), [B, C]);
  assert.equal(plan.recipients[0].conversationId, C1);
  assert.equal(plan.recipients[1].privateContextId, P2);
  assert.equal(plan.authoritative, false);
});

test('fanout fails closed if any direct route is blocked or unavailable', () => {
  const bad = routes();
  bad[C] = { ...bad[C], blocked: true };
  assert.throws(
    () => buildGroupFanoutPlan({ descriptor: descriptor(), group, canonicalMembers: members, sender: A, directRoutesByRecipient: bad }),
    /direct message policy denied/,
  );
});

test('descriptor cannot silently omit an active canonical member', () => {
  const d = descriptor({ members: [A, B] });
  assert.throws(
    () => validateGroupThreadAccess({ descriptor: d, group, canonicalMembers: members, viewer: A }),
    /member set mismatch/,
  );
});

test('public group status does not convert Commons/public channels into private authority', () => {
  const publicGroup = { ...group, privacy: 'PUBLIC' };
  const projected = validateGroupThreadAccess({ descriptor: descriptor(), group: publicGroup, canonicalMembers: members, viewer: A });
  assert.equal(projected.privacy, 'PUBLIC');
  assert.equal(projected.authoritative, false);
});
