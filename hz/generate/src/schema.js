import { createHash } from "node:crypto";
import { GenerationError420 } from "./errors.js";

export const GENERATION_MODES_420 = Object.freeze(["VOCAL", "INSTRUMENTAL"]);
export const REFERENCE_AUDIO_PATHS_420 = Object.freeze(["AUTHORIZED_STORAGE_REF"]);
export const OUTPUT_KINDS_420 = Object.freeze(["MIX", "STEM", "LYRICS_TIMING", "ARTWORK"]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

export function canonicalJson420(value) {
  return JSON.stringify(canonicalize(value));
}

export function digest420(value) {
  return createHash("sha256").update(canonicalJson420(value)).digest("hex");
}

function cleanString(value, name, { required = false, max = 8_192 } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new GenerationError420("INVALID_REQUEST", `${name} is required`);
    return null;
  }
  if (typeof value !== "string") throw new GenerationError420("INVALID_REQUEST", `${name} must be a string`);
  const v = value.trim();
  if (!v && required) throw new GenerationError420("INVALID_REQUEST", `${name} is required`);
  if (v.length > max) throw new GenerationError420("INVALID_REQUEST", `${name} is too long`);
  return v || null;
}

function cleanStringArray(value, name, maxItems = 32) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new GenerationError420("INVALID_REQUEST", `${name} must be an array with at most ${maxItems} items`);
  }
  const out = value.map((item, i) => cleanString(item, `${name}[${i}]`, { required: true, max: 128 }));
  return [...new Set(out)];
}

function normalizeReferenceAudio(referenceAudio) {
  if (referenceAudio === undefined || referenceAudio === null) return null;
  if (!isPlainObject(referenceAudio)) {
    throw new GenerationError420("INVALID_REQUEST", "referenceAudio must be an object");
  }
  if (!REFERENCE_AUDIO_PATHS_420.includes(referenceAudio.path)) {
    throw new GenerationError420(
      "REFERENCE_AUDIO_NOT_AUTHORIZED",
      "reference audio must use an explicitly permitted authorization path"
    );
  }

  const storageRef = cleanString(referenceAudio.storageRef, "referenceAudio.storageRef", { required: true, max: 512 });
  const authorizationRef = cleanString(referenceAudio.authorizationRef, "referenceAudio.authorizationRef", { required: true, max: 512 });
  const sourceRecordingId = cleanString(referenceAudio.sourceRecordingId, "referenceAudio.sourceRecordingId", { max: 256 });
  const purpose = cleanString(referenceAudio.purpose, "referenceAudio.purpose", { max: 128 }) ?? "GENERATION_REFERENCE";

  return Object.freeze({
    path: referenceAudio.path,
    storageRef,
    authorizationRef,
    sourceRecordingId,
    purpose
  });
}

export function normalizeGenerationRequest420(input) {
  if (!isPlainObject(input)) throw new GenerationError420("INVALID_REQUEST", "generation request must be an object");

  const mode = input.mode ?? "VOCAL";
  if (!GENERATION_MODES_420.includes(mode)) {
    throw new GenerationError420("INVALID_REQUEST", "mode must be VOCAL or INSTRUMENTAL");
  }

  const durationSec = input.durationSec ?? 180;
  if (!Number.isInteger(durationSec) || durationSec < 15 || durationSec > 1_800) {
    throw new GenerationError420("INVALID_REQUEST", "durationSec must be an integer between 15 and 1800");
  }

  const prompt = cleanString(input.prompt, "prompt", { required: true, max: 16_384 });
  const lyrics = mode === "INSTRUMENTAL"
    ? cleanString(input.lyrics, "lyrics", { max: 32_768 })
    : cleanString(input.lyrics, "lyrics", { max: 32_768 });

  if (mode === "INSTRUMENTAL" && lyrics) {
    throw new GenerationError420("INVALID_REQUEST", "instrumental mode cannot include lyrics");
  }

  const controls = Object.freeze({
    genres: cleanStringArray(input.controls?.genres, "controls.genres"),
    styles: cleanStringArray(input.controls?.styles, "controls.styles"),
    moods: cleanStringArray(input.controls?.moods, "controls.moods"),
    instrumentation: cleanStringArray(input.controls?.instrumentation, "controls.instrumentation")
  });

  return Object.freeze({
    schemaVersion: 1,
    prompt,
    lyrics,
    controls,
    durationSec,
    mode,
    referenceAudio: normalizeReferenceAudio(input.referenceAudio)
  });
}

