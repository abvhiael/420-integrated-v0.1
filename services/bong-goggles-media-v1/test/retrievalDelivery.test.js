import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  BongGogglesMediaDeliveryService,
  buildStorageRetrieveRequest,
  parseByteRange,
  verifyRetrievedObject,
} from '../src/retrievalDelivery.js';

const H = (c) => `0x${c.repeat(64)}`;
const OWNER = `0x${'1'.repeat(40)}`;
const PAYLOAD = Buffer.from('verified bong goggles media payload');
const ROOT = `0x${createHash('sha256').update(PAYLOAD).digest('hex')}`;

function descriptor() {
  return {
    version: 'bg-media-manifest-v1', owner: OWNER, mediaType: 'IMAGE',
    items: [{ itemId: H('2'), role: 'ORIGINAL', mimeType: 'image/jpeg', byteSize: PAYLOAD.length,
      storageObject: { objectId: H('3'), manifestId: H('4'), shardIndex: 0, shardRoot: ROOT, sizeBytes: PAYLOAD.length, commitmentId: H('6') } }],
  };
}

function storageResult(overrides = {}) {
  return {
    version: 'v1',
    object: {
      object_id: H('3'), manifest_id: H('4'), shard_index: 0,
      shard_root: ROOT.slice(2), size_bytes: PAYLOAD.length, commitment_id: H('6'),
    },
    route: { tier: 'cache', provider_id: H('a'), node_id: H('b') },
    payload: Buffer.from(PAYLOAD),
    ...overrides,
  };
}

test('builds exact 420Storage v1 retrieve DTO for public access', () => {
  const req = buildStorageRetrieveRequest({ descriptor: descriptor(), itemId: H('2') });
  assert.equal(req.version, 'v1');
  assert.equal(req.access.mode, 'public');
  assert.equal(req.object.object_id, H('3'));
  assert.equal(req.object.shard_root, ROOT.slice(2));
});

test('GET verifies full object before returning client-safe delivery envelope', async () => {
  let seen;
  const service = new BongGogglesMediaDeliveryService({
    retrieveObject: async (req) => { seen = req; return storageResult(); },
    isDeliveryReady: async () => true,
  });
  const result = await service.deliver({ descriptor: descriptor(), itemId: H('2') });
  assert.equal(result.status, 200);
  assert.equal(result.verified, true);
  assert.equal(result.authoritative, false);
  assert.deepEqual(result.body, PAYLOAD);
  assert.equal(result.headers['content-type'], 'image/jpeg');
  assert.equal(result.route.tier, 'cache');
  assert.equal(result.route.authoritative, false);
  assert.equal(seen.access.mode, 'public');
});

test('HEAD returns verified metadata with no body', async () => {
  const service = new BongGogglesMediaDeliveryService({ retrieveObject: async () => storageResult() });
  const result = await service.deliver({ descriptor: descriptor(), itemId: H('2'), method: 'HEAD' });
  assert.equal(result.status, 200);
  assert.equal(result.body.length, 0);
  assert.equal(result.byteLength, PAYLOAD.length);
  assert.equal(result.headers['content-length'], String(PAYLOAD.length));
});

test('single byte ranges are applied only after full payload verification', async () => {
  const service = new BongGogglesMediaDeliveryService({ retrieveObject: async () => storageResult() });
  const result = await service.deliver({ descriptor: descriptor(), itemId: H('2'), range: 'bytes=2-8' });
  assert.equal(result.status, 206);
  assert.deepEqual(result.body, PAYLOAD.subarray(2, 9));
  assert.equal(result.headers['content-range'], `bytes 2-8/${PAYLOAD.length}`);
  assert.deepEqual(parseByteRange('bytes=-4', PAYLOAD.length), { start: PAYLOAD.length - 4, end: PAYLOAD.length - 1, length: 4 });
  assert.throws(() => parseByteRange('bytes=999-', PAYLOAD.length), /unsatisfiable/);
  assert.throws(() => parseByteRange('bytes=0-1,4-5', PAYLOAD.length), /invalid byte range/);
});

test('private delivery is default-deny and forwards only trusted normalized read context', async () => {
  const access = { mode: 'private', subject: 'profile:alice', sessionId: 'session-1' };
  const denied = new BongGogglesMediaDeliveryService({ retrieveObject: async () => storageResult() });
  await assert.rejects(() => denied.deliver({ descriptor: descriptor(), itemId: H('2'), access }), /access denied/);

  let authorizedContext;
  let request;
  const allowed = new BongGogglesMediaDeliveryService({
    authorizePrivate: async (ctx) => { authorizedContext = ctx; return true; },
    retrieveObject: async (req) => { request = req; return storageResult(); },
  });
  const result = await allowed.deliver({ descriptor: descriptor(), itemId: H('2'), access });
  assert.equal(result.status, 200);
  assert.equal(authorizedContext.capability, 'read');
  assert.deepEqual(request.access, { mode: 'private', subject: 'profile:alice', session_id: 'session-1', capability: 'read' });
});

test('canonical delivery readiness can fail closed before Gateway retrieval', async () => {
  let called = false;
  const service = new BongGogglesMediaDeliveryService({
    isDeliveryReady: async () => false,
    retrieveObject: async () => { called = true; return storageResult(); },
  });
  await assert.rejects(() => service.deliver({ descriptor: descriptor(), itemId: H('2') }), /not canonically retrievable/);
  assert.equal(called, false);
});

test('retrieval identity size and SHA-256 mismatches fail closed', () => {
  assert.throws(() => verifyRetrievedObject({
    descriptor: descriptor(), itemId: H('2'),
    result: storageResult({ object: { ...storageResult().object, commitment_id: H('d') } }),
  }), /object mismatch: commitment_id/);
  assert.throws(() => verifyRetrievedObject({
    descriptor: descriptor(), itemId: H('2'), result: storageResult({ payload: Buffer.from('wrong') }),
  }), /size mismatch/);
  const sameSizeWrong = Buffer.alloc(PAYLOAD.length, 0x78);
  assert.throws(() => verifyRetrievedObject({
    descriptor: descriptor(), itemId: H('2'), result: storageResult({ payload: sameSizeWrong }),
  }), /shard root mismatch/);
});
