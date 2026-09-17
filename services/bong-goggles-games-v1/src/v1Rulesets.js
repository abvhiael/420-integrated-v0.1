'use strict';

const {
  sha256Hex,
  VersionedRulesetRegistry,
  DeterministicClientEngine,
  bindClientEngines
} = require('./rulesetRegistry');

function canonicalRulesetHash(rulesetId, rulesetVersion = '1.0.0') {
  return sha256Hex(Buffer.from(`420/BONG_GOGGLES/RULESET/${rulesetId}@${rulesetVersion}`, 'utf8'));
}

const BASE = Object.freeze({
  rulesetVersion: '1.0.0',
  engineVersion: '1.0.0',
  stateCodec: 'bg-stable-json-v1',
  moveCodec: 'bg-stable-json-v1',
  deterministic: true
});

const V1_RULESETS = Object.freeze([
  Object.freeze({ ...BASE, gameType: 'CRIBBAGE', rulesetId: 'cribbage-standard', engineId: 'bg-cribbage-v1', rulesetHash: canonicalRulesetHash('cribbage-standard'), hiddenState: true, randomnessRequired: true }),
  Object.freeze({ ...BASE, gameType: 'RUSSIAN_CRIBBAGE', rulesetId: 'russian-cribbage-standard', engineId: 'bg-russian-cribbage-v1', rulesetHash: canonicalRulesetHash('russian-cribbage-standard'), hiddenState: true, randomnessRequired: true }),
  Object.freeze({ ...BASE, gameType: 'CHESS', rulesetId: 'chess-standard', engineId: 'bg-chess-v1', rulesetHash: canonicalRulesetHash('chess-standard'), hiddenState: false, randomnessRequired: false }),
  Object.freeze({ ...BASE, gameType: 'WORD_GAME', rulesetId: 'word-game-standard', engineId: 'bg-word-game-v1', rulesetHash: canonicalRulesetHash('word-game-standard'), hiddenState: true, randomnessRequired: true }),
  Object.freeze({ ...BASE, gameType: 'CHECKERS', rulesetId: 'checkers-standard', engineId: 'bg-checkers-v1', rulesetHash: canonicalRulesetHash('checkers-standard'), hiddenState: false, randomnessRequired: false }),
  Object.freeze({ ...BASE, gameType: 'BACKGAMMON', rulesetId: 'backgammon-standard', engineId: 'bg-backgammon-v1', rulesetHash: canonicalRulesetHash('backgammon-standard'), hiddenState: false, randomnessRequired: true }),
  Object.freeze({ ...BASE, gameType: 'DOMINOES', rulesetId: 'dominoes-standard', engineId: 'bg-dominoes-v1', rulesetHash: canonicalRulesetHash('dominoes-standard'), hiddenState: true, randomnessRequired: true })
]);

function createV1RulesetRegistry() {
  return new VersionedRulesetRegistry(V1_RULESETS);
}

const ENGINE_FACTORIES = Object.freeze(Object.fromEntries(
  V1_RULESETS.map((descriptor) => [
    descriptor.engineId,
    (resolvedDescriptor) => new DeterministicClientEngine(resolvedDescriptor)
  ])
));

function createV1ClientEngines(registry = createV1RulesetRegistry()) {
  return bindClientEngines(registry, ENGINE_FACTORIES);
}

module.exports = {
  canonicalRulesetHash,
  V1_RULESETS,
  ENGINE_FACTORIES,
  createV1RulesetRegistry,
  createV1ClientEngines
};
