'use strict';

const { normalizeCanonicalSession, buildInviteIntent } = require('./sessionProjection');

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const SENSITIVE_KEY_RE = /(private|secret|salt|seed|hand|deck|tile|draw|cipher|plaintext|keymaterial|hidden)/i;

function address(value, field) {
  if (typeof value !== 'string' || !ADDRESS_RE.test(value)) throw new TypeError(`${field} must be an address`);
  return value.toLowerCase();
}

function assertCurrentGameEligibility({ session: rawSession, actor, profileAActive, profileBActive, blockedEither, policyAllows, action }) {
  const session = normalizeCanonicalSession(rawSession);
  const account = address(actor, 'actor');
  if (![session.playerA, session.playerB].includes(account)) throw new Error('actor is not a session player');
  if (profileAActive !== true || profileBActive !== true) throw new Error('game action invalidated by disabled profile');
  if (blockedEither === true) throw new Error('game action invalidated by current block state');
  if (policyAllows !== true) throw new Error('game action invalidated by current social policy');
  if (action === 'INVITE' && session.state !== 'INVITED') throw new Error('invite action requires canonical invited session');
  if (action === 'MOVE' && session.state !== 'ACTIVE') throw new Error('move action requires canonical active session');
  if (action === 'FINISH' && session.state !== 'ACTIVE') throw new Error('finish action requires canonical active session');
  return Object.freeze({ session, actor: account, action, eligible: true });
}

class ChallengeRateLimiter {
  constructor({ maxChallenges = 5, windowMs = 60_000 } = {}) {
    if (!Number.isInteger(maxChallenges) || maxChallenges < 1) throw new RangeError('maxChallenges must be positive');
    if (!Number.isFinite(windowMs) || windowMs <= 0) throw new RangeError('windowMs must be positive');
    this.maxChallenges = maxChallenges;
    this.windowMs = Math.floor(windowMs);
    this.events = new Map();
  }

  checkAndRecord({ actor, recipient, nowMs = Date.now() }) {
    const from = address(actor, 'actor');
    const to = address(recipient, 'recipient');
    if (from === to) throw new Error('cannot challenge self');
    const now = Number(nowMs);
    if (!Number.isFinite(now) || now < 0) throw new RangeError('nowMs must be nonnegative');
    const key = `${from}:${to}`;
    const cutoff = now - this.windowMs;
    const recent = (this.events.get(key) || []).filter((stamp) => stamp > cutoff);
    if (recent.length >= this.maxChallenges) {
      throw new Error('game challenge rate limit exceeded');
    }
    recent.push(now);
    this.events.set(key, recent);
    return Object.freeze({ actor: from, recipient: to, remaining: this.maxChallenges - recent.length, resetAfterMs: this.windowMs, authoritative: false });
  }
}

function verifyRecoveredState({ canonicalRebuild, localStateDigest }) {
  if (!canonicalRebuild || typeof canonicalRebuild.stateDigest !== 'string') throw new TypeError('canonical rebuild result required');
  if (typeof localStateDigest !== 'string' || !localStateDigest) throw new TypeError('localStateDigest required');
  const divergent = canonicalRebuild.stateDigest !== localStateDigest;
  return Object.freeze({
    sessionId: canonicalRebuild.sessionId,
    canonicalStateDigest: canonicalRebuild.stateDigest,
    localStateDigest,
    divergent,
    action: divergent ? 'FORCE_CANONICAL_REBUILD' : 'KEEP_LOCAL_STATE',
    canonicalSource: 'BongGogglesGameSessionRegistry420',
    authoritative: false
  });
}

async function recoverGameState({ moveBridge, sessionId, initialState, reducer, localStateDigest }) {
  if (!moveBridge || typeof moveBridge.rebuild !== 'function') throw new TypeError('move bridge with rebuild required');
  const canonicalRebuild = await moveBridge.rebuild({ sessionId, initialState, reducer });
  const integrity = verifyRecoveredState({ canonicalRebuild, localStateDigest });
  return Object.freeze({ ...canonicalRebuild, integrity });
}

function redactTelemetry(value) {
  if (Array.isArray(value)) return value.map(redactTelemetry);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY_RE.test(key) ? '[REDACTED]' : redactTelemetry(nested);
    }
    return out;
  }
  return value;
}

function buildSafeGameTelemetry(event) {
  if (!event || typeof event !== 'object') throw new TypeError('telemetry event object required');
  return Object.freeze({
    schema: 'bg-game-telemetry-v1',
    ...redactTelemetry(event),
    containsPrivateState: false
  });
}

function assertZeroWagerBoundary(input) {
  const intent = buildInviteIntent(input);
  if (intent.args[5] !== '0') throw new Error('Bong Goggles game intent crossed zero-wager boundary');
  return Object.freeze({
    ...intent,
    wageringSupported: false,
    wageredPlayDestination: '420BET'
  });
}

function detectConflictingFinish({ session: rawSession, proposedWinner }) {
  const session = normalizeCanonicalSession(rawSession);
  const winner = address(proposedWinner, 'proposedWinner');
  if (session.state === 'FINISHED') {
    if (winner !== session.winner) throw new Error('conflicting finish against canonical winner');
    return Object.freeze({ alreadyFinished: true, winner: session.winner, authoritative: false });
  }
  if (session.state !== 'ACTIVE') throw new Error('finish comparison requires active or finished session');
  return Object.freeze({ alreadyFinished: false, winner, authoritative: false });
}

function classifyAbandonedSession({ session: rawSession, nowSeconds, abandonmentAfterSeconds }) {
  const session = normalizeCanonicalSession(rawSession);
  const now = BigInt(nowSeconds);
  const threshold = BigInt(abandonmentAfterSeconds);
  if (threshold <= 0n) throw new RangeError('abandonmentAfterSeconds must be positive');
  if (session.state !== 'ACTIVE') return Object.freeze({ abandoned: false, reason: 'NOT_ACTIVE', authoritative: false });
  const anchor = session.startedAt > 0n ? session.startedAt : session.createdAt;
  return Object.freeze({
    abandoned: now > anchor + threshold,
    reason: now > anchor + threshold ? 'APPLICATION_TIMEOUT' : 'WITHIN_APPLICATION_WINDOW',
    canonicalLifecycleUnchanged: true,
    authoritative: false
  });
}

module.exports = {
  assertCurrentGameEligibility,
  ChallengeRateLimiter,
  verifyRecoveredState,
  recoverGameState,
  redactTelemetry,
  buildSafeGameTelemetry,
  assertZeroWagerBoundary,
  detectConflictingFinish,
  classifyAbandonedSession
};
