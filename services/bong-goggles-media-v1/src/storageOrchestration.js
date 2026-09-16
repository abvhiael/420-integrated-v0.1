import { normalizeManifestDescriptor } from './manifestDescriptor.js';

const HEX32 = /^0x[0-9a-fA-F]{64}$/;

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`missing ${field}`);
  return value;
}

function hex32(value, field) {
  if (typeof value !== 'string' || !HEX32.test(value)) throw new Error(`invalid ${field}`);
  return value.toLowerCase();
}

function address(value, field) {
  const normalized = String(required(value, field)).toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(normalized)) throw new Error(`invalid ${field}`);
  return normalized;
}

function findItem(descriptor, itemId) {
  const normalized = normalizeManifestDescriptor(descriptor);
  const id = hex32(itemId, 'itemId');
  const item = normalized.items.find((candidate) => candidate.itemId === id);
  if (!item) throw new Error(`unknown media item ${itemId}`);
  return { descriptor: normalized, item };
}

function normalizeManifest(manifest) {
  const m = required(manifest, 'storage manifest');
  if (m.exists !== true) throw new Error('canonical storage manifest missing');
  return {
    controller: address(m.controller, 'manifest.controller'),
    objectId: hex32(m.objectId, 'manifest.objectId'),
    manifestHash: hex32(m.manifestHash, 'manifest.manifestHash'),
    dataShards: Number(m.dataShards),
    totalShards: Number(m.totalShards),
    placedShards: Number(m.placedShards),
    isSealed: m.isSealed === true,
    exists: true,
  };
}

function normalizeAgreement(agreement) {
  const a = required(agreement, 'agreement');
  if (a.exists !== true) throw new Error('canonical storage agreement missing');
  return {
    consumer: address(a.consumer, 'agreement.consumer'),
    objectId: hex32(a.objectId, 'agreement.objectId'),
    manifestHash: hex32(a.manifestHash, 'agreement.manifestHash'),
    commitmentId: hex32(a.commitmentId, 'agreement.commitmentId'),
    capacityReservationId: hex32(a.capacityReservationId, 'agreement.capacityReservationId'),
    sizeBytes: Number(a.sizeBytes),
    dataShards: Number(a.dataShards),
    totalShards: Number(a.totalShards),
    state: typeof a.state === 'string' ? a.state.toUpperCase() : Number(a.state),
    exists: true,
  };
}

function normalizeCommitment(commitment) {
  const c = required(commitment, 'commitment');
  if (c.exists !== true) throw new Error('canonical storage commitment missing');
  return {
    providerId: hex32(c.providerId, 'commitment.providerId'),
    nodeId: hex32(c.nodeId, 'commitment.nodeId'),
    contentRoot: hex32(c.contentRoot, 'commitment.contentRoot'),
    sizeBytes: Number(c.sizeBytes),
    exists: true,
  };
}

function activeAgreement(state) {
  return state === 'ACTIVE' || state === 2;
}

export function placementIntent({ descriptor, itemId, agreementId }) {
  const { item } = findItem(descriptor, itemId);
  return {
    contract: 'StorageObjectManifestRegistry420',
    method: 'registerPlacement',
    args: [item.storageObject.manifestId, item.storageObject.shardIndex, hex32(agreementId, 'agreementId'), item.storageObject.shardRoot, item.storageObject.sizeBytes],
    value: '0',
    requiresUserAuthorization: true,
    authoritative: false,
  };
}

export function sealIntent({ manifestId }) {
  return {
    contract: 'StorageObjectManifestRegistry420',
    method: 'sealManifest',
    args: [hex32(manifestId, 'manifestId')],
    value: '0',
    requiresUserAuthorization: true,
    authoritative: false,
  };
}

