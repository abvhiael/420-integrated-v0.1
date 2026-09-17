'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  requireResolvedRandomness,
  hiddenCommitment,
  verifyHiddenReveal,
  deriveHiddenStateSeed,
  BongGogglesRandomnessHiddenStateBridge
} = require('../src/randomnessHiddenState');
const { V1_RULESETS, createV1RulesetRegistry } = require('../src/v1Rulesets');

const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const SID = '0x' + 'ab'.repeat(32);
const RAND = '0x' + 'cd'.repeat(32);
const RNG = '0x' + 'ef'.repeat(32);
const PROOF = '0x' + '12'.repeat(32);
const RID = '0x' + '34'.repeat(32);

const cribbage = V1_RULESETS.find((r) => r.gameType === 'CRIBBAGE');
const chess = V1_RULESETS.find((r) => r.gameType === 'CHESS');

function session(descriptor = cribbage, randomnessRef = RAND) {
  return {
    exists: true,
    sessionId: SID,
    playerA: A,
    playerB: B,
    gameType: descriptor.gameType,
    rulesetHash: descriptor.rulesetHash,
    randomnessRef,
    createdAt: 1,
    startedAt: 2,
    finishedAt: 0,
    nextMoveNumber: 1,
    state: 'ACTIVE',
    winner: '0x0000000000000000000000000000000000000000'
  };
}

test('randomness-required ruleset requires fulfilled exact randomnessRef', () => {
  const resolved = requireResolvedRandomness({
    session: session(),
    descriptor: cribbage,
    result: { requestId: RAND, status: 'FULFILLED', randomness: RNG, proofHash: PROOF, resolvedAt: 5 }
  });
  assert.equal(resolved.required, true);
  assert.equal(resolved.randomness, RNG);

  assert.throws(() => requireResolvedRandomness({ session: session(), descriptor: cribbage, result: { requestId: RID, status: 'FULFILLED', randomness: RNG, proofHash: PROOF } }), /mismatch/);
  assert.throws(() => requireResolvedRandomness({ session: session(), descriptor: cribbage, result: { requestId: RAND, status: 'REQUESTED' } }), /unresolved/);
});

test('non-random ruleset does not require a resolver result', () => {
  const resolved = requireResolvedRandomness({ session: session(chess, '0x' + '00'.repeat(32)), descriptor: chess, result: null });
  assert.equal(resolved.required, false);
});

test('hidden reveal verifies exact commitment and rejects mismatch', () => {
  const reveal = { card: '5H', salt: 'secret-1' };
  const commitment = hiddenCommitment({ sessionId: SID, rulesetHash: cribbage.rulesetHash, scope: RID, reveal });
  const ok = verifyHiddenReveal({
    session: session(), descriptor: cribbage,
    record: { revealId: RID, commitment, moveNumber: 1, randomnessRef: RAND },
    reveal, currentMoveNumber: 1
  });
  assert.equal(ok.verified, true);
  assert.throws(() => verifyHiddenReveal({ session: session(), descriptor: cribbage, record: { revealId: RID, commitment, moveNumber: 1, randomnessRef: RAND }, reveal: { card: '6H', salt: 'secret-1' }, currentMoveNumber: 1 }), /commitment mismatch/);
});

test('hidden reveal rejects duplicate, stale randomness and premature reveal', () => {
  const reveal = { tile: 7, salt: 'x' };
  const commitment = hiddenCommitment({ sessionId: SID, rulesetHash: cribbage.rulesetHash, scope: RID, reveal });
  assert.throws(() => verifyHiddenReveal({ session: session(), descriptor: cribbage, record: { revealId: RID, commitment, moveNumber: 1, randomnessRef: RAND }, reveal, seenRevealIds: new Set([RID]), currentMoveNumber: 1 }), /duplicate reveal/);
  assert.throws(() => verifyHiddenReveal({ session: session(), descriptor: cribbage, record: { revealId: RID, commitment, moveNumber: 1, randomnessRef: RNG }, reveal, currentMoveNumber: 1 }), /stale randomness/);
  assert.throws(() => verifyHiddenReveal({ session: session(), descriptor: cribbage, record: { revealId: RID, commitment, moveNumber: 3, randomnessRef: RAND }, reveal, currentMoveNumber: 2 }), /premature/);
});

test('hidden state seed is deterministic and binds canonical randomnessRef', () => {
  const one = deriveHiddenStateSeed({ session: session(), descriptor: cribbage, randomness: RNG });
  const two = deriveHiddenStateSeed({ session: session(), descriptor: cribbage, randomness: RNG });
  assert.equal(one, two);
  assert.notEqual(one, deriveHiddenStateSeed({ session: session(cribbage, RID), descriptor: cribbage, randomness: RNG }));
});

test('bridge resolves provider-neutral 420Randomness by canonical reference', async () => {
  const registry = createV1RulesetRegistry();
  const calls = [];
  const bridge = new BongGogglesRandomnessHiddenStateBridge({
    readSession: async () => session(),
    resolveRuleset: (hash, gameType) => registry.resolve(hash, gameType),
    resolveRandomness: async (requestId) => {
      calls.push(requestId);
      return { requestId, status: 'FULFILLED', randomness: RNG, proofHash: PROOF, resolvedAt: 5 };
    }
  });
  const result = await bridge.resolve(SID);
  assert.deepEqual(calls, [RAND]);
  assert.equal(result.randomness.randomness, RNG);
});
