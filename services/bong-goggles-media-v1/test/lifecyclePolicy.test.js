import test from 'node:test';
import assert from 'node:assert/strict';
import { BongGogglesMediaLifecyclePolicy, retentionDisposition } from '../src/lifecyclePolicy.js';

const H = (c) => `0x${c.repeat(64)}`;
const OWNER = `0x${'1'.repeat(40)}`;
const VIEWER = `0x${'2'.repeat(40)}`;

function descriptor() {
  return {
    version: 'bg-media-manifest-v1', owner: OWNER, mediaType: 'IMAGE',
    items: [{ itemId: H('a'), role: 'ORIGINAL', mimeType: 'image/jpeg', byteSize: 10,
      storageObject: { objectId: H('b'), manifestId: H('c'), shardIndex: 0, shardRoot: H('d'), sizeBytes: 10, commitmentId: H('e') } }],
  };
}
function social(overrides = {}) {
  return { objectId: H('1'), author: OWNER, mediaRoot: H('3'), audienceType: 'FRIENDS', audienceRef: H('0'), version: 2, status: 'ACTIVE', exists: true, ...overrides };
}
function policy(overrides = {}) {
  return new BongGogglesMediaLifecyclePolicy({
    readSocialObject: async () => social(),
    readMediaRootAtVersion: async (_objectId, version) => version === 1 ? H('2') : H('3'),
    canView: async () => true,
    ...overrides,
  });
}

test('current active binding is presentation eligible only after audience revalidation', async () => {
  let calls = 0;
  const p = policy({ canView: async ({ viewer, author, audienceType }) => { calls++; return viewer === VIEWER && author === OWNER && audienceType === 'FRIENDS'; } });
  const state = await p.assertDeliverable({ objectId: H('1'), descriptor: descriptor(), mediaRoot: H('3'), itemId: H('a'), viewer: VIEWER });
  assert.equal(state.presentationEligible, true);
  assert.equal(calls, 1);
});

test('historical version keeps immutable storage history but is not normal presentation eligible', async () => {
  const state = await policy().inspect({ objectId: H('1'), descriptor: descriptor(), mediaRoot: H('2'), itemId: H('a'), viewer: VIEWER, version: 1 });
  assert.equal(state.historical, true);
  assert.equal(state.storageHistoryImmutable, true);
  assert.equal(state.presentationEligible, false);
  await assert.rejects(() => policy().assertDeliverable({ objectId: H('1'), descriptor: descriptor(), mediaRoot: H('2'), itemId: H('a'), viewer: VIEWER, version: 1 }), /historical or superseded/);
});

test('hidden deleted and removed objects stop normal media delivery without rewriting storage history', async () => {
  for (const status of ['HIDDEN', 'DELETED', 'REMOVED']) {
    const p = policy({ readSocialObject: async () => social({ status }) });
    const state = await p.inspect({ objectId: H('1'), descriptor: descriptor(), mediaRoot: H('3'), itemId: H('a'), viewer: VIEWER });
    assert.equal(state.presentationEligible, false);
    assert.equal(state.storageHistoryImmutable, true);
    await assert.rejects(() => p.assertDeliverable({ objectId: H('1'), descriptor: descriptor(), mediaRoot: H('3'), itemId: H('a'), viewer: VIEWER }), new RegExp(status));
  }
});

test('audience authorization is rechecked and denied requests fail closed', async () => {
  const p = policy({ canView: async () => false });
  await assert.rejects(() => p.assertDeliverable({ objectId: H('1'), descriptor: descriptor(), mediaRoot: H('3'), itemId: H('a'), viewer: VIEWER }), /audience authorization denied/);
});

test('retired derivative is removed from active presentation but history remains intact', async () => {
  const p = policy({ isDerivativeRetired: async ({ itemId }) => itemId === H('a') });
  const state = await p.inspect({ objectId: H('1'), descriptor: descriptor(), mediaRoot: H('3'), itemId: H('a'), viewer: VIEWER });
  assert.equal(state.derivativeRetired, true);
  assert.equal(state.storageHistoryImmutable, true);
  await assert.rejects(() => p.assertDeliverable({ objectId: H('1'), descriptor: descriptor(), mediaRoot: H('3'), itemId: H('a'), viewer: VIEWER }), /derivative retired/);
});

test('media root must match the exact social-object version and owner', async () => {
  await assert.rejects(() => policy().inspect({ objectId: H('1'), descriptor: descriptor(), mediaRoot: H('9'), itemId: H('a'), viewer: VIEWER }), /media root does not match/);
  const badDescriptor = { ...descriptor(), owner: `0x${'9'.repeat(40)}` };
  await assert.rejects(() => policy().inspect({ objectId: H('1'), descriptor: badDescriptor, mediaRoot: H('3'), itemId: H('a'), viewer: VIEWER }), /owner does not match/);
});

test('retention disposition separates presentation lifecycle from canonical storage history', () => {
  assert.deepEqual(retentionDisposition({ socialStatus: 'DELETED', requestedVersion: 2, currentVersion: 2 }), {
    preserveCanonicalStorageHistory: true,
    normalPresentationAllowed: false,
    tombstonePresentation: true,
    hiddenPresentation: false,
    historicalVersion: false,
    authoritative: false,
  });
  assert.equal(retentionDisposition({ socialStatus: 'ACTIVE', requestedVersion: 1, currentVersion: 2 }).historicalVersion, true);
});
