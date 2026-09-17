'use strict';

const {
  ZERO_ADDRESS,
  normalizeCanonicalSession,
  buildInviteIntent,
  buildSessionActionIntent
} = require('./sessionProjection');

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const CHALLENGE_SOURCES = Object.freeze(['PROFILE', 'FRIEND', 'GROUP', 'LOBBY', 'REMATCH']);

function address(value, field) {
  if (typeof value !== 'string' || !ADDRESS_RE.test(value)) throw new TypeError(`${field} must be an address`);
  return value.toLowerCase();
}

function nonnegativeMs(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new RangeError(`${field} must be a nonnegative number`);
  return Math.floor(n);
}

function normalizeChallengeSource(value = 'PROFILE') {
  if (!CHALLENGE_SOURCES.includes(value)) throw new RangeError(`unsupported challenge source: ${value}`);
  return value;
}

function buildChallengeIntent({ source = 'PROFILE', actor, recipient, gameType, rulesetHash, randomnessRef, wagerAmount = 0, sourceRef = null }) {
  const normalizedSource = normalizeChallengeSource(source);
  const invite = buildInviteIntent({ actor, recipient, gameType, rulesetHash, randomnessRef, wagerAmount });
  return Object.freeze({
    ...invite,
    challenge: Object.freeze({ source: normalizedSource, sourceRef: sourceRef == null ? null : String(sourceRef), authoritative: false })
  });
}

function buildRematchIntent({ actor, session: rawSession, randomnessRef, wagerAmount = 0 }) {
  const session = normalizeCanonicalSession(rawSession);
  const player = address(actor, 'actor');
  if (![session.playerA, session.playerB].includes(player)) throw new Error('actor is not a session player');
  if (!['FINISHED', 'DECLINED', 'CANCELLED'].includes(session.state)) throw new Error('rematch requires terminal canonical session');
  const recipient = player === session.playerA ? session.playerB : session.playerA;
  const intent = buildChallengeIntent({
    source: 'REMATCH',
    sourceRef: session.sessionId,
    actor: player,
    recipient,
    gameType: session.gameType,
    rulesetHash: session.rulesetHash,
    randomnessRef,
    wagerAmount
  });
  return Object.freeze({ ...intent, previousSessionId: session.sessionId, mustCreateFreshSession: true });
}

function projectTurnState({ session: rawSession, currentTurnPlayer, moveHistory = [] }) {
  const session = normalizeCanonicalSession(rawSession);
  if (session.state !== 'ACTIVE') throw new Error('turn state requires active canonical session');
  const turnPlayer = address(currentTurnPlayer, 'currentTurnPlayer');
  if (![session.playerA, session.playerB].includes(turnPlayer)) throw new Error('engine turn player is not a canonical session player');
  const history = moveHistory.map((entry, index) => Object.freeze({
    moveNumber: BigInt(entry.moveNumber ?? index + 1),
    actor: entry.actor ? address(entry.actor, `moveHistory[${index}].actor`) : null,
    notation: entry.notation == null ? null : String(entry.notation),
    authoritative: false
  }));
  return Object.freeze({
    sessionId: session.sessionId,
    currentTurnPlayer: turnPlayer,
    nextMoveNumber: session.nextMoveNumber,
    moveHistory: Object.freeze(history),
    authoritativeTurnSource: 'CLIENT_ENGINE',
    canonicalSequenceSource: 'BongGogglesGameSessionRegistry420'
  });
}

function createApplicationClock({ session: rawSession, playerAInitialMs, playerBInitialMs, startedAtMs = Date.now() }) {
  const session = normalizeCanonicalSession(rawSession);
  if (session.state !== 'ACTIVE') throw new Error('clock requires active canonical session');
  return Object.freeze({
    schema: 'bg-game-clock-v1',
    sessionId: session.sessionId,
    playerA: session.playerA,
    playerB: session.playerB,
    playerAInitialMs: nonnegativeMs(playerAInitialMs, 'playerAInitialMs'),
    playerBInitialMs: nonnegativeMs(playerBInitialMs, 'playerBInitialMs'),
    startedAtMs: nonnegativeMs(startedAtMs, 'startedAtMs'),
    canonical: false,
    settlementAuthority: false
  });
}

function projectClock({ clock, activePlayer, nowMs = Date.now(), elapsedAms = 0, elapsedBms = 0 }) {
  if (!clock || clock.schema !== 'bg-game-clock-v1' || clock.canonical !== false) throw new TypeError('application clock required');
  const actor = address(activePlayer, 'activePlayer');
  if (![clock.playerA, clock.playerB].includes(actor)) throw new Error('active clock player is not a session player');
  const now = nonnegativeMs(nowMs, 'nowMs');
  const elapsedA = nonnegativeMs(elapsedAms, 'elapsedAms');
  const elapsedB = nonnegativeMs(elapsedBms, 'elapsedBms');
  return Object.freeze({
    sessionId: clock.sessionId,
    activePlayer: actor,
    playerARemainingMs: Math.max(0, clock.playerAInitialMs - elapsedA),
    playerBRemainingMs: Math.max(0, clock.playerBInitialMs - elapsedB),
    observedAtMs: now,
    canonical: false,
    expiryIsAdvisory: true
  });
}

function buildGameCard({ session: rawSession, viewer, peerDisplay = null, turnState = null, clock = null }) {
  const session = normalizeCanonicalSession(rawSession);
  const account = address(viewer, 'viewer');
  if (![session.playerA, session.playerB].includes(account)) throw new Error('viewer is not a session player');
  const peer = account === session.playerA ? session.playerB : session.playerA;
  const actions = {
    accept: session.state === 'INVITED' && account === session.playerB,
    decline: session.state === 'INVITED' && account === session.playerB,
    cancel: session.state === 'INVITED',
    finish: session.state === 'ACTIVE',
    rematch: ['FINISHED', 'DECLINED', 'CANCELLED'].includes(session.state)
  };
  return Object.freeze({
    sessionId: session.sessionId,
    gameType: session.gameType,
    rulesetHash: session.rulesetHash,
    state: session.state,
    viewer: account,
    peer,
    peerDisplay,
    nextMoveNumber: session.nextMoveNumber,
    winner: session.winner,
    draw: session.state === 'FINISHED' && session.winner === ZERO_ADDRESS,
    turn: turnState,
    clock,
    actions: Object.freeze(actions),
    authoritative: false
  });
}

function buildFinishIntent({ actor, session, winner = ZERO_ADDRESS }) {
  return buildSessionActionIntent({ action: 'finish', actor, session, winner });
}

module.exports = {
  CHALLENGE_SOURCES,
  buildChallengeIntent,
  buildRematchIntent,
  projectTurnState,
  createApplicationClock,
  projectClock,
  buildGameCard,
  buildFinishIntent
};
