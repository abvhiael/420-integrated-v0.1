'use strict';

const { normalizeCanonicalSession, ZERO_ADDRESS, GAME_TYPES } = require('./sessionProjection');

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function address(value, field) {
  if (typeof value !== 'string' || !ADDRESS_RE.test(value)) throw new TypeError(`${field} must be an address`);
  return value.toLowerCase();
}

function finishedSession(raw) {
  const session = normalizeCanonicalSession(raw);
  if (session.state !== 'FINISHED') throw new Error('history/statistics require canonical FINISHED sessions');
  return session;
}

function resultFor(session, player) {
  const account = address(player, 'player');
  if (![session.playerA, session.playerB].includes(account)) throw new Error('player is not a session participant');
  if (session.winner === ZERO_ADDRESS) return 'DRAW';
  return session.winner === account ? 'WIN' : 'LOSS';
}

function projectGameHistory({ sessions, player, gameType = null }) {
  const account = address(player, 'player');
  if (gameType != null && !GAME_TYPES.includes(gameType)) throw new RangeError(`unsupported game type: ${gameType}`);
  const rows = sessions.map(finishedSession)
    .filter((session) => [session.playerA, session.playerB].includes(account))
    .filter((session) => gameType == null || session.gameType === gameType)
    .map((session) => Object.freeze({
      sessionId: session.sessionId,
      gameType: session.gameType,
      rulesetHash: session.rulesetHash,
      player: account,
      opponent: session.playerA === account ? session.playerB : session.playerA,
      result: resultFor(session, account),
      winner: session.winner,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      authoritative: false,
      canonicalOutcomeSource: 'BongGogglesGameSessionRegistry420'
    }))
    .sort((a, b) => a.finishedAt === b.finishedAt ? a.sessionId.localeCompare(b.sessionId) : (a.finishedAt > b.finishedAt ? -1 : 1));
  return Object.freeze(rows);
}

function summarizeHistory(history) {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let currentStreakType = null;
  let currentStreak = 0;
  let bestWinStreak = 0;
  for (const row of history) {
    if (row.result === 'WIN') wins += 1;
    else if (row.result === 'LOSS') losses += 1;
    else draws += 1;
  }
  const chronological = [...history].sort((a, b) => a.finishedAt === b.finishedAt ? a.sessionId.localeCompare(b.sessionId) : (a.finishedAt < b.finishedAt ? -1 : 1));
  let runningWins = 0;
  for (const row of chronological) {
    if (row.result === 'WIN') {
      runningWins += 1;
      bestWinStreak = Math.max(bestWinStreak, runningWins);
    } else {
      runningWins = 0;
    }
  }
  for (const row of history) {
    if (currentStreakType == null) currentStreakType = row.result;
    if (row.result !== currentStreakType) break;
    currentStreak += 1;
  }
  return Object.freeze({
    games: history.length,
    wins,
    losses,
    draws,
    currentStreakType,
    currentStreak,
    bestWinStreak,
    authoritative: false
  });
}

function projectPlayerStats({ sessions, player }) {
  const account = address(player, 'player');
  const overallHistory = projectGameHistory({ sessions, player: account });
  const byGame = {};
  for (const gameType of GAME_TYPES) {
    const history = overallHistory.filter((row) => row.gameType === gameType);
    if (history.length) byGame[gameType] = summarizeHistory(history);
  }
  return Object.freeze({
    player: account,
    overall: summarizeHistory(overallHistory),
    byGame: Object.freeze(byGame),
    authoritative: false,
    rebuildableFromCanonicalFinishedSessions: true
  });
}

function projectLeaderboard({ sessions, players, gameType = null, minGames = 1 }) {
  if (!Number.isInteger(minGames) || minGames < 1) throw new RangeError('minGames must be a positive integer');
  const seen = new Set();
  const rows = [];
  for (const player of players) {
    const account = address(player, 'player');
    if (seen.has(account)) continue;
    seen.add(account);
    const history = projectGameHistory({ sessions, player: account, gameType });
    const stats = summarizeHistory(history);
    if (stats.games < minGames) continue;
    const score = (stats.wins * 3) + stats.draws;
    rows.push({ player: account, gameType, ...stats, score });
  }
  rows.sort((a, b) => b.score - a.score || b.wins - a.wins || a.losses - b.losses || a.player.localeCompare(b.player));
  return Object.freeze(rows.map((row, index) => Object.freeze({
    rank: index + 1,
    ...row,
    authoritative: false,
    rankingAuthority: false
  })));
}

function projectProfileGameShelf({ sessions, profile, limit = 10 }) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit must be positive');
  return Object.freeze(projectGameHistory({ sessions, player: profile }).slice(0, limit));
}

function projectFriendActivity({ sessions, viewer, friends, canViewSession, limit = 20 }) {
  const account = address(viewer, 'viewer');
  const friendSet = new Set(friends.map((friend) => address(friend, 'friend')));
  const candidates = sessions.map(finishedSession)
    .filter((session) => friendSet.has(session.playerA) || friendSet.has(session.playerB))
    .filter((session) => canViewSession({ viewer: account, session }) === true)
    .sort((a, b) => a.finishedAt === b.finishedAt ? a.sessionId.localeCompare(b.sessionId) : (a.finishedAt > b.finishedAt ? -1 : 1))
    .slice(0, limit)
    .map((session) => Object.freeze({
      sessionId: session.sessionId,
      gameType: session.gameType,
      playerA: session.playerA,
      playerB: session.playerB,
      winner: session.winner,
      finishedAt: session.finishedAt,
      authoritative: false
    }));
  return Object.freeze(candidates);
}

function buildGameSearchCandidates({ leaderboards, profiles = {} }) {
  const candidates = [];
  for (const board of leaderboards) {
    for (const row of board.rows) {
      const profile = profiles[row.player] || {};
      candidates.push(Object.freeze({
        entityId: row.player,
        entityType: 'GAME_PLAYER',
        searchClass: 'BONG_GOGGLES_GAMES',
        gameType: board.gameType,
        displayName: profile.displayName || row.player,
        scoreHint: row.score,
        wins: row.wins,
        games: row.games,
        canonicalSource: 'BongGogglesGameSessionRegistry420',
        authoritative: false
      }));
    }
  }
  return Object.freeze(candidates);
}

function buildRewardsHook({ player, gameType, stats }) {
  return Object.freeze({
    schema: 'bg-games-rewards-hook-v1',
    player: address(player, 'player'),
    gameType: gameType == null ? null : gameType,
    statsSnapshot: Object.freeze({ games: stats.games, wins: stats.wins, losses: stats.losses, draws: stats.draws }),
    destination: 'BG-18_REWARDS_CONFIGURATION',
    awardRequested: false,
    mintRequested: false,
    authoritative: false
  });
}

module.exports = {
  resultFor,
  projectGameHistory,
  summarizeHistory,
  projectPlayerStats,
  projectLeaderboard,
  projectProfileGameShelf,
  projectFriendActivity,
  buildGameSearchCandidates,
  buildRewardsHook
};
