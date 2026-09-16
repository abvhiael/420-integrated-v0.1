import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  BongGogglesMediaDerivativeCoordinator,
  buildDerivativeItem,
  buildDerivativeJobRequest,
  derivativeInputRef,
  normalizeDerivativeProfiles,
} from '../src/mediaDerivatives.js';

const H = (c) => `0x${c.repeat(64)}`;
const OWNER = `0x${'1'.repeat(40)}`;

function descriptor() {
  return {
    version: 'bg-media-manifest-v1', owner: OWNER, mediaType: 'IMAGE',
    items: [{ itemId: H('2'), role: 'ORIGINAL', mimeType: 'image/jpeg', byteSize: 3,
      storageObject: { objectId: H('3'), manifestId: H('4'), shardIndex: 0, shardRoot: `0x${createHash('sha256').update(Buffer.from('abc')).digest('hex')}`, sizeBytes: 3, commitmentId: H('6') } }],
  };
}

function profiles() {
  return {
    THUMBNAIL: { capabilityId: H('a'), profileId: 'image-thumb-v1', outputMimeType: 'image/webp' },
    POSTER: { capabilityId: H('b'), profileId: 'video-poster-v1', outputMimeType: 'image/webp' },
    PREVIEW: { capabilityId: H('c'), profileId: 'video-preview-v1', outputMimeType: 'video/mp4' },
    TRANSCODE: { capabilityId: H('d'), profileId: 'video-h264-720p-v1', outputMimeType: 'video/mp4' },
  };
}

function result() {
  return {
    itemId: H('e'), mimeType: 'image/webp', width: 320, height: 180,
    storageObject: { objectId: H('f'), manifestId: H('7'), shardIndex: 0, shardRoot: H('8'), sizeBytes: 99, commitmentId: H('9') },
  };
}

test('derivative profiles require operator-controlled configured capability/profile pairs', () => {
  const catalog = normalizeDerivativeProfiles(profiles());
  assert.equal(catalog.THUMBNAIL.profileId, 'image-thumb-v1');
  assert.equal(catalog.THUMBNAIL.capabilityId, H('a'));
  assert.throws(() => normalizeDerivativeProfiles({}), /at least one derivative profile required/);
});

test('builds deterministic opaque input reference from canonical storage identity', () => {
  const ref1 = derivativeInputRef(descriptor(), H('2'));
  const ref2 = derivativeInputRef(descriptor(), H('2'));
  assert.equal(ref1, ref2);
  assert.match(ref1, /^0x[0-9a-f]{64}$/);
});

test('job request selects allowlisted capability/profile without executable command fragments', () => {
  const req = buildDerivativeJobRequest({ descriptor: descriptor(), itemId: H('2'), role: 'THUMBNAIL', profiles: profiles(), deadline: 1000 });
  assert.equal(req.capabilityId, H('a'));
  assert.equal(req.request.profileId, 'image-thumb-v1');
  assert.equal(req.request.role, 'THUMBNAIL');
  assert.equal(req.request.sourceItemId, H('2'));
  assert.equal(Object.prototype.hasOwnProperty.call(req.request, 'command'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(req.request, 'url'), false);
});

test('derivative item preserves explicit source provenance and verified storage identity', () => {
  const item = buildDerivativeItem({ descriptor: descriptor(), sourceItemId: H('2'), role: 'THUMBNAIL', result: result(), profiles: profiles() });
  assert.equal(item.derivativeOf, H('2'));
  assert.equal(item.role, 'THUMBNAIL');
  assert.equal(item.storageObject.objectId, H('f'));
  assert.equal(item.byteSize, 99);
});

test('coordinator validates created job capability and opaque input binding', async () => {
  const d = descriptor();
  const coordinator = new BongGogglesMediaDerivativeCoordinator({
    profiles: profiles(),
    createJob: async (request) => ({ jobId: H('1'), capabilityId: request.capabilityId, inputRef: request.inputRef, status: 'CREATED' }),
    readJob: async () => { throw new Error('unused'); },
    resolveResult: async () => { throw new Error('unused'); },
  });
  const created = await coordinator.request({ descriptor: d, itemId: H('2'), role: 'THUMBNAIL', deadline: 1000 });
  assert.equal(created.job.jobId, H('1'));
  assert.equal(created.authoritative, false);
});

test('collect only accepts successful result state, expected capability/input, and verified storage ref', async () => {
  const d = descriptor();
  let storageChecked = false;
  const coordinator = new BongGogglesMediaDerivativeCoordinator({
    profiles: profiles(),
    createJob: async () => { throw new Error('unused'); },
    readJob: async (jobId) => ({ jobId, capabilityId: H('a'), inputRef: derivativeInputRef(d, H('2')), status: 'VERIFIED', resultRef: H('5'), operatorId: H('4'), slaEvidenceHash: H('3') }),
    resolveResult: async () => result(),
    verifyStorageRef: async ({ derivative }) => { storageChecked = true; return derivative.storageObject.objectId === H('f'); },
  });
  const collected = await coordinator.collect({ descriptor: d, sourceItemId: H('2'), role: 'THUMBNAIL', jobId: H('1') });
  assert.equal(storageChecked, true);
  assert.equal(collected.derivative.derivativeOf, H('2'));
  assert.equal(collected.resultRef, H('5'));
  assert.equal(collected.authoritative, false);
});

test('fails closed on premature/failed jobs, capability mismatch and bad output MIME', async () => {
  const d = descriptor();
  const make = (job) => new BongGogglesMediaDerivativeCoordinator({ profiles: profiles(), createJob: async () => job, readJob: async () => job, resolveResult: async () => result() });
  await assert.rejects(() => make({ jobId: H('1'), capabilityId: H('a'), inputRef: derivativeInputRef(d, H('2')), status: 'RUNNING' }).collect({ descriptor: d, sourceItemId: H('2'), role: 'THUMBNAIL', jobId: H('1') }), /not ready/);
  await assert.rejects(() => make({ jobId: H('1'), capabilityId: H('a'), inputRef: derivativeInputRef(d, H('2')), status: 'FAILED' }).collect({ descriptor: d, sourceItemId: H('2'), role: 'THUMBNAIL', jobId: H('1') }), /job failed/);
  await assert.rejects(() => make({ jobId: H('1'), capabilityId: H('b'), inputRef: derivativeInputRef(d, H('2')), status: 'VERIFIED', resultRef: H('5') }).collect({ descriptor: d, sourceItemId: H('2'), role: 'THUMBNAIL', jobId: H('1') }), /capability mismatch/);
  assert.throws(() => buildDerivativeItem({ descriptor: d, sourceItemId: H('2'), role: 'THUMBNAIL', result: { ...result(), mimeType: 'image/png' }, profiles: profiles() }), /mime type mismatch/);
});
