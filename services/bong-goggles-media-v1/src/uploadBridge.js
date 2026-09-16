import { createHash } from 'node:crypto';
import { manifestDescriptorDigest, normalizeManifestDescriptor } from './manifestDescriptor.js';

export const STORAGE_API_VERSION = 'v1';

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`missing ${field}`);
  return value;
}

function normalizeId(value, field) {
  const normalized = String(required(value, field)).trim();
  if (!normalized) throw new Error(`missing ${field}`);
  return normalized;
}

function normalizePreconditions(value, field) {
  const p = required(value, field);
  return {
    agreementId: normalizeId(p.agreementId, `${field}.agreementId`),
    capacityReservationId: normalizeId(p.capacityReservationId, `${field}.capacityReservationId`),
    commitmentId: normalizeId(p.commitmentId, `${field}.commitmentId`).toLowerCase(),
  };
}

function findItem(descriptor, itemId) {
  const normalized = normalizeManifestDescriptor(descriptor);
  const id = String(required(itemId, 'itemId')).toLowerCase();
  const item = normalized.items.find((candidate) => candidate.itemId === id);
  if (!item) throw new Error(`unknown media item ${itemId}`);
  return { descriptor: normalized, item };
}

export function toStorageObjectRef(storageObject) {
  return {
    object_id: storageObject.objectId,
    manifest_id: storageObject.manifestId,
    shard_index: storageObject.shardIndex,
    shard_root: storageObject.shardRoot.replace(/^0x/, ''),
    size_bytes: storageObject.sizeBytes,
    commitment_id: storageObject.commitmentId,
  };
}

export function mediaUploadIdempotencyKey(descriptor, itemId, namespace = 'bong-goggles') {
  const { item } = findItem(descriptor, itemId);
  const digest = manifestDescriptorDigest(descriptor);
  const ns = normalizeId(namespace, 'namespace');
  return createHash('sha256').update(`${ns}\n${digest}\n${item.itemId}`, 'utf8').digest('hex');
}

export function buildStoragePrepareRequest({ descriptor, itemId, preconditions, idempotencyKey = null, namespace = 'bong-goggles' }) {
  const { item } = findItem(descriptor, itemId);
  const pre = normalizePreconditions(preconditions, 'preconditions');
  if (pre.commitmentId !== item.storageObject.commitmentId) throw new Error('upload commitment does not match descriptor storage object');
  return {
    version: STORAGE_API_VERSION,
    object: toStorageObjectRef(item.storageObject),
    idempotency_key: idempotencyKey ? normalizeId(idempotencyKey, 'idempotencyKey') : mediaUploadIdempotencyKey(descriptor, item.itemId, namespace),
    preconditions: {
      agreement_id: pre.agreementId,
      capacity_reservation_id: pre.capacityReservationId,
      commitment_id: pre.commitmentId,
    },
  };
}

export function verifyStorageReceipt({ descriptor, itemId, plan, receipt }) {
  const { item } = findItem(descriptor, itemId);
  const r = required(receipt, 'receipt');
  const p = required(plan, 'plan');
  if (r.version !== STORAGE_API_VERSION) throw new Error('unexpected storage receipt version');
  if (!r.upload_id || r.upload_id !== p.upload_id) throw new Error('storage receipt upload id mismatch');
  if (Number(r.size_bytes) !== item.storageObject.sizeBytes) throw new Error('storage receipt size mismatch');
  const receiptRoot = String(required(r.shard_root, 'receipt.shard_root')).replace(/^0x/, '').toLowerCase();
  const expectedRoot = item.storageObject.shardRoot.replace(/^0x/, '').toLowerCase();
  if (receiptRoot !== expectedRoot) throw new Error('storage receipt shard root mismatch');
  const object = required(r.object, 'receipt.object');
  const expected = toStorageObjectRef(item.storageObject);
  for (const key of Object.keys(expected)) {
    if (String(object[key]) !== String(expected[key])) throw new Error(`storage receipt object mismatch: ${key}`);
  }
  return {
    itemId: item.itemId,
    uploadId: r.upload_id,
    providerId: r.provider_id ?? null,
    nodeId: r.node_id ?? null,
    serviceId: r.service_id ?? null,
    sizeBytes: item.storageObject.sizeBytes,
    shardRoot: item.storageObject.shardRoot,
    authoritative: false,
  };
}

export class BongGogglesMediaUploadBridge {
  constructor({ prepareUpload, ingestUpload }) {
    if (typeof prepareUpload !== 'function') throw new Error('prepareUpload required');
    if (typeof ingestUpload !== 'function') throw new Error('ingestUpload required');
    this.prepareUpload = prepareUpload;
    this.ingestUpload = ingestUpload;
  }

  async prepare({ descriptor, itemId, preconditions, idempotencyKey = null, namespace = 'bong-goggles' }) {
    const request = buildStoragePrepareRequest({ descriptor, itemId, preconditions, idempotencyKey, namespace });
    const plan = await this.prepareUpload(request);
    if (!plan || plan.version !== STORAGE_API_VERSION || !plan.upload_id) throw new Error('invalid storage upload plan');
    if (plan.idempotency_key !== request.idempotency_key) throw new Error('storage plan idempotency mismatch');
    if (plan.preconditions?.commitment_id !== request.preconditions.commitment_id) throw new Error('storage plan commitment mismatch');
    return { request, plan, authoritative: false };
  }

  async ingest({ descriptor, itemId, plan, body }) {
    if (body === undefined || body === null) throw new Error('upload body required');
    const receipt = await this.ingestUpload(plan, body);
    return verifyStorageReceipt({ descriptor, itemId, plan, receipt });
  }
}
