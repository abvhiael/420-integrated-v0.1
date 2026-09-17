import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BongGogglesMediaManifestResolver,
  canonicalManifestDescriptorJson,
  manifestDescriptorDigest,
  normalizeManifestDescriptor,
  verifyDescriptorAgainstCanonicalManifest,
} from '../src/manifestDescriptor.js';

const h = (c) => `0x${c.repeat(64)}`;
const OWNER = `0x${'a'.repeat(40)}`;
const ROOT = h('1');

function original(overrides = {}) {
  return {
    itemId: h('2'),
    role: 'ORIGINAL',
    mimeType: 'image/jpeg',
    byteSize: 1234,
    storageObject: {
      objectId: h('3'),
      manifestId: h('4'),
      shardIndex: 0,
      shardRoot: h('5'),
      sizeBytes: 1234,
      commitmentId: h('6'),
    },
    ...overrides,
  };
}

function descriptor(overrides = {}) {
  return {
    version: 'bg-media-manifest-v1',
    owner: OWNER,
    mediaType: 'IMAGE',
    items: [original()],
    ...overrides,
  };
}

function canonicalFor(d = descriptor(), overrides = {}) {
  return {
    mediaRoot: ROOT,
    owner: OWNER,
    mediaType: 0,
    manifestHash: manifestDescriptorDigest(d),
    itemCount: d.items.length,
    createdAt: 100,
    exists: true,
    ...overrides,
  };
}

test('descriptor encoding and digest are deterministic across object key order', () => {
  const a = descriptor();
  const b = {
    items: [{
      storageObject: {
        commitmentId: h('6'),
        sizeBytes: 1234,
        shardRoot: h('5'),
        shardIndex: 0,
        manifestId: h('4'),
        objectId: h('3'),
      },
      byteSize: 1234,
      mimeType: 'IMAGE/JPEG',
      role: 'original',
      itemId: h('2'),
    }],
    mediaType: 'image',
    owner: OWNER.toUpperCase().replace('0X', '0x'),
    version: 'bg-media-manifest-v1',
  };
  assert.equal(canonicalManifestDescriptorJson(a), canonicalManifestDescriptorJson(b));
  assert.equal(manifestDescriptorDigest(a), manifestDescriptorDigest(b));
});

test('canonical manifest verification binds root owner type item count and digest', () => {
  const d = descriptor();
  const verified = verifyDescriptorAgainstCanonicalManifest(d, canonicalFor(d), ROOT);
  assert.equal(verified.mediaRoot, ROOT);
  assert.equal(verified.canonical.mediaType, 'IMAGE');
  assert.equal(verified.descriptor.items[0].storageObject.objectId, h('3'));
});

test('resolver reads canonical registry state before accepting descriptor', async () => {
  const d = descriptor();
  const canonical = canonicalFor(d);
  const seen = [];
  const resolver = new BongGogglesMediaManifestResolver({
    readCanonicalManifest: async (mediaRoot) => { seen.push(['chain', mediaRoot]); return canonical; },
    fetchDescriptor: async ({ mediaRoot, manifestHash }) => { seen.push(['descriptor', mediaRoot, manifestHash]); return d; },
  });
  const result = await resolver.resolve(ROOT);
  assert.equal(result.descriptorHash, canonical.manifestHash);
  assert.deepEqual(seen[0], ['chain', ROOT]);
  assert.deepEqual(seen[1], ['descriptor', ROOT, canonical.manifestHash]);
});

test('tampered descriptor fails canonical digest verification', () => {
  const d = descriptor();
  const canonical = canonicalFor(d);
  const tampered = descriptor({ items: [original({ mimeType: 'image/png' })] });
  assert.throws(() => verifyDescriptorAgainstCanonicalManifest(tampered, canonical, ROOT), /digest mismatch/);
});

test('manifest rejects URLs, credentials and session material', () => {
  assert.throws(() => normalizeManifestDescriptor({ ...descriptor(), gatewayUrl: 'https://example.invalid' }), /forbidden manifest field/);
  assert.throws(() => normalizeManifestDescriptor({ ...descriptor(), items: [{ ...original(), credentialRef: 'secret' }] }), /forbidden manifest field/);
  assert.throws(() => normalizeManifestDescriptor({ ...descriptor(), sessionToken: 'secret' }), /forbidden manifest field/);
});

test('manifest rejects duplicate IDs, bad derivative links and size mismatch', () => {
  const duplicate = descriptor({ items: [original(), original()] });
  assert.throws(() => normalizeManifestDescriptor(duplicate), /duplicate media item id/);

  const derivative = descriptor({ items: [original({ derivativeOf: h('9') })] });
  assert.throws(() => normalizeManifestDescriptor(derivative), /unknown derivative source/);

  const mismatchedSize = descriptor({ items: [original({ byteSize: 999 })] });
  assert.throws(() => normalizeManifestDescriptor(mismatchedSize), /does not match storage object size/);
});

test('canonical manifest mismatch fails closed', () => {
  const d = descriptor();
  assert.throws(() => verifyDescriptorAgainstCanonicalManifest(d, canonicalFor(d, { owner: `0x${'b'.repeat(40)}` }), ROOT), /owner mismatch/);
  assert.throws(() => verifyDescriptorAgainstCanonicalManifest(d, canonicalFor(d, { itemCount: 2 }), ROOT), /item count mismatch/);
  assert.throws(() => verifyDescriptorAgainstCanonicalManifest(d, canonicalFor(d, { mediaType: 1 }), ROOT), /type mismatch/);
  assert.throws(() => verifyDescriptorAgainstCanonicalManifest(d, canonicalFor(d, { exists: false }), ROOT), /missing/);
});
