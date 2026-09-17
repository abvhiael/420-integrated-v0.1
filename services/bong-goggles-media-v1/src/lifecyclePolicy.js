import { normalizeManifestDescriptor } from './manifestDescriptor.js';

const HEX32 = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
export const SOCIAL_STATUSES = Object.freeze(['ACTIVE', 'HIDDEN', 'DELETED', 'REMOVED']);
export const AUDIENCE_TYPES = Object.freeze(['PUBLIC', 'FOLLOWERS', 'FRIENDS', 'GROUP', 'PRIVATE']);

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`missing ${field}`);
  return value;
}
function hex32(value, field) {
  if (typeof value !== 'string' || !HEX32.test(value)) throw new Error(`invalid ${field}`);
  return value.toLowerCase();
}
function address(value, field) {
  const v = String(required(value, field)).toLowerCase();
  if (!ADDRESS.test(v)) throw new Error(`invalid ${field}`);
  return v;
}
function positiveInt(value, field) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`invalid ${field}`);
  return n;
}
function status(value) {
  const normalized = typeof value === 'number' ? SOCIAL_STATUSES[value] : String(value ?? '').toUpperCase();
  if (!SOCIAL_STATUSES.includes(normalized)) throw new Error('invalid social object status');
  return normalized;
}
function audienceType(value) {
  const normalized = typeof value === 'number' ? AUDIENCE_TYPES[value] : String(value ?? '').toUpperCase();
  if (!AUDIENCE_TYPES.includes(normalized)) throw new Error('invalid social audience type');
  return normalized;
}
function normalizeSocialObject(object) {
  const o = required(object, 'social object');
  if (o.exists !== true) throw new Error('social object missing');
  return {
    objectId: hex32(o.objectId, 'social.objectId'),
    author: address(o.author, 'social.author'),
    mediaRoot: hex32(o.mediaRoot, 'social.mediaRoot'),
    audienceType: audienceType(o.audienceType),
    audienceRef: o.audienceRef ? hex32(o.audienceRef, 'social.audienceRef') : `0x${'0'.repeat(64)}`,
    version: positiveInt(o.version, 'social.version'),
    status: status(o.status),
    exists: true,
  };
}
function findItem(descriptor, itemId) {
  const d = normalizeManifestDescriptor(descriptor);
  const id = hex32(itemId, 'itemId');
  const item = d.items.find((candidate) => candidate.itemId === id);
  if (!item) throw new Error(`unknown media item ${itemId}`);
  return { descriptor: d, item };
}

export class BongGogglesMediaLifecyclePolicy {
  constructor({ readSocialObject, readMediaRootAtVersion, canView, isDerivativeRetired = null }) {
    for (const [name, fn] of Object.entries({ readSocialObject, readMediaRootAtVersion, canView })) {
      if (typeof fn !== 'function') throw new Error(`${name} required`);
    }
    if (isDerivativeRetired !== null && typeof isDerivativeRetired !== 'function') throw new Error('isDerivativeRetired must be a function');
    Object.assign(this, { readSocialObject, readMediaRootAtVersion, canView, isDerivativeRetired });
  }

  async inspect({ objectId, descriptor, mediaRoot, itemId, viewer = null, version = null }) {
    const object = normalizeSocialObject(await this.readSocialObject(hex32(objectId, 'objectId')));
    const requestedRoot = hex32(mediaRoot, 'mediaRoot');
    const { descriptor: normalizedDescriptor, item } = findItem(descriptor, itemId);
    if (normalizedDescriptor.owner !== object.author) throw new Error('media descriptor owner does not match social object author');

    const requestedVersion = version === null ? object.version : positiveInt(version, 'version');
    if (requestedVersion > object.version) throw new Error('social object version is in the future');
    const versionRoot = hex32(await this.readMediaRootAtVersion(object.objectId, requestedVersion), 'mediaRootAtVersion');
    if (versionRoot !== requestedRoot) throw new Error('media root does not match requested social object version');

    const currentBinding = requestedVersion === object.version && requestedRoot === object.mediaRoot;
    const active = object.status === 'ACTIVE';
    const historical = requestedVersion < object.version;
    const retired = this.isDerivativeRetired ? await this.isDerivativeRetired({ objectId: object.objectId, version: requestedVersion, mediaRoot: requestedRoot, itemId: item.itemId }) === true : false;

    let audienceAllowed = false;
    if (active && currentBinding) {
      audienceAllowed = await this.canView({
        viewer,
        author: object.author,
        audienceType: object.audienceType,
        audienceRef: object.audienceRef,
      }) === true;
    }

    return {
      object,
      requestedVersion,
      requestedRoot,
      itemId: item.itemId,
      currentBinding,
      historical,
      derivativeRetired: retired,
      presentationEligible: active && currentBinding && audienceAllowed && !retired,
      audienceAllowed,
      storageHistoryImmutable: true,
      authoritative: false,
    };
  }

  async assertDeliverable(args) {
    const state = await this.inspect(args);
    if (!state.presentationEligible) {
      if (state.object.status !== 'ACTIVE') throw new Error(`social object presentation unavailable: ${state.object.status}`);
      if (!state.currentBinding) throw new Error('historical or superseded media is not presentation-eligible');
      if (state.derivativeRetired) throw new Error('media derivative retired from active presentation');
      throw new Error('media audience authorization denied');
    }
    return state;
  }
}

export function retentionDisposition({ socialStatus, requestedVersion, currentVersion }) {
  const normalizedStatus = status(socialStatus);
  const requested = positiveInt(requestedVersion, 'requestedVersion');
  const current = positiveInt(currentVersion, 'currentVersion');
  if (requested > current) throw new Error('requestedVersion exceeds currentVersion');
  return {
    preserveCanonicalStorageHistory: true,
    normalPresentationAllowed: normalizedStatus === 'ACTIVE' && requested === current,
    tombstonePresentation: normalizedStatus === 'DELETED' || normalizedStatus === 'REMOVED',
    hiddenPresentation: normalizedStatus === 'HIDDEN',
    historicalVersion: requested < current,
    authoritative: false,
  };
}
