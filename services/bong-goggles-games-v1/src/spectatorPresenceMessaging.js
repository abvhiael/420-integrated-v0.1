'use strict';

const { normalizeCanonicalSession } = require('./sessionProjection');

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const PRESENCE_STATES = Object.freeze(['ONLINE', 'AWAY', 'OFFLINE']);

function address(value, field) {
  if (typeof value !== 'string' || !ADDRESS_RE.test(value)) throw new TypeError(`${field} must be an address`);
  return value.toLowerCase();
}

function nonnegativeUint(value, field) {
  const n = typeof value === 'bigint' ? value : BigInt(value);
  if (n < 0n) throw new RangeError(`${field} must be nonnegative`);
  return n;
}

function normalizePresence(entry, nowMs = Date.now()) {
  if (!entry || typeof entry !== 'object') throw new TypeError('presence entry required');
  const account = address(entry.account, 'presence.account');
  const state = String(entry.state || 'OFFLINE').toUpperCase();
  if (!PRESENCE_STATES.includes(state)) throw new RangeError(`unsupported presence state: ${state}`);
  const observedAtMs = Number(entry.observedAtMs ?? nowMs);
  const expiresAtMs = Number(entry.expiresAtMs ?? observedAtMs);
  if (!Number.isFinite(observedAtMs) || observedAtMs < 0) throw new RangeError('presence.observedAtMs must be nonnegative');
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < observedAtMs) throw new RangeError('presence.expiresAtMs must be >= observedAtMs');
  const fresh = nowMs <= expiresAtMs;
  return Object.freeze({
    account,
    state: fresh ? state : 'OFFLINE',
    observedAtMs: Math.floor(observedAtMs),
    expiresAtMs: Math.floor(expiresAtMs),
    fresh,
    canonical: false,
    authoritative: false
  });
}

function projectPresence(entries = [], nowMs = Date.now()) {
  const byAccount = new Map();
  for (const raw of entries) {
    const presence = normalizePresence(raw, nowMs);
    const previous = byAccount.get(presence.account);
    if (!previous || presence.observedAtMs > previous.observedAtMs) byAccount.set(presence.account, presence);
  }
  return Object.freeze([...byAccount.values()].sort((a, b) => a.account.localeCompare(b.account)));
}

function assertPublicSpectatorState({ descriptor, publicState, fullState }) {
  if (!descriptor || typeof descriptor !== 'object') throw new TypeError('ruleset descriptor required');
  if (fullState !== undefined && fullState !== null) {
    throw new Error('spectator surface accepts explicit publicState only; full/private state is forbidden');
  }
  if (publicState === undefined) return null;
  if (descriptor.hiddenState === true && publicState && typeof publicState === 'object') {
    const forbidden = ['privateState', 'hiddenState', 'hand', 'hands', 'deck', 'drawPile', 'tilesInHand', 'secret', 'secrets', 'private'];
    for (const key of forbidden) {
      if (Object.prototype.hasOwnProperty.call(publicState, key)) {
        throw new Error(`hidden-state spectator payload contains forbidden field: ${key}`);
      }
    }
  }
  return publicState;
}

function normalizeMessengerRoute(route, { actor, sessionId }) {
  if (!route || typeof route !== 'object') throw new Error('BG-14/420Messenger route unavailable');
  if (route.authorized !== true) throw new Error('BG-14/420Messenger route is not currently authorized');
  if (route.transport !== '420MESSENGER') throw new Error('game chat must use 420Messenger transport');
  const account = address(actor, 'actor');
  if (route.actor !== undefined && address(route.actor, 'route.actor') !== account) throw new Error('Messenger route actor mismatch');
  if (route.sessionId !== undefined && String(route.sessionId).toLowerCase() !== String(sessionId).toLowerCase()) {
    throw new Error('Messenger route session mismatch');
  }
  return Object.freeze({
    transport: '420MESSENGER',
    conversationId: route.conversationId ?? null,
    contextId: route.contextId ?? null,
    actor: account,
    authorized: true,
    encryptionRequired: route.encryptionRequired !== false,
    authoritativeMessageState: false,
    gameContractMessaging: false
  });
}

