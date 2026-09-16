import { createHash } from 'node:crypto';
import { normalizeManifestDescriptor } from './manifestDescriptor.js';
import { toStorageObjectRef } from './uploadBridge.js';

export const DELIVERY_METHODS = Object.freeze(['GET', 'HEAD']);

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`missing ${field}`);
  return value;
}

function findItem(descriptor, itemId) {
  const normalized = normalizeManifestDescriptor(descriptor);
  const id = String(required(itemId, 'itemId')).toLowerCase();
  const item = normalized.items.find((candidate) => candidate.itemId === id);
  if (!item) throw new Error(`unknown media item ${itemId}`);
  return { descriptor: normalized, item };
}

function normalizeMethod(method) {
  const normalized = String(method ?? 'GET').toUpperCase();
  if (!DELIVERY_METHODS.includes(normalized)) throw new Error('unsupported delivery method');
  return normalized;
}

function normalizeAccess(access = { mode: 'public' }) {
  const mode = String(access?.mode ?? 'public').toLowerCase();
  if (mode === 'public') return { mode: 'public' };
  if (mode !== 'private') throw new Error('invalid media access mode');
  const subject = String(required(access.subject, 'access.subject')).trim();
  const sessionId = String(required(access.sessionId, 'access.sessionId')).trim();
  if (!subject || !sessionId) throw new Error('private media access context required');
  return { mode: 'private', subject, sessionId, capability: 'read' };
}

export function buildStorageRetrieveRequest({ descriptor, itemId, access = { mode: 'public' } }) {
  const { item } = findItem(descriptor, itemId);
  const normalizedAccess = normalizeAccess(access);
  const requestAccess = normalizedAccess.mode === 'public'
    ? { mode: 'public' }
    : { mode: 'private', subject: normalizedAccess.subject, session_id: normalizedAccess.sessionId, capability: 'read' };
  return {
    version: 'v1',
    object: toStorageObjectRef(item.storageObject),
    access: requestAccess,
  };
}

function normalizeReturnedObject(object) {
  const o = required(object, 'result.object');
  return {
    object_id: String(required(o.object_id, 'result.object.object_id')).toLowerCase(),
    manifest_id: String(required(o.manifest_id, 'result.object.manifest_id')).toLowerCase(),
    shard_index: Number(o.shard_index),
    shard_root: String(required(o.shard_root, 'result.object.shard_root')).replace(/^0x/, '').toLowerCase(),
    size_bytes: Number(o.size_bytes),
    commitment_id: String(required(o.commitment_id, 'result.object.commitment_id')).toLowerCase(),
  };
}

export function verifyRetrievedObject({ descriptor, itemId, result }) {
  const { item } = findItem(descriptor, itemId);
  const r = required(result, 'result');
  if (r.version !== 'v1') throw new Error('unexpected storage retrieval version');
  const expected = toStorageObjectRef(item.storageObject);
  const actual = normalizeReturnedObject(r.object);
  for (const key of Object.keys(expected)) {
    const expectedValue = key === 'shard_root'
      ? String(expected[key]).replace(/^0x/, '').toLowerCase()
      : String(expected[key]).toLowerCase();
    if (String(actual[key]).toLowerCase() !== expectedValue) throw new Error(`storage retrieval object mismatch: ${key}`);
  }

  const payload = Buffer.isBuffer(r.payload) ? Buffer.from(r.payload) : Buffer.from(required(r.payload, 'result.payload'));
  if (payload.length !== item.storageObject.sizeBytes) throw new Error('storage retrieval size mismatch');
  const digest = createHash('sha256').update(payload).digest('hex');
  const expectedRoot = item.storageObject.shardRoot.replace(/^0x/, '').toLowerCase();
  if (digest !== expectedRoot) throw new Error('storage retrieval shard root mismatch');

  return {
    item,
    payload,
    route: {
      tier: r.route?.tier ?? null,
      providerId: r.route?.provider_id ?? null,
      nodeId: r.route?.node_id ?? null,
      authoritative: false,
    },
  };
}

