import { createHash } from 'node:crypto';

export const MANIFEST_VERSION = 'bg-media-manifest-v1';
export const MEDIA_TYPES = Object.freeze(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']);
export const MEDIA_TYPE_BY_ORDINAL = Object.freeze(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']);
export const ITEM_ROLES = Object.freeze(['ORIGINAL', 'THUMBNAIL', 'POSTER', 'PREVIEW', 'TRANSCODE', 'CAPTION', 'WAVEFORM']);

const FORBIDDEN_KEY_PATTERN = /(url|uri|credential|secret|token|authorization|session|password|privatekey|private_key)/i;
const HEX32 = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`missing ${field}`);
  return value;
}

function positiveSafeInteger(value, field, { allowZero = false } = {}) {
  if (!Number.isSafeInteger(value) || (allowZero ? value < 0 : value <= 0)) throw new Error(`invalid ${field}`);
  return value;
}

function optionalPositiveSafeInteger(value, field) {
  if (value === undefined || value === null) return null;
  return positiveSafeInteger(value, field);
}

function hex32(value, field) {
  if (typeof value !== 'string' || !HEX32.test(value)) throw new Error(`invalid ${field}`);
  return value.toLowerCase();
}

function address(value, field) {
  if (typeof value !== 'string' || !ADDRESS.test(value) || /^0x0{40}$/i.test(value)) throw new Error(`invalid ${field}`);
  return value.toLowerCase();
}

function mediaType(value, field = 'mediaType') {
  const normalized = typeof value === 'number' ? MEDIA_TYPE_BY_ORDINAL[value] : String(value ?? '').toUpperCase();
  if (!MEDIA_TYPES.includes(normalized)) throw new Error(`invalid ${field}`);
  return normalized;
}

function role(value, field) {
  const normalized = String(required(value, field)).toUpperCase();
  if (!ITEM_ROLES.includes(normalized)) throw new Error(`invalid ${field}`);
  return normalized;
}

function mimeType(value, field) {
  const normalized = String(required(value, field)).trim().toLowerCase();
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(normalized)) throw new Error(`invalid ${field}`);
  return normalized;
}

function assertNoSecretsOrRoutes(value, path = 'descriptor') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoSecretsOrRoutes(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) throw new Error(`forbidden manifest field ${path}.${key}`);
    assertNoSecretsOrRoutes(child, `${path}.${key}`);
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function normalizeStorageObject(object, field) {
  const o = required(object, field);
  return {
    objectId: hex32(o.objectId, `${field}.objectId`),
    manifestId: hex32(o.manifestId, `${field}.manifestId`),
    shardIndex: positiveSafeInteger(o.shardIndex, `${field}.shardIndex`, { allowZero: true }),
    shardRoot: hex32(o.shardRoot, `${field}.shardRoot`),
    sizeBytes: positiveSafeInteger(o.sizeBytes, `${field}.sizeBytes`),
    commitmentId: hex32(o.commitmentId, `${field}.commitmentId`),
  };
}

function normalizeItem(item, index) {
  const field = `items[${index}]`;
  const i = required(item, field);
  const storageObject = normalizeStorageObject(i.storageObject, `${field}.storageObject`);
  const itemByteSize = positiveSafeInteger(i.byteSize ?? storageObject.sizeBytes, `${field}.byteSize`);
  if (itemByteSize !== storageObject.sizeBytes) throw new Error(`${field}.byteSize does not match storage object size`);
  return {
    itemId: hex32(i.itemId, `${field}.itemId`),
    role: role(i.role, `${field}.role`),
    mimeType: mimeType(i.mimeType, `${field}.mimeType`),
    byteSize: itemByteSize,
    storageObject,
    derivativeOf: i.derivativeOf === undefined || i.derivativeOf === null ? null : hex32(i.derivativeOf, `${field}.derivativeOf`),
    width: optionalPositiveSafeInteger(i.width, `${field}.width`),
    height: optionalPositiveSafeInteger(i.height, `${field}.height`),
    durationMs: optionalPositiveSafeInteger(i.durationMs, `${field}.durationMs`),
  };
}