function projectSpectatorView({
  session: rawSession,
  viewer,
  descriptor,
  policyAllows,
  playerAActive,
  playerBActive,
  blockedWithA,
  blockedWithB,
  publicState,
  fullState,
  presence = [],
  nowMs = Date.now()
}) {
  const session = normalizeCanonicalSession(rawSession);
  const account = address(viewer, 'viewer');
  if (session.state !== 'ACTIVE' && session.state !== 'FINISHED') throw new Error('spectator view requires active or finished canonical session');
  if (playerAActive !== true || playerBActive !== true) throw new Error('spectator view denied: canonical player profile inactive');
  if (blockedWithA === true || blockedWithB === true) throw new Error('spectator view denied by current block policy');
  if (policyAllows !== true) throw new Error('spectator view denied by current visibility policy');
  if (descriptor.rulesetHash !== session.rulesetHash || descriptor.gameType !== session.gameType) {
    throw new Error('spectator ruleset descriptor does not match canonical session');
  }
  const safePublicState = assertPublicSpectatorState({ descriptor, publicState, fullState });
  return Object.freeze({
    schema: 'bg-game-spectator-v1',
    sessionId: session.sessionId,
    gameType: session.gameType,
    rulesetHash: session.rulesetHash,
    viewer: account,
    players: Object.freeze([session.playerA, session.playerB]),
    state: session.state,
    nextMoveNumber: session.nextMoveNumber,
    winner: session.winner,
    publicState: safePublicState,
    hiddenStateRuleset: descriptor.hiddenState === true,
    presence: projectPresence(presence, nowMs),
    canonicalSessionAuthority: 'BongGogglesGameSessionRegistry420',
    canonical: false,
    authoritative: false
  });
}

class BongGogglesSpectatorResolver {
  constructor({
    readSession,
    resolveRuleset,
    isProfileActive,
    isBlockedEither,
    canSpectate,
    readPublicSpectatorState,
    readPresence,
    resolveChatRoute
  }) {
    this.readSession = readSession;
    this.resolveRuleset = resolveRuleset;
    this.isProfileActive = isProfileActive;
    this.isBlockedEither = isBlockedEither;
    this.canSpectate = canSpectate;
    this.readPublicSpectatorState = readPublicSpectatorState;
    this.readPresence = readPresence;
    this.resolveChatRoute = resolveChatRoute;
  }

  async resolveView(sessionId, viewer, { nowMs = Date.now() } = {}) {
    const raw = await this.readSession(sessionId);
    const session = normalizeCanonicalSession(raw);
    const account = address(viewer, 'viewer');
    const descriptor = this.resolveRuleset(session.rulesetHash, session.gameType);
    const [playerAActive, playerBActive, blockedWithA, blockedWithB, policyAllows, publicState, presence] = await Promise.all([
      this.isProfileActive(session.playerA),
      this.isProfileActive(session.playerB),
      this.isBlockedEither(account, session.playerA),
      this.isBlockedEither(account, session.playerB),
      this.canSpectate({ viewer: account, session }),
      this.readPublicSpectatorState(session.sessionId, descriptor),
      this.readPresence(session.sessionId)
    ]);
    return projectSpectatorView({
      session,
      viewer: account,
      descriptor,
      policyAllows,
      playerAActive,
      playerBActive,
      blockedWithA,
      blockedWithB,
      publicState,
      presence,
      nowMs
    });
  }

  async resolveChat(sessionId, actor, audience = 'PLAYERS') {
    const raw = await this.readSession(sessionId);
    const session = normalizeCanonicalSession(raw);
    const account = address(actor, 'actor');
    const route = await this.resolveChatRoute({ session, actor: account, audience });
    return normalizeMessengerRoute(route, { actor: account, sessionId: session.sessionId });
  }
}

module.exports = {
  PRESENCE_STATES,
  normalizePresence,
  projectPresence,
  assertPublicSpectatorState,
  normalizeMessengerRoute,
  projectSpectatorView,
  BongGogglesSpectatorResolver,
  nonnegativeUint
};
