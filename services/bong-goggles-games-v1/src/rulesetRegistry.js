'use strict';

const crypto = require('node:crypto');
const { GAME_TYPES } = require('./sessionProjection');

const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
const RULESET_SCHEMA = 'bg-game-ruleset-v1';

function requiredString(value, field) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${field} must be a nonempty string`);
  return value;
}

function bytes32(value, field) {
  if (typeof value !== 'string' || !BYTES32_RE.test(value) || /^0x0{64}$/i.test(value)) {
    throw new TypeError(`${field} must be nonzero bytes32`);
  }
  return value.toLowerCase();
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
    return out;
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stable(value));
}

function sha256Hex(value) {
  return `0x${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function normalizeDescriptor(input) {
  if (!input || typeof input !== 'object') throw new TypeError('ruleset descriptor required');
  const gameType = requiredString(input.gameType, 'gameType');
  if (!GAME_TYPES.includes(gameType)) throw new RangeError('unsupported gameType');
  const descriptor = {
    schema: RULESET_SCHEMA,
    rulesetHash: bytes32(input.rulesetHash, 'rulesetHash'),
    gameType,
    rulesetId: requiredString(input.rulesetId, 'rulesetId'),
    rulesetVersion: requiredString(input.rulesetVersion, 'rulesetVersion'),
    engineId: requiredString(input.engineId, 'engineId'),
    engineVersion: requiredString(input.engineVersion, 'engineVersion'),
    stateCodec: requiredString(input.stateCodec, 'stateCodec'),
    moveCodec: requiredString(input.moveCodec, 'moveCodec'),
    hiddenState: input.hiddenState === true,
    randomnessRequired: input.randomnessRequired === true,
    deterministic: input.deterministic !== false
  };
  if (!descriptor.deterministic) throw new Error('BG-15 ruleset engines must be deterministic');
  return Object.freeze({ ...descriptor, descriptorDigest: sha256Hex(stableJson(descriptor)) });
}

class VersionedRulesetRegistry {
  constructor(descriptors = []) {
    this.byHash = new Map();
    this.byIdentity = new Map();
    for (const descriptor of descriptors) this.register(descriptor);
  }

  register(input) {
    const descriptor = normalizeDescriptor(input);
    const identity = `${descriptor.gameType}:${descriptor.rulesetId}:${descriptor.rulesetVersion}`;
    if (this.byHash.has(descriptor.rulesetHash)) throw new Error(`duplicate rulesetHash: ${descriptor.rulesetHash}`);
    if (this.byIdentity.has(identity)) throw new Error(`duplicate ruleset identity: ${identity}`);
    this.byHash.set(descriptor.rulesetHash, descriptor);
    this.byIdentity.set(identity, descriptor);
    return descriptor;
  }

  resolve(rulesetHash, expectedGameType) {
    const hash = bytes32(rulesetHash, 'rulesetHash');
    const descriptor = this.byHash.get(hash);
    if (!descriptor) throw new Error(`unknown rulesetHash: ${hash}`);
    if (expectedGameType !== undefined && descriptor.gameType !== expectedGameType) {
      throw new Error(`ruleset/game mismatch: expected ${expectedGameType}, got ${descriptor.gameType}`);
    }
    return descriptor;
  }

  resolveSession(session) {
    if (!session || typeof session !== 'object') throw new TypeError('session required');
    return this.resolve(session.rulesetHash, session.gameType);
  }

  list() {
    return [...this.byHash.values()].sort((a, b) => a.rulesetHash.localeCompare(b.rulesetHash));
  }
}

class DeterministicClientEngine {
  constructor(descriptor) {
    this.descriptor = normalizeDescriptor(descriptor);
  }

  encodeState(state) {
    return Buffer.from(stableJson(state), 'utf8');
  }

  decodeState(bytes) {
    const text = Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes);
    return JSON.parse(text);
  }

  encodeMove(move) {
    return Buffer.from(stableJson(move), 'utf8');
  }

  moveDigest(move) {
    return sha256Hex(this.encodeMove(move));
  }

  replay(initialState, moves, reducer) {
    if (typeof reducer !== 'function') throw new TypeError('deterministic reducer required');
    let state = initialState;
    const trace = [];
    for (let index = 0; index < moves.length; index += 1) {
      const move = moves[index];
      const encodedMove = this.encodeMove(move);
      state = reducer(state, move, index + 1);
      trace.push(Object.freeze({
        moveNumber: index + 1,
        moveDigest: sha256Hex(encodedMove),
        stateDigest: sha256Hex(this.encodeState(state))
      }));
    }
    return Object.freeze({ state, stateDigest: sha256Hex(this.encodeState(state)), trace: Object.freeze(trace) });
  }
}

function bindClientEngines(registry, engineFactories) {
  const engines = new Map();
  for (const descriptor of registry.list()) {
    const factory = engineFactories[descriptor.engineId];
    if (typeof factory !== 'function') throw new Error(`missing client engine implementation: ${descriptor.engineId}`);
    const engine = factory(descriptor);
    if (!engine || engine.descriptor?.rulesetHash !== descriptor.rulesetHash) {
      throw new Error(`client engine descriptor mismatch: ${descriptor.rulesetHash}`);
    }
    engines.set(descriptor.rulesetHash, engine);
  }
  return Object.freeze({
    resolve(rulesetHash, expectedGameType) {
      const descriptor = registry.resolve(rulesetHash, expectedGameType);
      const engine = engines.get(descriptor.rulesetHash);
      if (!engine) throw new Error(`client engine unavailable: ${descriptor.rulesetHash}`);
      return engine;
    }
  });
}

module.exports = {
  RULESET_SCHEMA,
  stableJson,
  sha256Hex,
  normalizeDescriptor,
  VersionedRulesetRegistry,
  DeterministicClientEngine,
  bindClientEngines
};
