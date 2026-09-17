'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ZERO_ADDRESS,
  normalizeCanonicalSession,
  projectGameSession,
  projectGameLists,
  buildInviteIntent,
  buildSessionActionIntent,
  BongGogglesGameSessionResolver
} = require('../src/sessionProjection');

const A = '0x00000000000000000000000000000000000000a1';
const B = '0x00000000000000000000000000000000000000b2';
const C = '0x00000000000000000000000000000000000000c3';
const SID = `0x${'11'.repeat(32)}`;
const RULES = `0x${'22'.repeat(32)}`;
const ZERO32 = `0x${'00'.repeat(32)}`;

function session(overrides = {}) {
  return {
    sessionId: SID,
    playerA: A,
    playerB: B,
    gameType: 2,
    rulesetHash: RULES,
    randomnessRef: ZERO32,
    createdAt: 100,
    startedAt: 0,
    finishedAt: 0,
    nextMoveNumber: 1,
    state: 1,
    winner: ZERO_ADDRESS,
    exists: true,
    ...overrides
  };
}

test('normalizes canonical session without inventing authority', () => {
  const s = normalizeCanonicalSession(session());
  assert.equal(s.gameType, 'CHESS');
  assert.equal(s.state, 'INVITED');
  assert.equal(s.rulesetHash, RULES);
  assert.equal(s.nextMoveNumber, 1n);
});

test('projects incoming invite with live eligibility checks', () => {
  const p = projectGameSession({
    session: session(),
    viewer: B,
    profileAActive: true,
    profileBActive: true,
    blockedEither: false,
    canInviteToGame: true
  });
  assert.equal(p.incomingInvite, true);
  assert.equal(p.outgoingInvite, false);
  assert.equal(p.currentEligibility.canAccept, true);
  assert.equal(p.authoritative, false);
});

test('blocked relationship invalidates acceptance and move eligibility', () => {
  const invite = projectGameSession({
    session: session(),
    viewer: B,
    profileAActive: true,
    profileBActive: true,
    blockedEither: true,
    canInviteToGame: true
  });
  assert.equal(invite.currentEligibility.canAccept, false);

  const active = projectGameSession({
    session: session({ state: 2, startedAt: 101 }),
    viewer: A,
    profileAActive: true,
    profileBActive: true,
    blockedEither: true,
    canInviteToGame: true
  });
  assert.equal(active.currentEligibility.canMove, false);
  assert.equal(active.currentEligibility.canFinish, false);
});

test('projects invite, active and recent buckets deterministically', () => {
  const incoming = projectGameSession({ session: session(), viewer: B, profileAActive: true, profileBActive: true, blockedEither: false, canInviteToGame: true });
  const outgoing = projectGameSession({ session: session({ sessionId: `0x${'12'.repeat(32)}` }), viewer: A, profileAActive: true, profileBActive: true, blockedEither: false, canInviteToGame: true });
  const active = projectGameSession({ session: session({ sessionId: `0x${'13'.repeat(32)}`, state: 2, startedAt: 110 }), viewer: A, profileAActive: true, profileBActive: true, blockedEither: false, canInviteToGame: true });
  const finished = projectGameSession({ session: session({ sessionId: `0x${'14'.repeat(32)}`, state: 3, startedAt: 105, finishedAt: 120, winner: A }), viewer: A, profileAActive: true, profileBActive: true, blockedEither: false, canInviteToGame: true });
  const lists = projectGameLists([incoming, outgoing, active, finished]);
  assert.equal(lists.incomingInvites.length, 1);
  assert.equal(lists.outgoingInvites.length, 1);
  assert.equal(lists.activeGames.length, 1);
  assert.equal(lists.recentGames.length, 1);
  assert.equal(lists.recentGames[0].sessionId, finished.sessionId);
});

test('invite intent is wallet-authorized and hard rejects wagers', () => {
  const intent = buildInviteIntent({ actor: A, recipient: B, gameType: 'CHESS', rulesetHash: RULES });
  assert.equal(intent.method, 'invite');
  assert.equal(intent.args[2], 2);
  assert.equal(intent.args[5], '0');
  assert.equal(intent.backendMustNotSign, true);
  assert.throws(() => buildInviteIntent({ actor: A, recipient: B, gameType: 'CHESS', rulesetHash: RULES, wagerAmount: 1 }), /zero-wager/);
});

test('accept, decline, cancel and finish intents preserve canonical roles/state', () => {
  assert.equal(buildSessionActionIntent({ action: 'accept', actor: B, session: session() }).method, 'accept');
  assert.equal(buildSessionActionIntent({ action: 'decline', actor: B, session: session() }).method, 'decline');
  assert.equal(buildSessionActionIntent({ action: 'cancel', actor: A, session: session() }).method, 'cancel');
  assert.equal(buildSessionActionIntent({ action: 'finish', actor: A, session: session({ state: 2, startedAt: 101 }), winner: B }).method, 'finish');
  assert.throws(() => buildSessionActionIntent({ action: 'accept', actor: A, session: session() }), /invited recipient/);
  assert.throws(() => buildSessionActionIntent({ action: 'finish', actor: A, session: session({ state: 2, startedAt: 101 }), winner: C }), /winner must be/);
});

test('resolver refreshes current profile/block/invite policy for every projection', async () => {
  let blocked = false;
  const resolver = new BongGogglesGameSessionResolver({
    readSession: async () => session(),
    isProfileActive: async () => true,
    isBlockedEither: async () => blocked,
    canInviteToGame: async () => true
  });
  const allowed = await resolver.resolve(SID, B);
  assert.equal(allowed.currentEligibility.canAccept, true);
  blocked = true;
  const denied = await resolver.resolve(SID, B);
  assert.equal(denied.currentEligibility.canAccept, false);
});

test('missing, malformed and nonparticipant canonical state fails closed', () => {
  assert.throws(() => normalizeCanonicalSession({ ...session(), exists: false }), /missing/);
  assert.throws(() => normalizeCanonicalSession(session({ rulesetHash: ZERO32 })), /nonzero/);
  assert.throws(() => projectGameSession({ session: session(), viewer: C, profileAActive: true, profileBActive: true, blockedEither: false, canInviteToGame: true }), /not a session player/);
});