export class BongGogglesStorageOrchestrator {
  constructor({ readManifest, readPlacement, readAgreement, readCommitment, isAgreementEffective, isCommitmentLive, isRetrievable }) {
    for (const [name, fn] of Object.entries({ readManifest, readPlacement, readAgreement, readCommitment, isAgreementEffective, isCommitmentLive, isRetrievable })) {
      if (typeof fn !== 'function') throw new Error(`${name} required`);
    }
    Object.assign(this, { readManifest, readPlacement, readAgreement, readCommitment, isAgreementEffective, isCommitmentLive, isRetrievable });
  }

  async inspectItem({ descriptor, itemId, agreementId }) {
    const { descriptor: normalized, item } = findItem(descriptor, itemId);
    const storage = item.storageObject;
    const manifest = normalizeManifest(await this.readManifest(storage.manifestId));
    if (manifest.controller !== normalized.owner) throw new Error('storage manifest controller mismatch');
    if (manifest.objectId !== storage.objectId) throw new Error('storage manifest object mismatch');
    if (storage.shardIndex >= manifest.totalShards) throw new Error('storage shard index outside manifest');

    const agreement = normalizeAgreement(await this.readAgreement(hex32(agreementId, 'agreementId')));
    if (!activeAgreement(agreement.state)) throw new Error('storage agreement not active');
    if (agreement.consumer !== normalized.owner) throw new Error('storage agreement consumer mismatch');
    if (agreement.objectId !== storage.objectId) throw new Error('storage agreement object mismatch');
    if (agreement.commitmentId !== storage.commitmentId) throw new Error('storage agreement commitment mismatch');
    if (agreement.dataShards !== manifest.dataShards || agreement.totalShards !== manifest.totalShards) throw new Error('storage erasure policy mismatch');
    if (storage.sizeBytes > agreement.sizeBytes) throw new Error('storage shard exceeds agreement size');

    const commitment = normalizeCommitment(await this.readCommitment(storage.commitmentId));
    const agreementEffective = await this.isAgreementEffective(hex32(agreementId, 'agreementId'));
    const commitmentLive = await this.isCommitmentLive(storage.commitmentId);

    let placement = null;
    try { placement = await this.readPlacement(storage.manifestId, storage.shardIndex); } catch { placement = null; }
    if (placement) {
      if (hex32(placement.manifestId, 'placement.manifestId') !== storage.manifestId) throw new Error('storage placement manifest mismatch');
      if (Number(placement.shardIndex) !== storage.shardIndex) throw new Error('storage placement index mismatch');
      if (hex32(placement.shardRoot, 'placement.shardRoot') !== storage.shardRoot) throw new Error('storage placement root mismatch');
      if (Number(placement.shardSizeBytes) !== storage.sizeBytes) throw new Error('storage placement size mismatch');
      if (hex32(placement.commitmentId, 'placement.commitmentId') !== storage.commitmentId) throw new Error('storage placement commitment mismatch');
      if (hex32(placement.nodeId, 'placement.nodeId') !== commitment.nodeId) throw new Error('storage placement node mismatch');
    }

    const retrievable = manifest.isSealed ? await this.isRetrievable(storage.manifestId) : false;
    return {
      itemId: item.itemId,
      storageObject: storage,
      manifest,
      agreement,
      commitment,
      agreementEffective: agreementEffective === true,
      commitmentLive: commitmentLive === true,
      placement,
      placementRequired: placement === null,
      sealRequired: !manifest.isSealed && manifest.placedShards === manifest.totalShards,
      deliveryReady: manifest.isSealed && retrievable === true,
      authoritative: false,
    };
  }

  async plan({ descriptor, itemId, agreementId }) {
    const state = await this.inspectItem({ descriptor, itemId, agreementId });
    const intents = [];
    if (state.placementRequired) intents.push(placementIntent({ descriptor, itemId, agreementId }));
    if (state.sealRequired) intents.push(sealIntent({ manifestId: state.storageObject.manifestId }));
    return { state, intents, authoritative: false };
  }
}
