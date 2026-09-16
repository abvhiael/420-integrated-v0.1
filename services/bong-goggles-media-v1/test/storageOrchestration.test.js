import test from 'node:test';
import assert from 'node:assert/strict';
import { BongGogglesStorageOrchestrator, placementIntent, sealIntent } from '../src/storageOrchestration.js';

const H = (c) => `0x${c.repeat(64)}`;
const OWNER = `0x${'1'.repeat(40)}`;

function descriptor() {
  return {
    version: 'bg-media-manifest-v1', owner: OWNER, mediaType: 'IMAGE',
    items: [{ itemId: H('2'), role: 'ORIGINAL', mimeType: 'image/jpeg', byteSize: 123,
      storageObject: { objectId: H('3'), manifestId: H('4'), shardIndex: 0, shardRoot: H('5'), sizeBytes: 123, commitmentId: H('6') } }],
  };
}

function manifest(overrides = {}) {
  return { controller: OWNER, objectId: H('3'), manifestHash: H('9'), dataShards: 1, totalShards: 1, placedShards: 0, isSealed: false, exists: true, ...overrides };
}
function agreement(overrides = {}) {
  return { consumer: OWNER, objectId: H('3'), manifestHash: H('9'), commitmentId: H('6'), capacityReservationId: H('8'), sizeBytes: 123, dataShards: 1, totalShards: 1, state: 'ACTIVE', exists: true, ...overrides };
}
function commitment(overrides = {}) {
  return { providerId: H('a'), nodeId: H('b'), contentRoot: H('c'), sizeBytes: 123, exists: true, ...overrides };
}
function placement(overrides = {}) {
  return { manifestId: H('4'), agreementId: H('7'), commitmentId: H('6'), nodeId: H('b'), shardRoot: H('5'), shardSizeBytes: 123, shardIndex: 0, exists: true, ...overrides };
}
function orchestrator(overrides = {}) {
  return new BongGogglesStorageOrchestrator({
    readManifest: async () => manifest(),
    readPlacement: async () => { throw new Error('missing'); },
    readAgreement: async () => agreement(),
    readCommitment: async () => commitment(),
    isAgreementEffective: async () => true,
    isCommitmentLive: async () => true,
    isRetrievable: async () => false,
    ...overrides,
  });
}

test('produces user-authorized placement intent when placement is absent', async () => {
  const result = await orchestrator().plan({ descriptor: descriptor(), itemId: H('2'), agreementId: H('7') });
  assert.equal(result.state.placementRequired, true);
  assert.equal(result.intents[0].method, 'registerPlacement');
  assert.equal(result.intents[0].requiresUserAuthorization, true);
  assert.deepEqual(result.intents[0].args, [H('4'), 0, H('7'), H('5'), 123]);
});

test('placement intent and seal intent are presentation-only transaction requests', () => {
  assert.equal(placementIntent({ descriptor: descriptor(), itemId: H('2'), agreementId: H('7') }).authoritative, false);
  const intent = sealIntent({ manifestId: H('4') });
  assert.equal(intent.method, 'sealManifest');
  assert.equal(intent.requiresUserAuthorization, true);
});

test('validates existing placement root size commitment and node provenance', async () => {
  const result = await orchestrator({ readPlacement: async () => placement() }).inspectItem({ descriptor: descriptor(), itemId: H('2'), agreementId: H('7') });
  assert.equal(result.placementRequired, false);
  assert.equal(result.commitment.nodeId, H('b'));
  assert.equal(result.agreementEffective, true);
  assert.equal(result.commitmentLive, true);
});

test('sealed is not delivery-ready unless canonical isRetrievable is true', async () => {
  const sealed = { readManifest: async () => manifest({ placedShards: 1, isSealed: true }), readPlacement: async () => placement() };
  const notReady = await orchestrator({ ...sealed, isRetrievable: async () => false }).inspectItem({ descriptor: descriptor(), itemId: H('2'), agreementId: H('7') });
  assert.equal(notReady.deliveryReady, false);
  const ready = await orchestrator({ ...sealed, isRetrievable: async () => true }).inspectItem({ descriptor: descriptor(), itemId: H('2'), agreementId: H('7') });
  assert.equal(ready.deliveryReady, true);
});

test('seal intent appears only when all shards are placed and manifest is unsealed', async () => {
  const result = await orchestrator({ readManifest: async () => manifest({ placedShards: 1 }) }).plan({ descriptor: descriptor(), itemId: H('2'), agreementId: H('7') });
  assert.equal(result.state.sealRequired, true);
  assert.equal(result.intents.some((intent) => intent.method === 'sealManifest'), true);
});

test('agreement and canonical placement mismatches fail closed', async () => {
  await assert.rejects(() => orchestrator({ readAgreement: async () => agreement({ commitmentId: H('d') }) }).inspectItem({ descriptor: descriptor(), itemId: H('2'), agreementId: H('7') }), /agreement commitment mismatch/);
  await assert.rejects(() => orchestrator({ readPlacement: async () => placement({ shardRoot: H('d') }) }).inspectItem({ descriptor: descriptor(), itemId: H('2'), agreementId: H('7') }), /placement root mismatch/);
});
