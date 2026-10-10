import { digest420, validateCapabilityDescriptor420, validateOutputManifest420 } from "./schema.js";
import { GenerationError420 } from "./errors.js";

function clone(value) {
  return structuredClone(value);
}

export class GenerationProvider420 {
  async descriptor() {
    throw new Error("descriptor() not implemented");
  }
  async quote() {
    throw new Error("quote() not implemented");
  }
  async submit() {
    throw new Error("submit() not implemented");
  }
  async poll() {
    throw new Error("poll() not implemented");
  }
  async cancel() {
    throw new Error("cancel() not implemented");
  }
}

export class DeterministicMockGenerationProvider420 extends GenerationProvider420 {
  constructor({
    providerId = "mock:420hz",
    providerRevision = "rev:1",
    modelId = "mock:music",
    modelVersion = "1.0.0",
    maxDurationSec = 600,
    availableSlots = 4,
    queueDepth = 0,
    estimatedStartMs = 0,
    quoteAmount = "420000000000000000",
    quoteAsset = "$420",
    quoteTtlMs = 60_000,
    now = () => Date.now(),
    faults = {}
  } = {}) {
    super();
    this.now = now;
    this.quoteAmount = quoteAmount;
    this.quoteAsset = quoteAsset;
    this.quoteTtlMs = quoteTtlMs;
    this.faults = { ...faults };
    this.jobs = new Map();
    this.submitByKey = new Map();
    this._descriptor = validateCapabilityDescriptor420({
      providerId,
      providerRevision,
      models: [{
        modelId,
        modelVersion,
        maxDurationSec,
        modes: ["VOCAL", "INSTRUMENTAL"],
        supportsLyrics: true,
        supportsReferenceAudio: true,
        referenceAudioPaths: ["AUTHORIZED_STORAGE_REF"],
        outputKinds: ["MIX", "STEM", "LYRICS_TIMING", "ARTWORK"]
      }],
      capacity: { availableSlots, queueDepth, estimatedStartMs }
    });
  }

  async descriptor() {
    if (this.faults.descriptorUnavailable) {
      throw Object.assign(new Error("descriptor unavailable"), { transient: true, code: "E_PROVIDER_DOWN" });
    }
    return clone(this._descriptor);
  }

  async quote({ request, modelId, modelVersion }) {
    if (this.faults.quoteUnavailable) {
      throw Object.assign(new Error("quote unavailable"), { transient: true, code: "E_PROVIDER_DOWN" });
    }
    const model = this._descriptor.models.find((m) => m.modelId === modelId && m.modelVersion === modelVersion);
    if (!model) throw new GenerationError420("UNSUPPORTED_CAPABILITY", "mock model/version unavailable");

    const issuedAt = this.now();
    const quoteCore = {
      providerId: this._descriptor.providerId,
      providerRevision: this._descriptor.providerRevision,
      modelId,
      modelVersion,
      clientRequestId: request.clientRequestId,
      requestDigest: digest420(request),
      amount: this.quoteAmount,
      asset: this.quoteAsset,
      capacity: {
        availableSlots: this._descriptor.capacity.availableSlots,
        queueDepth: this._descriptor.capacity.queueDepth,
        estimatedStartMs: this._descriptor.capacity.estimatedStartMs
      },
      issuedAt,
      expiresAt: issuedAt + this.quoteTtlMs
    };
    return Object.freeze({
      schemaVersion: 1,
      quoteId: `q:${digest420(quoteCore)}`,
      ...quoteCore
    });
  }