export function parseByteRange(rangeHeader, size) {
  if (rangeHeader === undefined || rangeHeader === null || String(rangeHeader).trim() === '') return null;
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error('invalid media size');
  const header = String(rangeHeader).trim();
  if (!header.startsWith('bytes=')) throw new Error('invalid byte range');
  const spec = header.slice(6).trim();
  if (!spec || spec.includes(',')) throw new Error('invalid byte range');
  const parts = spec.split('-');
  if (parts.length !== 2) throw new Error('invalid byte range');
  const [left, right] = parts.map((value) => value.trim());
  let start;
  let end;
  if (!left) {
    const suffix = Number(right);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) throw new Error('invalid byte range');
    const bounded = Math.min(suffix, size);
    start = size - bounded;
    end = size - 1;
  } else {
    start = Number(left);
    if (!Number.isSafeInteger(start) || start < 0 || start >= size) throw new Error('byte range unsatisfiable');
    if (!right) end = size - 1;
    else {
      end = Number(right);
      if (!Number.isSafeInteger(end) || end < start) throw new Error('invalid byte range');
      end = Math.min(end, size - 1);
    }
  }
  return { start, end, length: end - start + 1 };
}

export class BongGogglesMediaDeliveryService {
  constructor({ retrieveObject, authorizePrivate = null, isDeliveryReady = null }) {
    if (typeof retrieveObject !== 'function') throw new Error('retrieveObject required');
    if (authorizePrivate !== null && typeof authorizePrivate !== 'function') throw new Error('authorizePrivate must be a function');
    if (isDeliveryReady !== null && typeof isDeliveryReady !== 'function') throw new Error('isDeliveryReady must be a function');
    this.retrieveObject = retrieveObject;
    this.authorizePrivate = authorizePrivate;
    this.isDeliveryReady = isDeliveryReady;
  }

  async deliver({ descriptor, itemId, method = 'GET', range = null, access = { mode: 'public' } }) {
    const normalizedMethod = normalizeMethod(method);
    const { descriptor: normalizedDescriptor, item } = findItem(descriptor, itemId);
    const normalizedAccess = normalizeAccess(access);

    if (this.isDeliveryReady) {
      const ready = await this.isDeliveryReady({ descriptor: normalizedDescriptor, itemId: item.itemId });
      if (ready !== true) throw new Error('media item is not canonically retrievable');
    }

    if (normalizedAccess.mode === 'private') {
      if (!this.authorizePrivate) throw new Error('private media access denied');
      const authorized = await this.authorizePrivate({
        owner: normalizedDescriptor.owner,
        itemId: item.itemId,
        subject: normalizedAccess.subject,
        sessionId: normalizedAccess.sessionId,
        capability: 'read',
      });
      if (authorized !== true) throw new Error('private media access denied');
    }

    const request = buildStorageRetrieveRequest({ descriptor: normalizedDescriptor, itemId: item.itemId, access: normalizedAccess });
    const result = await this.retrieveObject(request);
    const verified = verifyRetrievedObject({ descriptor: normalizedDescriptor, itemId: item.itemId, result });
    const byteRange = parseByteRange(range, verified.payload.length);
    const body = byteRange ? verified.payload.subarray(byteRange.start, byteRange.end + 1) : verified.payload;
    const status = byteRange ? 206 : 200;

    return {
      status,
      method: normalizedMethod,
      itemId: item.itemId,
      mimeType: item.mimeType,
      byteLength: body.length,
      fullByteLength: verified.payload.length,
      range: byteRange,
      body: normalizedMethod === 'HEAD' ? Buffer.alloc(0) : Buffer.from(body),
      headers: {
        'content-type': item.mimeType,
        'accept-ranges': 'bytes',
        'content-length': String(body.length),
        ...(byteRange ? { 'content-range': `bytes ${byteRange.start}-${byteRange.end}/${verified.payload.length}` } : {}),
      },
      route: verified.route,
      verified: true,
      authoritative: false,
    };
  }
}