export function deriveClientRequestId420(request) {
  const normalized = normalizeGenerationRequest420(request);
  return `hzgen:${digest420(normalized)}`;
}

export function buildGenerationRequest420(input, { expectedClientRequestId = null } = {}) {
  const normalized = normalizeGenerationRequest420(input);
  const clientRequestId = `hzgen:${digest420(normalized)}`;
  if (expectedClientRequestId !== null && expectedClientRequestId !== clientRequestId) {
    throw new GenerationError420(
      "INVALID_CLIENT_REQUEST_ID",
      "client request id does not match canonical request payload"
    );
  }
  return Object.freeze({ ...normalized, clientRequestId });
}

export function validateCapabilityDescriptor420(descriptor) {
  if (!isPlainObject(descriptor)) {
    throw new GenerationError420("UNSUPPORTED_CAPABILITY", "provider capability descriptor is required");
  }
  const providerId = cleanString(descriptor.providerId, "providerId", { required: true, max: 256 });
  const providerRevision = cleanString(descriptor.providerRevision, "providerRevision", { required: true, max: 128 });
  const models = descriptor.models;
  if (!Array.isArray(models) || models.length === 0) {
    throw new GenerationError420("UNSUPPORTED_CAPABILITY", "provider must advertise at least one model");
  }
  const normalizedModels = models.map((model, i) => {
    if (!isPlainObject(model)) throw new GenerationError420("UNSUPPORTED_CAPABILITY", `models[${i}] invalid`);
    return Object.freeze({
      modelId: cleanString(model.modelId, `models[${i}].modelId`, { required: true, max: 256 }),
      modelVersion: cleanString(model.modelVersion, `models[${i}].modelVersion`, { required: true, max: 128 }),
      maxDurationSec: Number.isInteger(model.maxDurationSec) ? model.maxDurationSec : 0,
      modes: [...new Set(model.modes ?? [])],
      supportsLyrics: Boolean(model.supportsLyrics),
      supportsReferenceAudio: Boolean(model.supportsReferenceAudio),
      referenceAudioPaths: [...new Set(model.referenceAudioPaths ?? [])],
      outputKinds: [...new Set(model.outputKinds ?? [])]
    });
  });
  for (const model of normalizedModels) {
    if (model.maxDurationSec < 15) throw new GenerationError420("UNSUPPORTED_CAPABILITY", "model maxDurationSec invalid");
    if (model.modes.some((mode) => !GENERATION_MODES_420.includes(mode))) {
      throw new GenerationError420("UNSUPPORTED_CAPABILITY", "model mode invalid");
    }
    if (model.referenceAudioPaths.some((path) => !REFERENCE_AUDIO_PATHS_420.includes(path))) {
      throw new GenerationError420("UNSUPPORTED_CAPABILITY", "provider advertises an unapproved reference-audio path");
    }
    if (model.outputKinds.some((kind) => !OUTPUT_KINDS_420.includes(kind))) {
      throw new GenerationError420("UNSUPPORTED_CAPABILITY", "provider output kind invalid");
    }
  }

  const capacity = descriptor.capacity ?? {};
  if (!Number.isInteger(capacity.availableSlots) || capacity.availableSlots < 0) {
    throw new GenerationError420("UNSUPPORTED_CAPABILITY", "capacity.availableSlots invalid");
  }
  if (!Number.isInteger(capacity.queueDepth) || capacity.queueDepth < 0) {
    throw new GenerationError420("UNSUPPORTED_CAPABILITY", "capacity.queueDepth invalid");
  }

  return Object.freeze({
    schemaVersion: 1,
    providerId,
    providerRevision,
    models: Object.freeze(normalizedModels),
    capacity: Object.freeze({
      availableSlots: capacity.availableSlots,
      queueDepth: capacity.queueDepth,
      estimatedStartMs: Number.isInteger(capacity.estimatedStartMs) && capacity.estimatedStartMs >= 0
        ? capacity.estimatedStartMs
        : 0
    })
  });
}

