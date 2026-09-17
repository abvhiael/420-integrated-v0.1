'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeDescriptor,
  VersionedRulesetRegistry,
  DeterministicClientEngine,
  bindClientEngines,
  sha256Hex
} = require('../src/rulesetRegistry');
const {
  V1_RULESETS,
  canonicalRulesetHash,
  createV1RulesetRegistry,
  createV1ClientEngines
} = require('../src/v1Rulesets');

const ZERO = `0x${'0'.repeat(64)}`;

test('V1 catalog covers all seven canonical game types with stable unique hashes', () => {
  assert.equal(V1_RULESETS.length, 7);
  assert.deepEqual(
    V1_RULESETS.map((x) => x.gameType).sort(),
    ['BACKGAMMON', 'CHECKERS', 'CHESS', 'CRIBBAGE', 'DOMINOES', 'RUSSIAN_CRIBBAGE', 'WORD_GAME'].sort()
  );
  assert.equal(new Set(V1_RULESETS.map((x) => x.rulesetHash)).size, 7);
  for (const descriptor of V1_RULESETS) {
    assert.equal(descriptor.rulesetHash, canonicalRulesetHash(descriptor.rulesetId, descriptor.rulesetVersion));
  }
});

test('descriptor normalization produces deterministic descriptor digest', () => {
  const raw = V1_RULESETS.find((x) => x.gameType === 'CHESS');
  const a = normalizeDescriptor(raw);
  const b = normalizeDescriptor({
    moveCodec: raw.moveCodec,
    hiddenState: raw.hiddenState,
    gameType: raw.gameType,
    rulesetHash: raw.rulesetHash,
    engineVersion: raw.engineVersion,
    stateCodec: raw.stateCodec,
    engineId: raw.engineId,
    rulesetVersion: raw.rulesetVersion,
    rulesetId: raw.rulesetId,
    randomnessRequired: raw.randomnessRequired,
    deterministic: raw.deterministic
  });
  assert.equal(a.descriptorDigest, b.descriptorDigest);
});

test('registry rejects unknown hashes, duplicate identities and game/hash mismatches', () => {
  const registry = createV1RulesetRegistry();
  assert.throws(() => registry.resolve(`0x${'9'.repeat(64)}`), /unknown rulesetHash/);
  const chess = V1_RULESETS.find((x) => x.gameType === 'CHESS');
  assert.throws(() => registry.resolve(chess.rulesetHash, 'CHECKERS'), /ruleset\/game mismatch/);
  assert.throws(() => registry.register(chess), /duplicate rulesetHash/);
});

test('registry resolves a canonical session by exact rulesetHash and game type', () => {
  const registry = createV1RulesetRegistry();
  const checkers = V1_RULESETS.find((x) => x.gameType === 'CHECKERS');
  const resolved = registry.resolveSession({ gameType: 'CHECKERS', rulesetHash: checkers.rulesetHash });
  assert.equal(resolved.engineId, 'bg-checkers-v1');
  assert.equal(resolved.rulesetVersion, '1.0.0');
});

test('all V1 client engine bindings resolve only the exact descriptor', () => {
  const registry = createV1RulesetRegistry();
  const engines = createV1ClientEngines(registry);
  for (const descriptor of registry.list()) {
    const engine = engines.resolve(descriptor.rulesetHash, descriptor.gameType);
    assert.equal(engine.descriptor.rulesetHash, descriptor.rulesetHash);
    assert.equal(engine.descriptor.engineVersion, descriptor.engineVersion);
  }
});

test('client engine stable codecs give identical bytes despite object key order', () => {
  const descriptor = V1_RULESETS.find((x) => x.gameType === 'CHESS');
  const engine = new DeterministicClientEngine(descriptor);
  const a = engine.encodeMove({ from: 'e2', to: 'e4', promotion: null });
  const b = engine.encodeMove({ promotion: null, to: 'e4', from: 'e2' });
  assert.deepEqual(a, b);
  assert.equal(engine.moveDigest({ from: 'e2', to: 'e4', promotion: null }), engine.moveDigest({ promotion: null, to: 'e4', from: 'e2' }));
});

test('deterministic replay produces stable cross-client replay vectors', () => {
  const descriptor = V1_RULESETS.find((x) => x.gameType === 'CHECKERS');
  const engineA = new DeterministicClientEngine(descriptor);
  const engineB = new DeterministicClientEngine(descriptor);
  const moves = [
    { from: 9, to: 13 },
    { from: 22, to: 18 },
    { from: 13, to: 17 }
  ];
  const reducer = (state, move, moveNumber) => ({ moves: [...state.moves, { moveNumber, ...move }] });
  const a = engineA.replay({ moves: [] }, moves, reducer);
  const b = engineB.replay({ moves: [] }, moves, reducer);
  assert.equal(a.stateDigest, b.stateDigest);
  assert.deepEqual(a.trace, b.trace);
  assert.equal(a.trace.length, 3);
});

test('engine binding fails closed if an implementation is missing or mismatched', () => {
  const chess = normalizeDescriptor(V1_RULESETS.find((x) => x.gameType === 'CHESS'));
  const registry = new VersionedRulesetRegistry([chess]);
  assert.throws(() => bindClientEngines(registry, {}), /missing client engine implementation/);
  assert.throws(() => bindClientEngines(registry, {
    [chess.engineId]: () => ({ descriptor: { rulesetHash: `0x${'1'.repeat(64)}` } })
  }), /client engine descriptor mismatch/);
});

test('invalid descriptors fail closed', () => {
  const chess = V1_RULESETS.find((x) => x.gameType === 'CHESS');
  assert.throws(() => normalizeDescriptor({ ...chess, rulesetHash: ZERO }), /nonzero bytes32/);
  assert.throws(() => normalizeDescriptor({ ...chess, gameType: 'POKER' }), /unsupported gameType/);
  assert.throws(() => normalizeDescriptor({ ...chess, deterministic: false }), /must be deterministic/);
  assert.match(sha256Hex(Buffer.from('abc')), /^0x[0-9a-f]{64}$/);
});
