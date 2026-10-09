import {
  assertProviderSupportsRequest420,
  buildGenerationRequest420,
  digest420,
  validateOutputManifest420
} from "./schema.js";
import { GenerationError420, normalizeProviderError420 } from "./errors.js";

export const GENERATION_JOB_STATES_420 = Object.freeze([
  "DRAFT",
  "QUOTED",
  "SUBMITTED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED"
]);

const TERMINAL = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);

function clone(value) {
  return structuredClone(value);
}

function providerMethods(provider) {
  for (const method of ["descriptor", "quote", "submit", "poll", "cancel"]) {
    if (typeof provider?.[method] !== "function") {
      throw new GenerationError420("INVALID_REQUEST", `provider.${method} is required`);
    }
  }
}

function assertState(job, allowed, operation) {
  if (!allowed.includes(job.state)) {
    throw new GenerationError420(
      "INVALID_REQUEST",
      `${operation} not allowed from ${job.state}`,
      { details: { state: job.state, allowed } }
    );
  }
}

export class GenerationJobStore420 {
  constructor(seed = []) {
    this.byJobId = new Map();
    this.byClientRequestId = new Map();
    for (const item of seed) this.put(item);
  }

  get(jobId) {
    return this.byJobId.has(jobId) ? clone(this.byJobId.get(jobId)) : null;
  }

  getByClientRequestId(clientRequestId) {
    const jobId = this.byClientRequestId.get(clientRequestId);
    return jobId ? this.get(jobId) : null;
  }

  put(job) {
    const copy = clone(job);
    this.byJobId.set(copy.jobId, copy);
    this.byClientRequestId.set(copy.clientRequestId, copy.jobId);
    return clone(copy);
  }

  list() {
    return [...this.byJobId.values()].map(clone);
  }
}

export class GenerationJobManager420 {
  constructor({ store = new GenerationJobStore420(), now = () => Date.now(), verifyProviderResult = null, requireCanonicalResult = false } = {}) {
    this.store = store;
    this.now = now;
    if (requireCanonicalResult && typeof verifyProviderResult !== "function") throw new GenerationError420("INVALID_REQUEST", "canonical provider verifier required");
    this.verifyProviderResult = verifyProviderResult;
    this.requireCanonicalResult = requireCanonicalResult;
  }

  create(input, { clientRequestId = null, timeoutMs = 10 * 60_000 } = {}) {
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60 * 60_000) {
      throw new GenerationError420("INVALID_REQUEST", "timeoutMs must be a positive integer no greater than one hour");
    }

    const request = buildGenerationRequest420(input, { expectedClientRequestId: clientRequestId });
    const requestDigest = digest420(request);
    const existing = this.store.getByClientRequestId(request.clientRequestId);
    if (existing) {
      if (existing.requestDigest !== requestDigest) {
        throw new GenerationError420("REPLAY_CONFLICT", "client request id is already bound to different material");
      }
      return existing;
    }

