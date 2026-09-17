import { createHash } from 'node:crypto';
import { normalizeManifestDescriptor } from './manifestDescriptor.js';

const HEX32 = /^0x[0-9a-fA-F]{64}$/;
export const DERIVATIVE_ROLES = Object.freeze(['THUMBNAIL', 'POSTER', 'PREVIEW', 'TRANSCODE', 'WAVEFORM']);
const TERMINAL_SUCCESS = new Set(['RESULT_COMMITTED', 'VERIFIED', 'SETTLED']);
const TERMINAL_FAILURE = new Set(['FAILED', 'REFUNDED', 'EXPIRED', 'CANCELLED']);

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`missing ${field}`);
  return value;
}

function hex32(value, field) {
  if (typeof value !== 'string' || !HEX32.test(value)) throw new Error(`invalid ${field}`);
  return value.toLowerCase();
}

function id(value, field) {
  const normalized = String(required(value, field)).trim();
  if (!normalized) throw new Error(`missing ${field}`);
  return normalized;
}

function findItem(descriptor, itemId) {
  const normalized = normalizeManifestDescriptor(descriptor);
  const normalizedId = hex32(itemId, 'itemId');
  const item = normalized.items.find((candidate) => candidate.itemId === normalizedId);
  if (!item) throw new Error(`unknown media item ${itemId}`);
  return { descriptor: normalized, item };
}

function normalizeProfile(profile, role) {
  const p = required(profile, `profiles.${role}`);
  return Object.freeze({
    capabilityId: hex32(p.capabilityId, `profiles.${role}.capabilityId`),
    profileId: id(p.profileId, `profiles.${role}.profileId`),
    outputMimeType: id(p.outputMimeType, `profiles.${role}.outputMimeType`).toLowerCase(),
  });
}

export function normalizeDerivativeProfiles(profiles) {
  const normalized = {};
  for (const role of DERIVATIVE_ROLES) {
    if (profiles?.[role]) normalized[role] = normalizeProfile(profiles[role], role);
  }
  if (Object.keys(normalized).length === 0) throw new Error('at least one derivative profile required');
  return Object.freeze(normalized);
}

export function derivativeInputRef(descriptor, itemId) {
  const { item } = findItem(descriptor, itemId);
  const s = item.storageObject;
  const canonical = [s.objectId, s.manifestId, s.shardIndex, s.shardRoot, s.sizeBytes, s.commitmentId].join('\n');
  return `0x${createHash('sha256').update(`420/BONG_GOGGLES/MEDIA_INPUT/V1\n${canonical}`, 'utf8').digest('hex')}`;
}

export function buildDerivativeJobRequest({ descriptor, itemId, role, profiles, deadline, maxSpend = '0', slaPolicyId = null }) {
  const { item } = findItem(descriptor, itemId);
  const normalizedRole = String(required(role, 'role')).toUpperCase();
  if (!DERIVATIVE_ROLES.includes(normalizedRole)) throw new Error('unsupported derivative role');
  const catalog = normalizeDerivativeProfiles(profiles);
  const profile = catalog[normalizedRole];
  if (!profile) throw new Error(`derivative profile not configured: ${normalizedRole}`);
  const deadlineValue = Number(deadline);
  if (!Number.isSafeInteger(deadlineValue) || deadlineValue <= 0) throw new Error('invalid derivative deadline');
  return {
    capabilityId: profile.capabilityId,
    inputRef: derivativeInputRef(descriptor, item.itemId),
    request: {
      version: 'bg-media-derivative-v1',
      role: normalizedRole,
      profileId: profile.profileId,
      sourceItemId: item.itemId,
      outputMimeType: profile.outputMimeType,
    },
    deadline: deadlineValue,
    maxSpend: String(maxSpend),
    slaPolicyId: slaPolicyId === null ? null : hex32(slaPolicyId, 'slaPolicyId'),
    authoritative: false,
  };
}

function normalizeJob(job) {
  const j = required(job, 'media job');
  const status = String(required(j.status, 'media job status')).toUpperCase();
  const resultRef = j.resultRef === undefined || j.resultRef === null || j.resultRef === '' ? null : hex32(j.resultRef, 'media job resultRef');
  return {
    jobId: hex32(j.jobId, 'media job jobId'),
    capabilityId: hex32(j.capabilityId, 'media job capabilityId'),
    inputRef: hex32(j.inputRef, 'media job inputRef'),
    status,
    resultRef,
    operatorId: j.operatorId ? hex32(j.operatorId, 'media job operatorId') : null,
    slaEvidenceHash: j.slaEvidenceHash ? hex32(j.slaEvidenceHash, 'media job slaEvidenceHash') : null,
  };
}

