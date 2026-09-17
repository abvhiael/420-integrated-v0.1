'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertCurrentGameEligibility,
  ChallengeRateLimiter,
  verifyRecoveredState,
  recoverGameState,
  buildSafeGameTelemetry,
  assertZeroWagerBoundary,
  detectConflictingFinish,
  classifyAbandonedSession
} = require('../src/integrityHardening');

const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const C = '0x3333333333333333333333333333333333333333';
const ZERO = '0x0000000000000000000000000000000000000000';
const ID = '0x' + 'aa'.repeat(32);
const RULES = '0x' + 'bb'.repeat(32);
const RANDOMNESS = '0x' + 'cc'.repeat(32);

function session(state = 'ACTIVE', winner = ZERO) {
  return {
    sessionId: ID,
    playerA: A,
    playerB: B,
    gameType: 'CHESS',
    rulesetHash: RULES,
    randomnessRef: RANDOMNESS,
    createdAt: 10,
    startedAt: state === 'INVITED' ? 0 : 20,
    finishedAt: ['FINISHED', 'DECLINED', 'CANCELLED'].includes(state) ? 30 : 0,
    nextMoveNumber: 1,
    state,
    winner,
    exists: true
  };
}

test('current profile/block/policy changes invalidate stale active-game actions', () => {
  assert.equal(assertCurrentGameEligibility({ session: session(), actor: A, profileAActive: true, profileBActive: true, blockedEither: false, policyAllows: true, action: 'MOVE' }).eligible, true);
  assert.throws(() => assertCurrentGameEligibility({ session: session(), actor: A, profileAActive: false, profileBActive: true, blockedEither: false, policyAllows: true, action: 'MOVE' }), /disabled profile/);
  assert.throws(() => assertCurrentGameEligibility({ session: session(), actor: A, profileAActive: true, profileBActive: true, blockedEither: true, policyAllows: true, action: 'MOVE' }), /block state/);
  assert.throws(() => assertCurrentGameEligibility({ session: session(), actor: A, profileAActive: true, profileBActive: true, blockedEither: false, policyAllows: false, action: 'MOVE' }), /social policy/);
});

test('nonparticipant cannot pass integrity eligibility', () => {
  assert.throws(() => assertCurrentGameEligibility({ session: session(), actor: C, profileAActive: true, profileBActive: true, blockedEither: false, policyAllows: true, action: 'MOVE' }), /not a session player/);
});

test('challenge rate limiter blocks pairwise spam inside the window', () => {
  const limiter = new ChallengeRateLimiter({ maxChallenges: 2, windowMs: 1000 });
  limiter.checkAndRecord({ actor: A, recipient: B, nowMs: 100 });
  limiter.checkAndRecord({ actor: A, recipient: B, nowMs: 200 });
  assert.throws(() => limiter.checkAndRecord({ actor: A, recipient: B, nowMs: 300 }), /rate limit exceeded/);
  assert.doesNotThrow(() => limiter.checkAndRecord({ actor: A, recipient: B, nowMs: 1201 }));
});

test('local/canonical digest divergence forces deterministic rebuild', () => {
  const result = verifyRecoveredState({ canonicalRebuild: { sessionId: ID, stateDigest: '0xcanonical' }, localStateDigest: '0xlocal' });
  assert.equal(result.divergent, true);
  assert.equal(result.action, 'FORCE_CANONICAL_REBUILD');
});

test('matching local/canonical digest keeps local state', () => {
  const result = verifyRecoveredState({ canonicalRebuild: { sessionId: ID, stateDigest: 'same' }, localStateDigest: 'same' });
  assert.equal(result.divergent, false);
  assert.equal(result.action, 'KEEP_LOCAL_STATE');
});

test('recovery delegates to canonical move bridge rebuild', async () => {
  const moveBridge = { rebuild: async () => ({ sessionId: ID, stateDigest: 'canonical', state: { board: [] }, trace: [] }) };
  const result = await recoverGameState({ moveBridge, sessionId: ID, initialState: {}, reducer: (s) => s, localStateDigest: 'stale' });
  assert.equal(result.integrity.action, 'FORCE_CANONICAL_REBUILD');
  assert.equal(result.stateDigest, 'canonical');
});

test('telemetry recursively redacts private game material', () => {
  const event = buildSafeGameTelemetry({ sessionId: ID, moveNumber: 4, hiddenState: { hand: ['ace'], publicCount: 5 }, nested: { secretSalt: 'abc', ok: true } });
  assert.equal(event.hiddenState, '[REDACTED]');
  assert.equal(event.nested.secretSalt, '[REDACTED]');
  assert.equal(event.nested.ok, true);
  assert.equal(event.containsPrivateState, false);
});

test('zero-wager boundary explicitly rejects wagered Bong Goggles sessions', () => {
  const base = { actor: A, recipient: B, gameType: 'CHESS', rulesetHash: RULES, randomnessRef: ZERO.replace(/0x0{40}$/, '0x' + '0'.repeat(64)) };
  assert.equal(assertZeroWagerBoundary({ ...base, wagerAmount: 0 }).wageredPlayDestination, '420BET');
  assert.throws(() => assertZeroWagerBoundary({ ...base, wagerAmount: 1 }), /420Bet/);
});

test('conflicting terminal winner is rejected while identical finish is idempotent presentation', () => {
  assert.throws(() => detectConflictingFinish({ session: session('FINISHED', A), proposedWinner: B }), /conflicting finish/);
  const same = detectConflictingFinish({ session: session('FINISHED', A), proposedWinner: A });
  assert.equal(same.alreadyFinished, true);
});

test('abandoned-session classification never mutates canonical lifecycle', () => {
  const abandoned = classifyAbandonedSession({ session: session(), nowSeconds: 200, abandonmentAfterSeconds: 100 });
  assert.equal(abandoned.abandoned, true);
  assert.equal(abandoned.canonicalLifecycleUnchanged, true);
  const finished = classifyAbandonedSession({ session: session('FINISHED', A), nowSeconds: 200, abandonmentAfterSeconds: 100 });
  assert.equal(finished.abandoned, false);
});
