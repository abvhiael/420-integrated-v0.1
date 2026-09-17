'use strict';

const GAME_TYPES = Object.freeze([
  'CRIBBAGE',
  'RUSSIAN_CRIBBAGE',
  'CHESS',
  'WORD_GAME',
  'CHECKERS',
  'BACKGAMMON',
  'DOMINOES'
]);

const SESSION_STATES = Object.freeze([
  'NONE',
  'INVITED',
  'ACTIVE',
  'FINISHED',
  'DECLINED',
  'CANCELLED'
]);

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function normalizeAddress(value, field) {
  if (typeof value !== 'string' || !ADDRESS_RE.test(value)) throw new TypeError(`${field} must be an address`);
  return value.toLowerCase();
}

function normalizeBytes32(value, field, { allowZero = false } = {}) {
  if (typeof value !== 'string' || !BYTES32_RE.test(value)) throw new TypeError(`${field} must be bytes32`);
  const out = value.toLowerCase();
  if (!allowZero && /^0x0{64}$/.test(out)) throw new TypeError(`${field} must be nonzero`);
  return out;
}

function normalizeUint(value, field) {
  const n = typeof value === 'bigint' ? value : BigInt(value);
  if (n < 0n) throw new RangeError(`${field} must be nonnegative`);
  return n;
}

function enumValue(value, names, field) {
  if (typeof value === 'string' && names.includes(value)) return value;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n >= names.length) throw new RangeError(`${field} is invalid`);
  return names[n];
}

function normalizeCanonicalSession(raw) {
  if (!raw || raw.exists !== true) throw new Error('canonical game session missing');
  const session = {
    sessionId: normalizeBytes32(raw.sessionId, 'sessionId'),
    playerA: normalizeAddress(raw.playerA, 'playerA'),
    playerB: normalizeAddress(raw.playerB, 'playerB'),
    gameType: enumValue(raw.gameType, GAME_TYPES, 'gameType'),
    rulesetHash: normalizeBytes32(raw.rulesetHash, 'rulesetHash'),
    randomnessRef: normalizeBytes32(raw.randomnessRef ?? `0x${'0'.repeat(64)}`, 'randomnessRef', { allowZero: true }),
    createdAt: normalizeUint(raw.createdAt, 'createdAt'),
    startedAt: normalizeUint(raw.startedAt, 'startedAt'),
    finishedAt: normalizeUint(raw.finishedAt, 'finishedAt'),
    nextMoveNumber: normalizeUint(raw.nextMoveNumber, 'nextMoveNumber'),
    state: enumValue(raw.state, SESSION_STATES, 'state'),
    winner: normalizeAddress(raw.winner ?? ZERO_ADDRESS, 'winner'),
    exists: true
  };
  if (session.playerA === session.playerB) throw new Error('canonical session has identical players');
  if (session.state === 'ACTIVE' && session.startedAt === 0n) throw new Error('active session missing startedAt');
  if (['FINISHED', 'DECLINED', 'CANCELLED'].includes(session.state) && session.finishedAt === 0n) {
    throw new Error('terminal session missing finishedAt');
  }
  if (session.state === 'FINISHED' && session.winner !== ZERO_ADDRESS && ![session.playerA, session.playerB].includes(session.winner)) {
    throw new Error('canonical winner is not a session player');
  }
  return Object.freeze(session);
}

function peerOf(session, viewer) {
  const account = normalizeAddress(viewer, 'viewer');
  if (account === session.playerA) return session.playerB;
  if (account === session.playerB) return session.playerA;
  throw new Error('viewer is not a session player');
}

function projectGameSession({ session: rawSession, viewer, profileAActive, profileBActive, blockedEither, canInviteToGame }) {
  const session = normalizeCanonicalSession(rawSession);
  const account = normalizeAddress(viewer, 'viewer');
  const peer = peerOf(session, account);
  const viewerIsInviter = account === session.playerA;
  const viewerIsRecipient = account === session.playerB;
  const bothProfilesActive = profileAActive === true && profileBActive === true;
  const blocked = blockedEither === true;
  const invitePolicyAllows = canInviteToGame === true;

  return Object.freeze({
    sessionId: session.sessionId,
    gameType: session.gameType,
    rulesetHash: session.rulesetHash,
    randomnessRef: session.randomnessRef,
    state: session.state,
    viewer: account,
    peer,
    viewerRole: viewerIsInviter ? 'INVITER' : 'RECIPIENT',
    incomingInvite: session.state === 'INVITED' && viewerIsRecipient,
    outgoingInvite: session.state === 'INVITED' && viewerIsInviter,
    active: session.state === 'ACTIVE',
    terminal: ['FINISHED', 'DECLINED', 'CANCELLED'].includes(session.state),
    winner: session.winner,
    nextMoveNumber: session.nextMoveNumber,
    createdAt: session.createdAt,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    currentEligibility: {
      profilesActive: bothProfilesActive,
      blocked,
      invitePolicyAllows,
      canAccept: session.state === 'INVITED' && viewerIsRecipient && bothProfilesActive && !blocked && invitePolicyAllows,
      canMove: session.state === 'ACTIVE' && bothProfilesActive && !blocked,
      canFinish: session.state === 'ACTIVE' && bothProfilesActive && !blocked,
      canCancel: session.state === 'INVITED',
      canDecline: session.state === 'INVITED' && viewerIsRecipient
    },
    authoritative: false
  });
}

