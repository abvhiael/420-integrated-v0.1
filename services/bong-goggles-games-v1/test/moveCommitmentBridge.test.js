'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hashMovePayload,
  buildCommitMoveIntent,
  verifyCanonicalMoveHistory,
  rebuildAndVerify,
  BongGogglesMoveCommitmentBridge
} = require('../src/moveCommitmentBridge');
const { DeterministicClientEngine } = require('../src/rulesetRegistry');

const A = '0x00000000000000000000000000000000000000a1';
const B = '0x00000000000000000000000000000000000000b2';
const SESSION = `0x${'11'.repeat(32)}`;
const RULESET = `0x${'22'.repeat(32)}`;

function activeSession(nextMoveNumber = 1n) {
  return {
    sessionId: SESSION,
    playerA: A,
    playerB: B,
    gameType: 'CHESS',
    rulesetHash: RULESET,
    randomnessRef: `0x${'0'.repeat(64)}`,
    createdAt: 1n,
    startedAt: 2n,
    finishedAt: 0n,
    nextMoveNumber,
    state: 'ACTIVE',
    winner: '0x0000000000000000000000000000000000000000',
    exists: true
  };
}

function descriptor() {
  return {
    rulesetHash: RULESET,
    gameType: 'CHESS',
    rulesetId: 'chess.standard',
    rulesetVersion: '1.0.0',
    engineId: 'chess-engine',
    engineVersion: '1.0.0',
    stateCodec: 'stable-json-v1',
    moveCodec: 'stable-json-v1',
    hiddenState: false,
    randomnessRequired: false,
    deterministic: true
  };
}

test('commitMove intent uses exact canonical nextMoveNumber and deterministic commitment', () => {
  const move = { from: 'e2', to: 'e4' };
  const intent = buildCommitMoveIntent({ session: activeSession(7n), actor: A, moveNumber: 7n, move });
  assert.equal(intent.method, 'commitMove');
  assert.deepEqual(intent.args.slice(0, 3), [A, SESSION, '7']);
  assert.equal(intent.args[3], hashMovePayload({ sessionId: SESSION, rulesetHash: RULESET, moveNumber: 7n, move }));
  assert.equal(intent.authorization, 'WALLET_OR_SESSION');
  assert.equal(intent.backendMustNotSign, true);
});

test('stale, skipped, non-player and inactive move intents fail closed', () => {
  assert.throws(() => buildCommitMoveIntent({ session: activeSession(4n), actor: A, moveNumber: 3n, move: {} }), /stale\/skipped/);
  assert.throws(() => buildCommitMoveIntent({ session: activeSession(4n), actor: A, moveNumber: 5n, move: {} }), /stale\/skipped/);
  assert.throws(() => buildCommitMoveIntent({ session: activeSession(4n), actor: '0x00000000000000000000000000000000000000c3', moveNumber: 4n, move: {} }), /not a session player/);
  assert.throws(() => buildCommitMoveIntent({ session: { ...activeSession(4n), state: 'FINISHED', finishedAt: 10n }, actor: A, moveNumber: 4n, move: {} }), /active canonical session/);
});

test('canonical move history rejects gaps, duplicates and nextMoveNumber divergence', () => {
  const m1 = `0x${'33'.repeat(32)}`;
  const m2 = `0x${'44'.repeat(32)}`;
  assert.doesNotThrow(() => verifyCanonicalMoveHistory({ session: activeSession(3n), moves: [{ moveNumber: 2n, moveHash: m2 }, { moveNumber: 1n, moveHash: m1 }] }));
  assert.throws(() => verifyCanonicalMoveHistory({ session: activeSession(3n), moves: [{ moveNumber: 1n, moveHash: m1 }, { moveNumber: 3n, moveHash: m2 }] }), /gap\/replay/);
  assert.throws(() => verifyCanonicalMoveHistory({ session: activeSession(3n), moves: [{ moveNumber: 1n, moveHash: m1 }, { moveNumber: 1n, moveHash: m2 }] }), /gap\/replay|duplicate/);
  assert.throws(() => verifyCanonicalMoveHistory({ session: activeSession(4n), moves: [{ moveNumber: 1n, moveHash: m1 }, { moveNumber: 2n, moveHash: m2 }] }), /nextMoveNumber mismatch/);
});

test('rebuild verifies every payload against canonical move commitments before replay', () => {
  const moves = [{ from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' }];
  const canonicalMoves = moves.map((move, index) => ({
    moveNumber: BigInt(index + 1),
    moveHash: hashMovePayload({ sessionId: SESSION, rulesetHash: RULESET, moveNumber: BigInt(index + 1), move })
  }));
  const engine = new DeterministicClientEngine(descriptor());
  const reducer = (state, move) => ({ ...state, moves: [...state.moves, move] });
  const rebuilt = rebuildAndVerify({ session: activeSession(3n), canonicalMoves, payloadMoves: moves, engine, initialState: { moves: [] }, reducer });
  assert.deepEqual(rebuilt.state.moves, moves);
  assert.equal(rebuilt.nextMoveNumber, 3n);
  assert.equal(rebuilt.trace.length, 2);
  assert.equal(rebuilt.authoritative, false);

  assert.throws(() => rebuildAndVerify({
    session: activeSession(3n),
    canonicalMoves,
    payloadMoves: [moves[0], { from: 'd7', to: 'd5' }],
    engine,
    initialState: { moves: [] },
    reducer
  }), /commitment divergence at move 2/);
});

test('bridge always re-reads canonical session before prepare/rebuild', async () => {
  let reads = 0;
  const moves = [{ cell: 4 }];
  const canonicalMoves = [{ moveNumber: 1n, moveHash: hashMovePayload({ sessionId: SESSION, rulesetHash: RULESET, moveNumber: 1n, move: moves[0] }) }];
  const engine = new DeterministicClientEngine(descriptor());
  const bridge = new BongGogglesMoveCommitmentBridge({
    async readSession() { reads += 1; return activeSession(reads === 1 ? 1n : 2n); },
    async listCanonicalMoves() { return canonicalMoves; },
    async readMovePayloads() { return moves; },
    resolveEngine() { return engine; }
  });

  const intent = await bridge.prepareMove({ sessionId: SESSION, actor: A, move: moves[0] });
  assert.equal(intent.moveNumber, 1n);
  const rebuilt = await bridge.rebuild({ sessionId: SESSION, initialState: { moves: [] }, reducer: (state, move) => ({ moves: [...state.moves, move] }) });
  assert.equal(rebuilt.nextMoveNumber, 2n);
  assert.equal(reads, 2);
});
