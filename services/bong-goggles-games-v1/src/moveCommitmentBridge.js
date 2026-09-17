'use strict';

const { normalizeCanonicalSession } = require('./sessionProjection');
const { sha256Hex, stableJson } = require('./rulesetRegistry');

const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function address(value, field) {
  if (typeof value !== 'string' || !ADDRESS_RE.test(value)) throw new TypeError(`${field} must be an address`);
  return value.toLowerCase();
}

function bytes32(value, field) {
  if (typeof value !== 'string' || !BYTES32_RE.test(value) || /^0x0{64}$/i.test(value)) throw new TypeError(`${field} must be nonzero bytes32`);
  return value.toLowerCase();
}

function positiveUint(value, field) {
  const n = typeof value === 'bigint' ? value : BigInt(value);
  if (n <= 0n) throw new RangeError(`${field} must be positive`);
  return n;
}

function normalizeCanonicalMove(record) {
  if (!record || typeof record !== 'object') throw new TypeError('canonical move record required');
  return Object.freeze({
    moveNumber: positiveUint(record.moveNumber, 'moveNumber'),
    moveHash: bytes32(record.moveHash, 'moveHash')
  });
}

function canonicalMovePayload({ sessionId, rulesetHash, moveNumber, move }) {
  return Object.freeze({
    schema: 'bg-game-move-v1',
    sessionId: bytes32(sessionId, 'sessionId'),
    rulesetHash: bytes32(rulesetHash, 'rulesetHash'),
    moveNumber: positiveUint(moveNumber, 'moveNumber').toString(),
    move
  });
}

function hashMovePayload(input) {
  return sha256Hex(stableJson(canonicalMovePayload(input)));
}

function validateMoveSequence({ session: rawSession, actor, moveNumber }) {
  const session = normalizeCanonicalSession(rawSession);
  const player = address(actor, 'actor');
  if (session.state !== 'ACTIVE') throw new Error('move requires active canonical session');
  if (![session.playerA, session.playerB].includes(player)) throw new Error('actor is not a session player');
  const proposed = positiveUint(moveNumber, 'moveNumber');
  if (proposed !== session.nextMoveNumber) {
    throw new Error(`stale/skipped move number: canonical next is ${session.nextMoveNumber}, proposed ${proposed}`);
  }
  return Object.freeze({ session, actor: player, moveNumber: proposed });
}

function buildCommitMoveIntent({ session: rawSession, actor, moveNumber, move }) {
  const validated = validateMoveSequence({ session: rawSession, actor, moveNumber });
  const moveHash = hashMovePayload({
    sessionId: validated.session.sessionId,
    rulesetHash: validated.session.rulesetHash,
    moveNumber: validated.moveNumber,
    move
  });
  return Object.freeze({
    contract: 'BongGogglesGameSessionRegistry420',
    method: 'commitMove',
    args: [validated.actor, validated.session.sessionId, validated.moveNumber.toString(), moveHash],
    actor: validated.actor,
    sessionId: validated.session.sessionId,
    rulesetHash: validated.session.rulesetHash,
    moveNumber: validated.moveNumber,
    moveHash,
    authorization: 'WALLET_OR_SESSION',
    backendMustNotSign: true
  });
}

function verifyCanonicalMoveHistory({ session: rawSession, moves }) {
  const session = normalizeCanonicalSession(rawSession);
  const normalized = moves.map(normalizeCanonicalMove).sort((a, b) => (a.moveNumber < b.moveNumber ? -1 : a.moveNumber > b.moveNumber ? 1 : 0));
  const seen = new Set();
  for (let index = 0; index < normalized.length; index += 1) {
    const move = normalized[index];
    const expected = BigInt(index + 1);
    if (move.moveNumber !== expected) throw new Error(`canonical move history gap/replay at ${move.moveNumber}; expected ${expected}`);
    const key = move.moveNumber.toString();
    if (seen.has(key)) throw new Error(`duplicate canonical move number: ${key}`);
    seen.add(key);
  }
  const expectedNext = BigInt(normalized.length + 1);
  if (session.nextMoveNumber !== expectedNext) {
    throw new Error(`canonical nextMoveNumber mismatch: session=${session.nextMoveNumber}, history=${expectedNext}`);
  }
  return Object.freeze({ session, moves: Object.freeze(normalized), nextMoveNumber: expectedNext });
}

function rebuildAndVerify({ session: rawSession, canonicalMoves, payloadMoves, engine, initialState, reducer }) {
  if (!engine || typeof engine.replay !== 'function') throw new TypeError('deterministic client engine required');
  const history = verifyCanonicalMoveHistory({ session: rawSession, moves: canonicalMoves });
  if (!Array.isArray(payloadMoves) || payloadMoves.length !== history.moves.length) {
    throw new Error('payload move history length does not match canonical commitments');
  }
  for (let index = 0; index < payloadMoves.length; index += 1) {
    const moveNumber = BigInt(index + 1);
    const expectedHash = hashMovePayload({
      sessionId: history.session.sessionId,
      rulesetHash: history.session.rulesetHash,
      moveNumber,
      move: payloadMoves[index]
    });
    if (expectedHash !== history.moves[index].moveHash) {
      throw new Error(`move commitment divergence at move ${moveNumber}`);
    }
  }
  const replay = engine.replay(initialState, payloadMoves, reducer);
  return Object.freeze({
    sessionId: history.session.sessionId,
    rulesetHash: history.session.rulesetHash,
    nextMoveNumber: history.nextMoveNumber,
    state: replay.state,
    stateDigest: replay.stateDigest,
    trace: replay.trace,
    authoritative: false
  });
}

class BongGogglesMoveCommitmentBridge {
  constructor({ readSession, listCanonicalMoves, readMovePayloads, resolveEngine }) {
    this.readSession = readSession;
    this.listCanonicalMoves = listCanonicalMoves;
    this.readMovePayloads = readMovePayloads;
    this.resolveEngine = resolveEngine;
  }

  async prepareMove({ sessionId, actor, move }) {
    const rawSession = await this.readSession(sessionId);
    const session = normalizeCanonicalSession(rawSession);
    return buildCommitMoveIntent({ session, actor, moveNumber: session.nextMoveNumber, move });
  }

  async rebuild({ sessionId, initialState, reducer }) {
    const rawSession = await this.readSession(sessionId);
    const session = normalizeCanonicalSession(rawSession);
    const [canonicalMoves, payloadMoves] = await Promise.all([
      this.listCanonicalMoves(session.sessionId),
      this.readMovePayloads(session.sessionId)
    ]);
    const engine = this.resolveEngine(session.rulesetHash, session.gameType);
    return rebuildAndVerify({ session, canonicalMoves, payloadMoves, engine, initialState, reducer });
  }
}

module.exports = {
  canonicalMovePayload,
  hashMovePayload,
  normalizeCanonicalMove,
  validateMoveSequence,
  buildCommitMoveIntent,
  verifyCanonicalMoveHistory,
  rebuildAndVerify,
  BongGogglesMoveCommitmentBridge
};
