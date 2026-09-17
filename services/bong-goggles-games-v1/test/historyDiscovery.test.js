'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  projectGameHistory,
  projectPlayerStats,
  projectLeaderboard,
  projectProfileGameShelf,
  projectFriendActivity,
  buildGameSearchCandidates,
  buildRewardsHook
} = require('../src/historyDiscovery');

const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const C = '0x3333333333333333333333333333333333333333';
const Z = '0x0000000000000000000000000000000000000000';
const Z32 = '0x' + '00'.repeat(32);
const R = '0x' + '11'.repeat(32);

function s(idByte, a, b, winner, gameType, finishedAt) {
  return {
    sessionId: '0x' + idByte.repeat(64),
    playerA: a,
    playerB: b,
    gameType,
    rulesetHash: R,
    randomnessRef: Z32,
    createdAt: 1,
    startedAt: 2,
    finishedAt,
    nextMoveNumber: 3,
    state: 'FINISHED',
    winner,
    exists: true
  };
}

const sessions = [
  s('a', A, B, A, 'CHESS', 10),
  s('b', A, C, Z, 'CHESS', 20),
  s('c', B, C, C, 'CHECKERS', 30),
  s('d', A, B, B, 'CHECKERS', 40),
  s('e', A, C, A, 'CHESS', 50)
];

test('history uses canonical finished sessions and newest-first ordering', () => {
  const history = projectGameHistory({ sessions, player: A });
  assert.deepEqual(history.map((row) => row.sessionId), [
    '0x' + 'e'.repeat(64),
    '0x' + 'd'.repeat(64),
    '0x' + 'b'.repeat(64),
    '0x' + 'a'.repeat(64)
  ]);
  assert.deepEqual(history.map((row) => row.result), ['WIN', 'LOSS', 'DRAW', 'WIN']);
  assert.equal(history.every((row) => row.authoritative === false), true);
});

test('stats are rebuildable and split by game type', () => {
  const stats = projectPlayerStats({ sessions, player: A });
  assert.deepEqual(stats.overall, {
    games: 4,
    wins: 2,
    losses: 1,
    draws: 1,
    currentStreakType: 'WIN',
    currentStreak: 1,
    bestWinStreak: 1,
    authoritative: false
  });
  assert.equal(stats.byGame.CHESS.games, 3);
  assert.equal(stats.byGame.CHESS.wins, 2);
  assert.equal(stats.byGame.CHECKERS.losses, 1);
  assert.equal(stats.rebuildableFromCanonicalFinishedSessions, true);
});

test('leaderboards are deterministic application projections, not authority', () => {
  const board = projectLeaderboard({ sessions, players: [C, A, B, A], gameType: 'CHESS' });
  assert.equal(board[0].player, A);
  assert.equal(board[0].score, 7);
  assert.equal(board[0].rankingAuthority, false);
  assert.equal(board.filter((row) => row.player === A).length, 1);
});

test('profile shelf is bounded and newest first', () => {
  const shelf = projectProfileGameShelf({ sessions, profile: A, limit: 2 });
  assert.equal(shelf.length, 2);
  assert.equal(shelf[0].sessionId, '0x' + 'e'.repeat(64));
});

test('friend activity applies current visibility filter', () => {
  const rows = projectFriendActivity({
    sessions,
    viewer: C,
    friends: [A],
    canViewSession: ({ session }) => session.gameType === 'CHESS',
    limit: 10
  });
  assert.equal(rows.every((row) => row.gameType === 'CHESS'), true);
  assert.equal(rows.some((row) => row.sessionId === '0x' + 'd'.repeat(64)), false);
});

test('search candidates are shaped for BG-12 query service without becoming canonical', () => {
  const board = projectLeaderboard({ sessions, players: [A, B, C], gameType: 'CHESS' });
  const candidates = buildGameSearchCandidates({
    leaderboards: [{ gameType: 'CHESS', rows: board }],
    profiles: { [A]: { displayName: 'alice' } }
  });
  const alice = candidates.find((row) => row.entityId === A);
  assert.equal(alice.searchClass, 'BONG_GOGGLES_GAMES');
  assert.equal(alice.displayName, 'alice');
  assert.equal(alice.authoritative, false);
});

test('BG-18 hook never awards or mints in BG-15', () => {
  const stats = projectPlayerStats({ sessions, player: A }).overall;
  const hook = buildRewardsHook({ player: A, gameType: 'CHESS', stats });
  assert.equal(hook.destination, 'BG-18_REWARDS_CONFIGURATION');
  assert.equal(hook.awardRequested, false);
  assert.equal(hook.mintRequested, false);
});

test('non-finished sessions are rejected from canonical history', () => {
  const active = { ...sessions[0], state: 'ACTIVE', finishedAt: 0 };
  assert.throws(() => projectGameHistory({ sessions: [active], player: A }), /FINISHED/);
});
