'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizePresence,
  projectPresence,
  assertPublicSpectatorState,
  normalizeMessengerRoute,
  projectSpectatorView,
  BongGogglesSpectatorResolver
} = require('../src/spectatorPresenceMessaging');

const A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const V = '0xcccccccccccccccccccccccccccccccccccccccc';
const SESSION_ID = `0x${'11'.repeat(32)}`;
const RULESET = `0x${'22'.repeat(32)}`;

function session(overrides = {}) {
  return {
    sessionId: SESSION_ID,
    playerA: A,
    playerB: B,
    gameType: 'CHESS',
    rulesetHash: RULESET,
    randomnessRef: `0x${'0'.repeat(64)}`,
    createdAt: 1,
    startedAt: 2,
    finishedAt: 0,
    nextMoveNumber: 3,
    state: 'ACTIVE',
    winner: '0x0000000000000000000000000000000000000000',
    exists: true,
    ...overrides
  };
}

const descriptor = Object.freeze({
  rulesetHash: RULESET,
  gameType: 'CHESS',
  hiddenState: false
});

test('presence is explicitly non-canonical and expires closed to OFFLINE', () => {
  const fresh = normalizePresence({ account: A, state: 'online', observedAtMs: 100, expiresAtMs: 200 }, 150);
  assert.equal(fresh.state, 'ONLINE');
  assert.equal(fresh.canonical, false);
  const stale = normalizePresence({ account: A, state: 'ONLINE', observedAtMs: 100, expiresAtMs: 120 }, 150);
  assert.equal(stale.state, 'OFFLINE');
  assert.equal(stale.fresh, false);
});

test('presence projection keeps newest observation per account', () => {
  const result = projectPresence([
    { account: A, state: 'AWAY', observedAtMs: 100, expiresAtMs: 300 },
    { account: A, state: 'ONLINE', observedAtMs: 200, expiresAtMs: 300 },
    { account: B, state: 'OFFLINE', observedAtMs: 150, expiresAtMs: 300 }
  ], 250);
  assert.equal(result.length, 2);
  assert.equal(result.find((x) => x.account === A).state, 'ONLINE');
});

test('spectator surface accepts only explicit public state', () => {
  assert.deepEqual(assertPublicSpectatorState({ descriptor, publicState: { board: 'safe' } }), { board: 'safe' });
  assert.throws(() => assertPublicSpectatorState({ descriptor, publicState: {}, fullState: { secret: true } }), /full\/private state is forbidden/);
});

test('hidden-state ruleset rejects common private material fields', () => {
  const hidden = { ...descriptor, hiddenState: true };
  assert.throws(() => assertPublicSpectatorState({ descriptor: hidden, publicState: { hand: ['x'] } }), /forbidden field: hand/);
  assert.deepEqual(assertPublicSpectatorState({ descriptor: hidden, publicState: { score: [1, 2], turn: A } }), { score: [1, 2], turn: A });
});

test('spectator view is policy gated and non-authoritative', () => {
  const view = projectSpectatorView({
    session: session(),
    viewer: V,
    descriptor,
    policyAllows: true,
    playerAActive: true,
    playerBActive: true,
    blockedWithA: false,
    blockedWithB: false,
    publicState: { board: 'state' },
    presence: [{ account: A, state: 'ONLINE', observedAtMs: 10, expiresAtMs: 100 }],
    nowMs: 50
  });
  assert.equal(view.sessionId, SESSION_ID);
  assert.equal(view.authoritative, false);
  assert.equal(view.publicState.board, 'state');
  assert.equal(view.presence[0].canonical, false);
});

test('spectator view fails closed on current block/privacy/profile and descriptor mismatch', () => {
  const base = {
    session: session(), viewer: V, descriptor, policyAllows: true,
    playerAActive: true, playerBActive: true, blockedWithA: false, blockedWithB: false,
    publicState: {}
  };
  assert.throws(() => projectSpectatorView({ ...base, blockedWithA: true }), /block policy/);
  assert.throws(() => projectSpectatorView({ ...base, policyAllows: false }), /visibility policy/);
  assert.throws(() => projectSpectatorView({ ...base, playerBActive: false }), /profile inactive/);
  assert.throws(() => projectSpectatorView({ ...base, descriptor: { ...descriptor, gameType: 'CHECKERS' } }), /does not match/);
});

test('chat route must be currently authorized 420Messenger and never game-contract messaging', () => {
  const route = normalizeMessengerRoute({
    transport: '420MESSENGER',
    authorized: true,
    actor: V,
    sessionId: SESSION_ID,
    conversationId: `0x${'33'.repeat(32)}`,
    encryptionRequired: true
  }, { actor: V, sessionId: SESSION_ID });
  assert.equal(route.transport, '420MESSENGER');
  assert.equal(route.gameContractMessaging, false);
  assert.throws(() => normalizeMessengerRoute({ transport: 'GAME_CONTRACT', authorized: true }, { actor: V, sessionId: SESSION_ID }), /420Messenger/);
  assert.throws(() => normalizeMessengerRoute({ transport: '420MESSENGER', authorized: false }, { actor: V, sessionId: SESSION_ID }), /not currently authorized/);
});

test('resolver re-reads current policy/state and delegates chat to BG-14 route adapter', async () => {
  const calls = [];
  const resolver = new BongGogglesSpectatorResolver({
    readSession: async () => session(),
    resolveRuleset: () => descriptor,
    isProfileActive: async () => true,
    isBlockedEither: async (x, y) => { calls.push(['block', x, y]); return false; },
    canSpectate: async ({ viewer }) => { calls.push(['spectate', viewer]); return true; },
    readPublicSpectatorState: async () => ({ board: 'ok' }),
    readPresence: async () => [],
    resolveChatRoute: async ({ actor, audience }) => ({
      transport: '420MESSENGER', authorized: true, actor, sessionId: SESSION_ID,
      conversationId: `0x${'44'.repeat(32)}`, audience
    })
  });
  const view = await resolver.resolveView(SESSION_ID, V, { nowMs: 1 });
  assert.equal(view.viewer, V);
  assert.equal(calls.filter((x) => x[0] === 'block').length, 2);
  const chat = await resolver.resolveChat(SESSION_ID, V, 'SPECTATORS');
  assert.equal(chat.transport, '420MESSENGER');
  assert.equal(chat.actor, V);
});