export function buildDerivativeItem({ descriptor, sourceItemId, role, result, profiles }) {
  const { item: source } = findItem(descriptor, sourceItemId);
  const normalizedRole = String(required(role, 'role')).toUpperCase();
  const catalog = normalizeDerivativeProfiles(profiles);
  const profile = catalog[normalizedRole];
  if (!profile) throw new Error(`derivative profile not configured: ${normalizedRole}`);
  const r = required(result, 'derivative result');
  const itemId = hex32(r.itemId, 'derivative result itemId');
  const storageObject = {
    objectId: hex32(r.storageObject?.objectId, 'derivative storageObject.objectId'),
    manifestId: hex32(r.storageObject?.manifestId, 'derivative storageObject.manifestId'),
    shardIndex: Number(r.storageObject?.shardIndex),
    shardRoot: hex32(r.storageObject?.shardRoot, 'derivative storageObject.shardRoot'),
    sizeBytes: Number(r.storageObject?.sizeBytes),
    commitmentId: hex32(r.storageObject?.commitmentId, 'derivative storageObject.commitmentId'),
  };
  if (!Number.isSafeInteger(storageObject.shardIndex) || storageObject.shardIndex < 0) throw new Error('invalid derivative shard index');
  if (!Number.isSafeInteger(storageObject.sizeBytes) || storageObject.sizeBytes <= 0) throw new Error('invalid derivative size');
  const mimeType = String(required(r.mimeType, 'derivative result mimeType')).toLowerCase();
  if (mimeType !== profile.outputMimeType) throw new Error('derivative output mime type mismatch');
  return {
    itemId,
    role: normalizedRole,
    mimeType,
    byteSize: storageObject.sizeBytes,
    storageObject,
    derivativeOf: source.itemId,
    width: r.width ?? null,
    height: r.height ?? null,
    durationMs: r.durationMs ?? null,
  };
}

export class BongGogglesMediaDerivativeCoordinator {
  constructor({ profiles, createJob, readJob, resolveResult, verifyStorageRef = null }) {
    this.profiles = normalizeDerivativeProfiles(profiles);
    for (const [name, fn] of Object.entries({ createJob, readJob, resolveResult })) {
      if (typeof fn !== 'function') throw new Error(`${name} required`);
    }
    if (verifyStorageRef !== null && typeof verifyStorageRef !== 'function') throw new Error('verifyStorageRef must be a function');
    Object.assign(this, { createJob, readJob, resolveResult, verifyStorageRef });
  }

  async request({ descriptor, itemId, role, deadline, maxSpend = '0', slaPolicyId = null }) {
    const request = buildDerivativeJobRequest({ descriptor, itemId, role, profiles: this.profiles, deadline, maxSpend, slaPolicyId });
    const created = normalizeJob(await this.createJob(request));
    if (created.capabilityId !== request.capabilityId) throw new Error('media job capability mismatch');
    if (created.inputRef !== request.inputRef) throw new Error('media job input reference mismatch');
    return { request, job: created, authoritative: false };
  }

  async collect({ descriptor, sourceItemId, role, jobId }) {
    const job = normalizeJob(await this.readJob(hex32(jobId, 'jobId')));
    if (job.jobId !== hex32(jobId, 'jobId')) throw new Error('media job id mismatch');
    if (TERMINAL_FAILURE.has(job.status)) throw new Error(`media derivative job failed: ${job.status}`);
    if (!TERMINAL_SUCCESS.has(job.status) || !job.resultRef) throw new Error('media derivative job result not ready');
    const expectedInputRef = derivativeInputRef(descriptor, sourceItemId);
    if (job.inputRef !== expectedInputRef) throw new Error('media job input reference mismatch');
    const profile = this.profiles[String(role).toUpperCase()];
    if (!profile || job.capabilityId !== profile.capabilityId) throw new Error('media job capability mismatch');

    const result = await this.resolveResult({ jobId: job.jobId, resultRef: job.resultRef });
    const derivative = buildDerivativeItem({ descriptor, sourceItemId, role, result, profiles: this.profiles });
    if (this.verifyStorageRef) {
      const verified = await this.verifyStorageRef({ storageObject: derivative.storageObject, derivative, job });
      if (verified !== true) throw new Error('derivative storage reference not verified');
    }
    return {
      jobId: job.jobId,
      operatorId: job.operatorId,
      resultRef: job.resultRef,
      slaEvidenceHash: job.slaEvidenceHash,
      derivative,
      authoritative: false,
    };
  }
}
