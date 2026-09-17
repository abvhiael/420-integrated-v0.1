import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BongGogglesMediaUploadBridge,
  buildStoragePrepareRequest,
  mediaUploadIdempotencyKey,
  verifyStorageReceipt,
} from '../src/uploadBridge.js';

const H = (c) => `0x${c.repeat(64)}`;
const OWNER = `0x${'1'.repeat(40)}`;

function descriptor() {
  return {
    version: 'bg-media-manifest-v1',
    owner: OWNER,
    mediaType: 'IMAGE',
    items: [{
      itemId: H('2'),
      role: 'ORIGINAL',
      mimeType: 'image/jpeg',
      byteSize: 123,
      storageObject: {
        objectId: H('3'),
        manifestId: H('4'),
        shardIndex: 0,
        shardRoot: H('5'),
        sizeBytes: 123,
        commitmentId: H('6'),
      },
      derivativeOf: null,
      width: 100,
      height: 50,
      durationMs: null,
    }],
  };
}

function preconditions() {
  return { agreementId: H('7'), capacityReservationId: H('8'), commitmentId: H('6') };
}

test('builds exact 420Storage v1 prepare request from descriptor identity', () => {
  const d = descriptor();
  const req = buildStoragePrepareRequest({ descriptor: d, itemId: H('2'), preconditions: preconditions() });
  assert.equal(req.version, 'v1');
  assert.deepEqual(req.object, {
    object_id: H('3'),
    manifest_id: H('4'),
    shard_index: 0,
    shard_root: '5'.repeat(64),
    size_bytes: 123,
    commitment_id: H('6'),
  });
  assert.equal(req.preconditions.commitment_id, H('6'));
  assert.match(req.idempotency_key, /^[0-9a-f]{64}$/);
});

test('idempotency key is deterministic and item-bound', () => {
  const d = descriptor();
  assert.equal(mediaUploadIdempotencyKey(d, H('2')), mediaUploadIdempotencyKey(d, H('2')));
  assert.notEqual(mediaUploadIdempotencyKey(d, H('2'), 'a'), mediaUploadIdempotencyKey(d, H('2'), 'b'));
});

test('rejects commitment precondition that disagrees with descriptor', () => {
  assert.throws(() => buildStoragePrepareRequest({
    descriptor: descriptor(),
    itemId: H('2'),
    preconditions: { ...preconditions(), commitmentId: H('9') },
  }), /commitment does not match/);
});

test('bridge preserves storage prepare plan and marks it non-authoritative', async () => {
  let seen;
  const bridge = new BongGogglesMediaUploadBridge({
    prepareUpload: async (req) => {
      seen = req;
      return {
        version: 'v1', upload_id: 'upload-1', idempotency_key: req.idempotency_key,
        preconditions: req.preconditions, object: req.object, provider_id: 'p', node_id: 'n', service_id: 's',
      };
    },
    ingestUpload: async () => { throw new Error('unused'); },
  });
  const result = await bridge.prepare({ descriptor: descriptor(), itemId: H('2'), preconditions: preconditions() });
  assert.equal(result.authoritative, false);
  assert.equal(result.plan.upload_id, 'upload-1');
  assert.equal(seen.object.object_id, H('3'));
});

test('ingest verifies receipt identity and returns presentation evidence only', async () => {
  const d = descriptor();
  const req = buildStoragePrepareRequest({ descriptor: d, itemId: H('2'), preconditions: preconditions() });
  const plan = { version: 'v1', upload_id: 'upload-1', idempotency_key: req.idempotency_key, preconditions: req.preconditions, object: req.object, service_id: 's' };
  const receipt = {
    version: 'v1', upload_id: 'upload-1', object: req.object, provider_id: 'p', node_id: 'n', service_id: 's',
    size_bytes: 123, shard_root: '5'.repeat(64),
  };
  const bridge = new BongGogglesMediaUploadBridge({ prepareUpload: async () => plan, ingestUpload: async () => receipt });
  const result = await bridge.ingest({ descriptor: d, itemId: H('2'), plan, body: Buffer.from('payload') });
  assert.equal(result.authoritative, false);
  assert.equal(result.uploadId, 'upload-1');
  assert.equal(result.shardRoot, H('5'));
});

test('receipt mismatch fails closed', () => {
  const d = descriptor();
  const req = buildStoragePrepareRequest({ descriptor: d, itemId: H('2'), preconditions: preconditions() });
  const plan = { version: 'v1', upload_id: 'upload-1', idempotency_key: req.idempotency_key, preconditions: req.preconditions, object: req.object, service_id: 's' };
  assert.throws(() => verifyStorageReceipt({
    descriptor: d,
    itemId: H('2'),
    plan,
    receipt: { version: 'v1', upload_id: 'upload-1', object: req.object, size_bytes: 123, shard_root: '0'.repeat(64) },
  }), /shard root mismatch/);
});