export function assertProviderSupportsRequest420(descriptor, request, { modelId, modelVersion } = {}) {
  const d = validateCapabilityDescriptor420(descriptor);
  const r = buildGenerationRequest420(request, { expectedClientRequestId: request.clientRequestId ?? null });
  const model = d.models.find((m) => m.modelId === modelId && m.modelVersion === modelVersion);
  if (!model) throw new GenerationError420("UNSUPPORTED_CAPABILITY", "requested provider model/version is unavailable");
  if (!model.modes.includes(r.mode)) throw new GenerationError420("UNSUPPORTED_CAPABILITY", "requested vocal/instrumental mode unsupported");
  if (r.durationSec > model.maxDurationSec) throw new GenerationError420("UNSUPPORTED_CAPABILITY", "requested duration exceeds model limit");
  if (r.lyrics && !model.supportsLyrics) throw new GenerationError420("UNSUPPORTED_CAPABILITY", "lyrics are unsupported");
  if (r.referenceAudio) {
    if (!model.supportsReferenceAudio || !model.referenceAudioPaths.includes(r.referenceAudio.path)) {
      throw new GenerationError420("REFERENCE_AUDIO_NOT_AUTHORIZED", "provider does not support the approved reference-audio path");
    }
  }
  if (d.capacity.availableSlots === 0) throw new GenerationError420("NO_CAPACITY", "provider has no available generation capacity");
  return { descriptor: d, model, request: r };
}

function manifestString(value, name, { required = false, max = 512 } = {}) {
  try {
    return cleanString(value, name, { required, max });
  } catch (error) {
    if (error instanceof GenerationError420 && error.code === "INVALID_REQUEST") {
      throw new GenerationError420("MALFORMED_RESULT", error.message, { cause: error });
    }
    throw error;
  }
}

function validateArtifact(artifact, i) {
  if (!isPlainObject(artifact)) throw new GenerationError420("MALFORMED_RESULT", `artifacts[${i}] invalid`);
  if (!OUTPUT_KINDS_420.includes(artifact.kind)) {
    throw new GenerationError420("MALFORMED_RESULT", `artifacts[${i}].kind unsupported`);
  }
  const storageRef = manifestString(artifact.storageRef, `artifacts[${i}].storageRef`, { required: true, max: 512 });
  const integrity = manifestString(artifact.integrity, `artifacts[${i}].integrity`, { required: true, max: 256 });
  const label = manifestString(artifact.label, `artifacts[${i}].label`, { max: 128 });
  return Object.freeze({ kind: artifact.kind, storageRef, integrity, label });
}

export function validateOutputManifest420(manifest, expected = {}) {
  if (!isPlainObject(manifest)) throw new GenerationError420("MALFORMED_RESULT", "output manifest must be an object");
  const providerId = manifestString(manifest.providerId, "manifest.providerId", { required: true, max: 256 });
  const providerRevision = manifestString(manifest.providerRevision, "manifest.providerRevision", { required: true, max: 128 });
  const modelId = manifestString(manifest.modelId, "manifest.modelId", { required: true, max: 256 });
  const modelVersion = manifestString(manifest.modelVersion, "manifest.modelVersion", { required: true, max: 128 });
  const providerJobRef = manifestString(manifest.providerJobRef, "manifest.providerJobRef", { required: true, max: 256 });
  const artifacts = (manifest.artifacts ?? []).map(validateArtifact);
  if (!artifacts.some((a) => a.kind === "MIX")) {
    throw new GenerationError420("MALFORMED_RESULT", "output manifest must contain a MIX artifact");
  }
  const normalized = Object.freeze({
    schemaVersion: 1,
    providerId,
    providerRevision,
    modelId,
    modelVersion,
    providerJobRef,
    artifacts: Object.freeze(artifacts)
  });

  for (const key of ["providerId", "providerRevision", "modelId", "modelVersion", "providerJobRef"]) {
    if (expected[key] !== undefined && expected[key] !== normalized[key]) {
      throw new GenerationError420("INTEGRITY_MISMATCH", `output manifest ${key} mismatch`);
    }
  }
  return normalized;
}