export function normalizeManifestDescriptor(descriptor) {
  const d = required(descriptor, 'descriptor');
  assertNoSecretsOrRoutes(d);
  if (d.version !== MANIFEST_VERSION) throw new Error('unsupported media manifest version');
  if (!Array.isArray(d.items) || d.items.length === 0) throw new Error('media manifest items required');
  if (d.items.length > 0xffffffff) throw new Error('media manifest item count exceeds uint32');

  const items = d.items.map(normalizeItem);
  const ids = new Set();
  for (const item of items) {
    if (ids.has(item.itemId)) throw new Error(`duplicate media item id ${item.itemId}`);
    ids.add(item.itemId);
  }
  for (const item of items) {
    if (item.derivativeOf === item.itemId) throw new Error(`media item ${item.itemId} cannot derive from itself`);
    if (item.derivativeOf !== null && !ids.has(item.derivativeOf)) throw new Error(`unknown derivative source ${item.derivativeOf}`);
  }

  return {
    version: MANIFEST_VERSION,
    owner: address(d.owner, 'owner'),
    mediaType: mediaType(d.mediaType),
    items,
  };
}

export function canonicalManifestDescriptorJson(descriptor) {
  return JSON.stringify(canonicalize(normalizeManifestDescriptor(descriptor)));
}

export function manifestDescriptorDigest(descriptor) {
  return `0x${createHash('sha256').update(canonicalManifestDescriptorJson(descriptor), 'utf8').digest('hex')}`;
}

export function normalizeCanonicalMediaManifest(manifest) {
  const m = required(manifest, 'canonical media manifest');
  if (m.exists !== true) throw new Error('canonical media manifest missing');
  return {
    mediaRoot: hex32(m.mediaRoot, 'canonical.mediaRoot'),
    owner: address(m.owner, 'canonical.owner'),
    mediaType: mediaType(m.mediaType, 'canonical.mediaType'),
    manifestHash: hex32(m.manifestHash, 'canonical.manifestHash'),
    itemCount: positiveSafeInteger(Number(m.itemCount), 'canonical.itemCount'),
    createdAt: m.createdAt === undefined || m.createdAt === null ? null : positiveSafeInteger(Number(m.createdAt), 'canonical.createdAt', { allowZero: true }),
    exists: true,
  };
}

export function verifyDescriptorAgainstCanonicalManifest(descriptor, canonicalManifest, expectedMediaRoot = null) {
  const normalized = normalizeManifestDescriptor(descriptor);
  const canonical = normalizeCanonicalMediaManifest(canonicalManifest);
  if (expectedMediaRoot !== null && canonical.mediaRoot !== hex32(expectedMediaRoot, 'expectedMediaRoot')) throw new Error('canonical media root mismatch');
  if (normalized.owner !== canonical.owner) throw new Error('media manifest owner mismatch');
  if (normalized.mediaType !== canonical.mediaType) throw new Error('media manifest type mismatch');
  if (normalized.items.length !== canonical.itemCount) throw new Error('media manifest item count mismatch');
  const descriptorHash = manifestDescriptorDigest(normalized);
  if (descriptorHash !== canonical.manifestHash) throw new Error('media manifest digest mismatch');
  return { mediaRoot: canonical.mediaRoot, descriptorHash, canonical, descriptor: normalized };
}

export class BongGogglesMediaManifestResolver {
  constructor({ readCanonicalManifest, fetchDescriptor }) {
    if (typeof readCanonicalManifest !== 'function') throw new Error('readCanonicalManifest required');
    if (typeof fetchDescriptor !== 'function') throw new Error('fetchDescriptor required');
    this.readCanonicalManifest = readCanonicalManifest;
    this.fetchDescriptor = fetchDescriptor;
  }

  async resolve(mediaRoot) {
    const normalizedRoot = hex32(mediaRoot, 'mediaRoot');
    const canonical = normalizeCanonicalMediaManifest(await this.readCanonicalManifest(normalizedRoot));
    if (canonical.mediaRoot !== normalizedRoot) throw new Error('canonical media root mismatch');
    const descriptor = await this.fetchDescriptor({ mediaRoot: normalizedRoot, manifestHash: canonical.manifestHash });
    if (!descriptor) throw new Error('media manifest descriptor unavailable');
    return verifyDescriptorAgainstCanonicalManifest(descriptor, canonical, normalizedRoot);
  }
}
