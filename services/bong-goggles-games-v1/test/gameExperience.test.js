'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildChallengeIntent,
  buildRematchIntent,
  projectTurnState,
  createApplicationClock,
  projectClock,
  buildGameCard
} = require('../src/gameExperience');

const A = '0x00000000000000000000000000000000000000aa';
const B = '0x00000000000000000000000000000000000000bb';
const S = `0x${'11'.repeat(32)}`;
const R = `0x${'22'.repeat(32)}`;
const Z = `0x${'00'.repeat(32)}`;
const ZA = '0x0000000000000000000000000000000000000000';

function session(overrides = {}) {
  return {
    sessionId: S,
    playerA: A,
    playerB: B,
    gameType: 'CHESS',
    rulesetHash: R,
    randomnessRef: Z,
    createdAt: 1,
    startedAt: 2,
    finishedAt: 0,
    nextMoveNumber: 3,
    state: 'ACTIVE',
    winner: ZA,
    exists: true,
    ...overrides
  };
}

test('challenge sources all route through canonical invite intent', () => {
  const intent = buildChallengeIntent({ source: 'GROUP', sourceRef: 'group-1', actor: A, recipient: B, gameType: 'CHESS', rulesetHash: R });
  assert.equal(intent.method, 'invite');
  assert.equal(intent.args[0], A);
  assert.equal(intent.args[1], B);
  assert.equal(intent.args[5], '0');
  assert.equal(intent.challenge.source, 'GROUP');
  assert.equal(intent.backendMustNotSign, true);
});

test('wagered challenge fails closed through zero-wager boundary', () => {
  assert.throws(() => buildChallengeIntent({ actor: A, recipient: B, gameType: 'CHESS', rulesetHash: R, wagerAmount: 1 }), /420Bet/);
});

test('rematch only from terminal session and must create a fresh session', () => {
  const old = session({ state: 'FINISHED', finishedAt: 9, winner: A });
  const intent = buildRematchIntent({ actor: B, session: old });
  assert.equal(intent.method, 'invite');
  assert.equal(intent.previousSessionId, S);
  assert.equal(intent.mustCreateFreshSession, true);
  assert.equal(intent.args[0], B);
  assert.equal(intent.args[1], A);
  assert.equal(intent.args[3], R);
  assert.throws(() => buildRematchIntent({ actor: A, session: session() }), /terminal/);
});

test('turn ownership is engine-derived but participant-validated', () => {
  const turn = projectTurnState({ session: session(), currentTurnPlayer: B, moveHistory: [{ moveNumber: 1, actor: A, notation: 'e4' }, { moveNumber: 2, actor: B, notation: 'e5' }] });
  assert.equal(turn.currentTurnPlayer, B);
  assert.equal(turn.nextMoveNumber, 3n);
  assert.equal(turn.authoritativeTurnSource, 'CLIENT_ENGINE');
  assert.equal(turn.canonicalSequenceSource, 'BongGogglesGameSessionRegistry420');
  assert.throws(() => projectTurnState({ session: session(), currentTurnPlayer: '0x00000000000000000000000000000000000000cc' }), /not a canonical session player/);
});

test('application clocks are explicitly non-canonical and advisory', () => {
  const clock = createApplicationClock({ session: session(), playerAInitialMs: 60000, playerBInitialMs: 60000, startedAtMs: 1000 });
  assert.equal(clock.canonical, false);
  assert.equal(clock.settlementAuthority, false);
  const view = projectClock({ clock, activePlayer: A, nowMs: 5000, elapsedAms: 1500, elapsedBms: 500 });
  assert.equal(view.playerARemainingMs, 58500);
  assert.equal(view.playerBRemainingMs, 59500);
  assert.equal(view.expiryIsAdvisory, true);
});

test('game card exposes lifecycle actions without becoming authoritative', () => {
  const activeCard = buildGameCard({ session: session(), viewer: A });
  assert.equal(activeCard.actions.finish, true);
  assert.equal(activeCard.actions.rematch, false);
  assert.equal(activeCard.authoritative, false);

  const inviteCard = buildGameCard({ session: session({ state: 'INVITED', startedAt: 0, nextMoveNumber: 1 }), viewer: B });
  assert.equal(inviteCard.actions.accept, true);
  assert.equal(inviteCard.actions.decline, true);

  const drawCard = buildGameCard({ session: session({ state: 'FINISHED', finishedAt: 10, winner: ZA }), viewer: A });
  assert.equal(drawCard.draw, true);
  assert.equal(drawCard.actions.rematch, true);
});