    const createdAt = this.now();
    const job = {
      schemaVersion: 1,
      jobId: `hzjob:${digest420({ clientRequestId: request.clientRequestId, requestDigest })}`,
      clientRequestId: request.clientRequestId,
      requestDigest,
      request,
      state: "DRAFT",
      quote: null,
      provider: null,
      providerJobRef: null,
      outputManifest: null,
      executionEvidence: null,
      lastError: null,
      submitAttempts: 0,
      createdAt,
      updatedAt: createdAt,
      deadlineAt: createdAt + timeoutMs
    };
    return this.store.put(job);
  }

  async quote(jobId, provider, { modelId, modelVersion } = {}) {
    providerMethods(provider);
    const job = this.#get(jobId);
    assertState(job, ["DRAFT", "QUOTED"], "quote");
    if (job.deadlineAt <= this.now()) return this.#timeout(job);

    let descriptor;
    try {
      descriptor = await provider.descriptor();
      const supported = assertProviderSupportsRequest420(descriptor, job.request, { modelId, modelVersion });
      const quote = await provider.quote({
        request: clone(job.request),
        modelId: supported.model.modelId,
        modelVersion: supported.model.modelVersion
      });
      this.#validateQuote(quote, job, supported.descriptor, supported.model);

      job.state = "QUOTED";
      job.provider = {
        providerId: supported.descriptor.providerId,
        providerRevision: supported.descriptor.providerRevision,
        modelId: supported.model.modelId,
        modelVersion: supported.model.modelVersion,
        capabilitiesDigest: digest420(supported.descriptor)
      };
      job.quote = clone(quote);
      job.lastError = null;
      job.updatedAt = this.now();
      return this.store.put(job);
    } catch (error) {
      const normalized = normalizeProviderError420(error);
      if (normalized instanceof GenerationError420 &&
          ["UNSUPPORTED_CAPABILITY", "REFERENCE_AUDIO_NOT_AUTHORIZED", "NO_CAPACITY", "QUOTE_EXPIRED", "QUOTE_MISMATCH"].includes(normalized.code)) {
        throw normalized;
      }
      job.lastError = this.#errorSnapshot(normalized);
      job.updatedAt = this.now();
      this.store.put(job);
      throw normalized;
    }
  }

  async submit(jobId, provider) {
    providerMethods(provider);
    const job = this.#get(jobId);
    if (["SUBMITTED", "RUNNING", "SUCCEEDED"].includes(job.state)) return clone(job);
    assertState(job, ["QUOTED"], "submit");
    if (job.deadlineAt <= this.now()) return this.#timeout(job);
    if (!job.quote || !job.provider) throw new GenerationError420("QUOTE_MISMATCH", "quoted provider binding missing");
    if (job.quote.expiresAt <= this.now()) throw new GenerationError420("QUOTE_EXPIRED", "quote expired");

    try {
      const descriptor = await provider.descriptor();
      this.#assertProviderBinding(job, descriptor);
      job.submitAttempts += 1;
      const idempotencyKey = `hzgen-submit:${digest420({
        clientRequestId: job.clientRequestId,
        requestDigest: job.requestDigest,
        quoteId: job.quote.quoteId,
        providerId: job.provider.providerId,
        providerRevision: job.provider.providerRevision,
        modelId: job.provider.modelId,
        modelVersion: job.provider.modelVersion
      })}`;

      const submission = await provider.submit({
        request: clone(job.request),
        quote: clone(job.quote),
        idempotencyKey
      });
      for (const key of ["providerId", "providerRevision", "modelId", "modelVersion"]) {
        if (submission?.[key] !== job.provider[key]) {
          throw new GenerationError420("INTEGRITY_MISMATCH", `provider submission ${key} mismatch`);
        }
      }
      if (!submission?.providerJobRef) {
        throw new GenerationError420("MALFORMED_RESULT", "provider submission missing providerJobRef");
      }

      job.providerJobRef = submission.providerJobRef;
      job.state = "SUBMITTED";
      job.lastError = null;
      job.updatedAt = this.now();
      return this.store.put(job);
    } catch (error) {
      const normalized = normalizeProviderError420(error);
      job.lastError = this.#errorSnapshot(normalized);
      job.updatedAt = this.now();
      this.store.put(job);
      throw normalized;
    }
  }

  async poll(jobId, provider) {
    providerMethods(provider);
    const job = this.#get(jobId);
    if (TERMINAL.has(job.state)) return clone(job);
    assertState(job, ["SUBMITTED", "RUNNING"], "poll");
    if (job.deadlineAt <= this.now()) return this.#timeout(job);

    try {
      const descriptor = await provider.descriptor();
      this.#assertProviderBinding(job, descriptor);
      const status = await provider.poll({ providerJobRef: job.providerJobRef });

      if (status?.status === "RUNNING" || status?.status === "SUBMITTED") {
        job.state = "RUNNING";
        job.lastError = null;
        job.updatedAt = this.now();
        return this.store.put(job);
      }

      if (status?.status === "CANCELLED") {
        job.state = "CANCELLED";
        job.lastError = this.#errorSnapshot(new GenerationError420("CANCELLED", "provider reports generation cancelled", { retryable: false }));
        job.updatedAt = this.now();
        return this.store.put(job);
      }

      if (status?.status === "FAILED") {
        job.state = "FAILED";
        job.lastError = this.#errorSnapshot(new GenerationError420(
          "PROVIDER_REJECTED",
          "provider reports generation failed",
          { retryable: Boolean(status.retryable), providerCode: status.providerCode ?? null }
        ));
        job.updatedAt = this.now();
        return this.store.put(job);
      }

      if (status?.status !== "SUCCEEDED") {
        throw new GenerationError420("MALFORMED_RESULT", "provider returned unknown lifecycle status");
      }

      job.outputManifest = validateOutputManifest420(status.outputManifest, {
        providerId: job.provider.providerId,
        providerRevision: job.provider.providerRevision,
        modelId: job.provider.modelId,
        modelVersion: job.provider.modelVersion,
        providerJobRef: job.providerJobRef
      });
      if (this.requireCanonicalResult && this.verifyProviderResult({ jobId: job.jobId, providerJobRef: job.providerJobRef, provider: clone(job.provider), outputManifest: clone(job.outputManifest), resultCommitment: status.resultCommitment, verificationRef: status.verificationRef }) !== true) {
        throw new GenerationError420("INTEGRITY_MISMATCH", "canonical provider result verification failed");
      }
      job.executionEvidence = {
        resultCommitment: status.resultCommitment ?? null,
        verificationRef: status.verificationRef ?? null,
        entitlementRef: status.entitlementRef ?? null,
        settlementRef: status.settlementRef ?? null
      };
      job.state = "SUCCEEDED";
      job.lastError = null;
      job.updatedAt = this.now();
      return this.store.put(job);
    } catch (error) {
      const normalized = normalizeProviderError420(error);
      if (["MALFORMED_RESULT", "INTEGRITY_MISMATCH"].includes(normalized.code)) {
        job.state = "FAILED";
      }
      job.lastError = this.#errorSnapshot(normalized);
      job.updatedAt = this.now();
      this.store.put(job);
      throw normalized;
    }
  }

  async cancel(jobId, provider) {
    const job = this.#get(jobId);
    if (TERMINAL.has(job.state)) return clone(job);

    if (["DRAFT", "QUOTED"].includes(job.state)) {
      job.state = "CANCELLED";
      job.lastError = this.#errorSnapshot(new GenerationError420("CANCELLED", "generation cancelled before provider submission", { retryable: false }));
      job.updatedAt = this.now();
      return this.store.put(job);
    }

    providerMethods(provider);
    assertState(job, ["SUBMITTED", "RUNNING"], "cancel");
    try {
      const descriptor = await provider.descriptor();
      this.#assertProviderBinding(job, descriptor);
      const response = await provider.cancel({ providerJobRef: job.providerJobRef });
      if (response?.status !== "CANCELLED") {
        throw new GenerationError420("PROVIDER_REJECTED", "provider did not confirm cancellation");
      }
      job.state = "CANCELLED";
      job.lastError = this.#errorSnapshot(new GenerationError420("CANCELLED", "generation cancelled", { retryable: false }));
      job.updatedAt = this.now();
      return this.store.put(job);
    } catch (error) {
      const normalized = normalizeProviderError420(error);
      job.lastError = this.#errorSnapshot(normalized);
      job.updatedAt = this.now();
      this.store.put(job);
      throw normalized;
    }
  }

  enforceTimeout(jobId) {
    const job = this.#get(jobId);
    if (TERMINAL.has(job.state)) return clone(job);
    if (job.deadlineAt > this.now()) return clone(job);
    return this.#timeout(job);
  }

  get(jobId) {
    return this.#get(jobId);
  }

  #get(jobId) {
    const job = this.store.get(jobId);
    if (!job) throw new GenerationError420("INVALID_REQUEST", "generation job not found");
    return job;
  }

  #timeout(job) {
    job.state = "FAILED";
    job.lastError = this.#errorSnapshot(new GenerationError420(
      "TIMEOUT",
      "generation job deadline exceeded",
      { retryable: true }
    ));
    job.updatedAt = this.now();
    return this.store.put(job);
  }

  #errorSnapshot(error) {
    return {
      code: error.code ?? "INTERNAL_ERROR",
      retryable: Boolean(error.retryable),
      providerCode: error.providerCode ?? null,
      message: String(error.message ?? "generation error")
    };
  }

  #assertProviderBinding(job, descriptor) {
    const d = assertProviderSupportsRequest420(descriptor, job.request, {
      modelId: job.provider.modelId,
      modelVersion: job.provider.modelVersion
    }).descriptor;
    if (
      d.providerId !== job.provider.providerId ||
      d.providerRevision !== job.provider.providerRevision ||
      digest420(d) !== job.provider.capabilitiesDigest
    ) {
      throw new GenerationError420("QUOTE_MISMATCH", "provider capabilities changed after quote");
    }
  }

  #validateQuote(quote, job, descriptor, model) {
    if (!quote || typeof quote !== "object") throw new GenerationError420("QUOTE_MISMATCH", "provider quote missing");
    const exact = {
      providerId: descriptor.providerId,
      providerRevision: descriptor.providerRevision,
      modelId: model.modelId,
      modelVersion: model.modelVersion,
      clientRequestId: job.clientRequestId,
      requestDigest: digest420(job.request)
    };
    for (const [key, value] of Object.entries(exact)) {
      if (quote[key] !== value) throw new GenerationError420("QUOTE_MISMATCH", `quote ${key} mismatch`);
    }
    if (typeof quote.quoteId !== "string" || !quote.quoteId) throw new GenerationError420("QUOTE_MISMATCH", "quoteId missing");
    if (typeof quote.amount !== "string" || !quote.amount) throw new GenerationError420("QUOTE_MISMATCH", "quote amount missing");
    if (typeof quote.asset !== "string" || !quote.asset) throw new GenerationError420("QUOTE_MISMATCH", "quote asset missing");
    if (!Number.isInteger(quote.expiresAt) || quote.expiresAt <= this.now()) {
      throw new GenerationError420("QUOTE_EXPIRED", "quote expired");
    }
    if (!quote.capacity || !Number.isInteger(quote.capacity.availableSlots)) {
      throw new GenerationError420("QUOTE_MISMATCH", "quote capacity envelope missing");
    }
  }
}