  async submit({ request, quote, idempotencyKey }) {
    if (this.faults.submitUnavailable) {
      throw Object.assign(new Error("submit unavailable"), { transient: true, code: "E_PROVIDER_DOWN" });
    }
    if (this.faults.submitRejected) {
      throw Object.assign(new Error("submit rejected"), { code: "E_PROVIDER_REJECT" });
    }
    if (this.submitByKey.has(idempotencyKey)) return clone(this.submitByKey.get(idempotencyKey));

    if (quote.providerId !== this._descriptor.providerId || quote.providerRevision !== this._descriptor.providerRevision) {
      throw new GenerationError420("QUOTE_MISMATCH", "quote provider identity mismatch");
    }
    if (quote.clientRequestId !== request.clientRequestId || quote.requestDigest !== digest420(request)) {
      throw new GenerationError420("QUOTE_MISMATCH", "quote request mismatch");
    }
    if (quote.expiresAt <= this.now()) throw new GenerationError420("QUOTE_EXPIRED", "quote expired");

    const providerJobRef = `mockjob:${digest420({
      providerId: this._descriptor.providerId,
      providerRevision: this._descriptor.providerRevision,
      idempotencyKey,
      clientRequestId: request.clientRequestId
    })}`;

    const state = {
      providerJobRef,
      providerId: this._descriptor.providerId,
      providerRevision: this._descriptor.providerRevision,
      modelId: quote.modelId,
      modelVersion: quote.modelVersion,
      status: "RUNNING",
      polls: 0,
      cancelled: false,
      request: clone(request)
    };
    this.jobs.set(providerJobRef, state);

    const response = Object.freeze({
      providerJobRef,
      providerId: state.providerId,
      providerRevision: state.providerRevision,
      modelId: state.modelId,
      modelVersion: state.modelVersion,
      acceptedAt: this.now()
    });
    this.submitByKey.set(idempotencyKey, response);
    return clone(response);
  }

  async poll({ providerJobRef }) {
    if (this.faults.pollUnavailable) {
      throw Object.assign(new Error("poll unavailable"), { transient: true, code: "E_PROVIDER_DOWN" });
    }
    const state = this.jobs.get(providerJobRef);
    if (!state) throw new GenerationError420("PROVIDER_REJECTED", "unknown provider job");
    if (state.cancelled) return { status: "CANCELLED" };
    if (this.faults.providerFailed) {
      return { status: "FAILED", providerCode: "MOCK_EXECUTION_FAILED", retryable: false };
    }

    state.polls += 1;
    if (state.polls <= (this.faults.runningPolls ?? 0)) return { status: "RUNNING" };

    if (this.faults.malformedResult) return { status: "SUCCEEDED", outputManifest: { broken: true } };

    const outputManifest = {
      schemaVersion: 1,
      providerId: state.providerId,
      providerRevision: state.providerRevision,
      modelId: state.modelId,
      modelVersion: state.modelVersion,
      providerJobRef: state.providerJobRef,
      artifacts: [
        {
          kind: "MIX",
          storageRef: `mock://mix/${providerJobRef}`,
          integrity: `sha256:${digest420({ providerJobRef, kind: "MIX" })}`,
          label: "master mix"
        },
        {
          kind: "STEM",
          storageRef: `mock://stem/${providerJobRef}/vocals`,
          integrity: `sha256:${digest420({ providerJobRef, kind: "STEM", label: "vocals" })}`,
          label: "vocals"
        },
        {
          kind: "LYRICS_TIMING",
          storageRef: `mock://lyrics/${providerJobRef}`,
          integrity: `sha256:${digest420({ providerJobRef, kind: "LYRICS_TIMING" })}`,
          label: "lyrics timing"
        },
        {
          kind: "ARTWORK",
          storageRef: `mock://artwork/${providerJobRef}`,
          integrity: `sha256:${digest420({ providerJobRef, kind: "ARTWORK" })}`,
          label: "artwork"
        }
      ]
    };
    validateOutputManifest420(outputManifest, {
      providerId: state.providerId,
      providerRevision: state.providerRevision,
      modelId: state.modelId,
      modelVersion: state.modelVersion,
      providerJobRef
    });
    return { status: "SUCCEEDED", outputManifest, resultCommitment: `mockresult:${digest420(outputManifest)}`, verificationRef: `mockverify:${digest420({ providerJobRef, resultManifestHash: digest420(outputManifest) })}` };
  }

  async cancel({ providerJobRef }) {
    if (this.faults.cancelUnavailable) {
      throw Object.assign(new Error("cancel unavailable"), { transient: true, code: "E_PROVIDER_DOWN" });
    }
    const state = this.jobs.get(providerJobRef);
    if (!state) throw new GenerationError420("PROVIDER_REJECTED", "unknown provider job");
    state.cancelled = true;
    return { status: "CANCELLED", providerJobRef };
  }
}
