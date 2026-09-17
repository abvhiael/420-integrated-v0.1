'use strict';

const { normalizeCanonicalSession } = require('./sessionProjection');
const { sha256Hex, stableJson } = require('./rulesetRegistry');

const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;

function bytes32(value, field, { allowZero = false } = {}) {
  if (typeof value !== 'string' || !BYTES32_RE.test(value)) throw new TypeError(`${field} must be bytes32`);
  if (!allowZero && /^0x0{64}$/i.test(value)) throw new TypeError(`${field} must be nonzero bytes32`);
  return value.toLowerCase();
}

function normalizeRandomnessResult(input) {
  if (!input || typeof input !== 'object') throw new TypeError('randomness result required');
  const status = String(input.status || '');
  if (!['REQUESTED', 'FALLBACK_ACTIVE', 'FULFILLED', 'VOIDED'].includes(status)) throw new Error(`unsupported randomness status: ${status}`);
  return Object.freeze({
    requestId: bytes32(input.requestId, 'requestId'),
    status,
    randomness: input.randomness == null ? null : bytes32(input.randomness, 'randomness'),
    proofHash: input.proofHash == null ? null : bytes32(input.proofHash, 'proofHash'),
    resolvedAt: input.resolvedAt == null ? null : BigInt(input.resolvedAt)
  });
}

function requireResolvedRandomness({ session: rawSession, descriptor, result }) {
  const session = normalizeCanonicalSession(rawSession);
  if (!descriptor || typeof descriptor !== 'object') throw new TypeError('ruleset descriptor required');
  const randomnessRequired = descriptor.randomnessRequired === true;
  const randomnessRef = bytes32(session.randomnessRef, 'randomnessRef', { allowZero: !randomnessRequired });
  if (!randomnessRequired) {
    return Object.freeze({ required: false, randomnessRef, randomness: null, proofHash: null });
  }
  const normalized = normalizeRandomnessResult(result);
  if (normalized.requestId !== randomnessRef) throw new Error('randomnessRef/requestId mismatch');
  if (normalized.status !== 'FULFILLED' || !normalized.randomness || !normalized.proofHash) {
    throw new Error(`randomness unresolved: ${normalized.status}`);
  }
  return Object.freeze({ required: true, randomnessRef, randomness: normalized.randomness, proofHash: normalized.proofHash, resolvedAt: normalized.resolvedAt });
}

function hiddenCommitment({ sessionId, rulesetHash, scope, reveal }) {
  return sha256Hex(stableJson({
    schema: 'bg-hidden-state-commit-v1',
    sessionId: bytes32(sessionId, 'sessionId'),
    rulesetHash: bytes32(rulesetHash, 'rulesetHash'),
    scope: String(scope),
    reveal
  }));
}

function normalizeRevealRecord(record) {
  if (!record || typeof record !== 'object') throw new TypeError('reveal record required');
  return Object.freeze({
    revealId: bytes32(record.revealId, 'revealId'),
    commitment: bytes32(record.commitment, 'commitment'),
    moveNumber: record.moveNumber == null ? null : BigInt(record.moveNumber),
    randomnessRef: record.randomnessRef == null ? null : bytes32(record.randomnessRef, 'randomnessRef')
  });
}

function verifyHiddenReveal({ session: rawSession, descriptor, record, reveal, seenRevealIds = new Set(), currentMoveNumber = null }) {
  const session = normalizeCanonicalSession(rawSession);
  if (!descriptor?.hiddenState) throw new Error('ruleset does not use hidden state');
  const normalized = normalizeRevealRecord(record);
  if (seenRevealIds.has(normalized.revealId)) throw new Error(`duplicate reveal: ${normalized.revealId}`);
  if (normalized.randomnessRef && normalized.randomnessRef !== session.randomnessRef) throw new Error('stale randomness reference in reveal');
  if (currentMoveNumber != null && normalized.moveNumber != null && normalized.moveNumber > BigInt(currentMoveNumber)) {
    throw new Error('premature hidden-state reveal');
  }
  const expected = hiddenCommitment({
    sessionId: session.sessionId,
    rulesetHash: session.rulesetHash,
    scope: normalized.revealId,
    reveal
  });
  if (expected !== normalized.commitment) throw new Error('hidden-state commitment mismatch');
  return Object.freeze({ revealId: normalized.revealId, verified: true, commitment: normalized.commitment, authoritative: false });
}

function deriveHiddenStateSeed({ session: rawSession, descriptor, randomness }) {
  const session = normalizeCanonicalSession(rawSession);
  if (!descriptor?.randomnessRequired) throw new Error('ruleset does not require randomness');
  const resolved = bytes32(randomness, 'randomness');
  return sha256Hex(stableJson({
    schema: 'bg-hidden-state-seed-v1',
    sessionId: session.sessionId,
    rulesetHash: session.rulesetHash,
    randomnessRef: session.randomnessRef,
    randomness: resolved
  }));
}

class BongGogglesRandomnessHiddenStateBridge {
  constructor({ readSession, resolveRuleset, resolveRandomness }) {
    if (typeof readSession !== 'function' || typeof resolveRuleset !== 'function' || typeof resolveRandomness !== 'function') {
      throw new TypeError('readSession, resolveRuleset and resolveRandomness are required');
    }
    this.readSession = readSession;
    this.resolveRuleset = resolveRuleset;
    this.resolveRandomness = resolveRandomness;
  }

  async resolve(sessionId) {
    const session = normalizeCanonicalSession(await this.readSession(sessionId));
    const descriptor = this.resolveRuleset(session.rulesetHash, session.gameType);
    if (!descriptor.randomnessRequired) return Object.freeze({ session, descriptor, randomness: null });
    const result = await this.resolveRandomness(session.randomnessRef);
    const randomness = requireResolvedRandomness({ session, descriptor, result });
    return Object.freeze({ session, descriptor, randomness });
  }
}

module.exports = {
  normalizeRandomnessResult,
  requireResolvedRandomness,
  hiddenCommitment,
  normalizeRevealRecord,
  verifyHiddenReveal,
  deriveHiddenStateSeed,
  BongGogglesRandomnessHiddenStateBridge
};