function sortNewestFirst(a, b) {
  const ta = a.finishedAt || a.startedAt || a.createdAt;
  const tb = b.finishedAt || b.startedAt || b.createdAt;
  if (ta === tb) return a.sessionId.localeCompare(b.sessionId);
  return ta > tb ? -1 : 1;
}

function projectGameLists(projectedSessions) {
  const sessions = [...projectedSessions].sort(sortNewestFirst);
  return Object.freeze({
    incomingInvites: sessions.filter((s) => s.incomingInvite),
    outgoingInvites: sessions.filter((s) => s.outgoingInvite),
    activeGames: sessions.filter((s) => s.active),
    recentGames: sessions.filter((s) => s.terminal)
  });
}

function buildInviteIntent({ actor, recipient, gameType, rulesetHash, randomnessRef = `0x${'0'.repeat(64)}`, wagerAmount = 0 }) {
  const inviter = normalizeAddress(actor, 'actor');
  const peer = normalizeAddress(recipient, 'recipient');
  if (inviter === peer) throw new Error('cannot invite self');
  const type = enumValue(gameType, GAME_TYPES, 'gameType');
  const typeIndex = GAME_TYPES.indexOf(type);
  const rules = normalizeBytes32(rulesetHash, 'rulesetHash');
  const randomness = normalizeBytes32(randomnessRef, 'randomnessRef', { allowZero: true });
  if (BigInt(wagerAmount) !== 0n) throw new Error('Bong Goggles social games are zero-wager; use 420Bet for wagered play');
  return Object.freeze({
    contract: 'BongGogglesGameSessionRegistry420',
    method: 'invite',
    args: [inviter, peer, typeIndex, rules, randomness, '0'],
    authorization: 'WALLET_OR_SESSION',
    actor: inviter,
    backendMustNotSign: true
  });
}

function buildSessionActionIntent({ action, actor, session: rawSession, winner = ZERO_ADDRESS }) {
  const session = normalizeCanonicalSession(rawSession);
  const account = normalizeAddress(actor, 'actor');
  if (![session.playerA, session.playerB].includes(account)) throw new Error('actor is not a session player');
  const base = {
    contract: 'BongGogglesGameSessionRegistry420',
    authorization: 'WALLET_OR_SESSION',
    actor: account,
    backendMustNotSign: true
  };
  switch (action) {
    case 'accept':
      if (session.state !== 'INVITED' || account !== session.playerB) throw new Error('accept requires invited recipient');
      return Object.freeze({ ...base, method: 'accept', args: [account, session.sessionId] });
    case 'decline':
      if (session.state !== 'INVITED' || account !== session.playerB) throw new Error('decline requires invited recipient');
      return Object.freeze({ ...base, method: 'decline', args: [account, session.sessionId] });
    case 'cancel':
      if (session.state !== 'INVITED') throw new Error('cancel requires invited session');
      return Object.freeze({ ...base, method: 'cancel', args: [account, session.sessionId] });
    case 'finish': {
      if (session.state !== 'ACTIVE') throw new Error('finish requires active session');
      const normalizedWinner = normalizeAddress(winner, 'winner');
      if (normalizedWinner !== ZERO_ADDRESS && ![session.playerA, session.playerB].includes(normalizedWinner)) throw new Error('winner must be a player or zero address');
      return Object.freeze({ ...base, method: 'finish', args: [account, session.sessionId, normalizedWinner] });
    }
    default:
      throw new Error(`unsupported action: ${action}`);
  }
}

class BongGogglesGameSessionResolver {
  constructor({ readSession, isProfileActive, isBlockedEither, canInviteToGame }) {
    this.readSession = readSession;
    this.isProfileActive = isProfileActive;
    this.isBlockedEither = isBlockedEither;
    this.canInviteToGame = canInviteToGame;
  }

  async resolve(sessionId, viewer) {
    const id = normalizeBytes32(sessionId, 'sessionId');
    const raw = await this.readSession(id);
    const session = normalizeCanonicalSession(raw);
    const [profileAActive, profileBActive, blockedEither, canInviteToGame] = await Promise.all([
      this.isProfileActive(session.playerA),
      this.isProfileActive(session.playerB),
      this.isBlockedEither(session.playerA, session.playerB),
      this.canInviteToGame(session.playerA, session.playerB)
    ]);
    return projectGameSession({ session, viewer, profileAActive, profileBActive, blockedEither, canInviteToGame });
  }
}

module.exports = {
  GAME_TYPES,
  SESSION_STATES,
  ZERO_ADDRESS,
  normalizeCanonicalSession,
  projectGameSession,
  projectGameLists,
  buildInviteIntent,
  buildSessionActionIntent,
  BongGogglesGameSessionResolver
};
