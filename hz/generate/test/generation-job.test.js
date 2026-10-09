import test from "node:test";
import assert from "node:assert/strict";
import {
  DeterministicMockGenerationProvider420,
  GENERATION_ERROR_CODES_420,
  GenerationError420,
  GenerationJobManager420,
  buildGenerationRequest420,
  deriveClientRequestId420,
  validateCapabilityDescriptor420,
  validateOutputManifest420
} from "../src/index.js";

function request(overrides = {}) {
  return {
    prompt: "slow distorted grunge song about a motel at dawn",
    lyrics: "the hallway hums / the radio lies",
    controls: {
      genres: ["grunge"],
      styles: ["lo-fi", "dynamic"],
      moods: ["melancholy"],
      instrumentation: ["electric guitar", "bass", "drums"]
    },
    durationSec: 210,
    mode: "VOCAL",
    ...overrides
  };
}

test("deterministic client request id is stable across key ordering", () => {
  const a = request();
  const b = {
    mode: "VOCAL",
    durationSec: 210,
    controls: {
      instrumentation: ["electric guitar", "bass", "drums"],
      moods: ["melancholy"],
      styles: ["lo-fi", "dynamic"],
      genres: ["grunge"]
    },
    lyrics: "the hallway hums / the radio lies",
    prompt: "slow distorted grunge song about a motel at dawn"
  };
  assert.equal(deriveClientRequestId420(a), deriveClientRequestId420(b));
  assert.match(deriveClientRequestId420(a), /^hzgen:[0-9a-f]{64}$/);
});

test("client request id mismatch fails closed instead of accepting replay alias", () => {
  assert.throws(
    () => buildGenerationRequest420(request({ prompt: "changed" }), { expectedClientRequestId: deriveClientRequestId420(request()) }),
    (error) => error instanceof GenerationError420 && error.code === "INVALID_CLIENT_REQUEST_ID"
  );
});

test("reference audio requires the explicit authorized storage path and authorization reference", () => {
  assert.throws(
    () => buildGenerationRequest420(request({
      referenceAudio: { path: "RAW_URL", storageRef: "https://example.invalid/a.wav", authorizationRef: "auth:1" }
    })),
    (error) => error.code === "REFERENCE_AUDIO_NOT_AUTHORIZED"
  );

  const built = buildGenerationRequest420(request({
    referenceAudio: {
      path: "AUTHORIZED_STORAGE_REF",
      storageRef: "storage:audio:1",
      authorizationRef: "rights:license:1",
      sourceRecordingId: "recording:1"
    }
  }));
  assert.equal(built.referenceAudio.path, "AUTHORIZED_STORAGE_REF");
  assert.equal(built.referenceAudio.authorizationRef, "rights:license:1");
});

test("instrumental mode rejects lyrics", () => {
  assert.throws(
    () => buildGenerationRequest420(request({ mode: "INSTRUMENTAL", lyrics: "should not be accepted" })),
    (error) => error.code === "INVALID_REQUEST"
  );
});

test("provider descriptor freezes capability, model version and capacity envelope", async () => {
  const provider = new DeterministicMockGenerationProvider420({ availableSlots: 3, queueDepth: 2, estimatedStartMs: 4200 });
  const descriptor = await provider.descriptor();
  assert.equal(descriptor.providerId, "mock:420hz");
  assert.equal(descriptor.providerRevision, "rev:1");
  assert.equal(descriptor.models[0].modelId, "mock:music");
  assert.equal(descriptor.models[0].modelVersion, "1.0.0");
  assert.equal(descriptor.capacity.availableSlots, 3);
  assert.equal(descriptor.capacity.queueDepth, 2);
  assert.equal(descriptor.capacity.estimatedStartMs, 4200);
  assert.deepEqual(descriptor.models[0].referenceAudioPaths, ["AUTHORIZED_STORAGE_REF"]);
});

test("provider descriptors cannot advertise unapproved reference-audio paths", () => {
  assert.throws(
    () => validateCapabilityDescriptor420({
      providerId: "provider:x",
      providerRevision: "1",
      models: [{
        modelId: "m",
        modelVersion: "1",
        maxDurationSec: 300,
        modes: ["VOCAL"],
        supportsLyrics: true,
        supportsReferenceAudio: true,
        referenceAudioPaths: ["RAW_URL"],
        outputKinds: ["MIX"]
      }],
      capacity: { availableSlots: 1, queueDepth: 0, estimatedStartMs: 0 }
    }),
    (error) => error.code === "UNSUPPORTED_CAPABILITY"
  );
});

test("quoted lifecycle binds cost, capacity, provider identity and model version", async () => {
  let now = 1_000;
  const manager = new GenerationJobManager420({ now: () => now });
  const provider = new DeterministicMockGenerationProvider420({ now: () => now });
  const draft = manager.create(request(), { timeoutMs: 120_000 });
  assert.equal(draft.state, "DRAFT");

  const quoted = await manager.quote(draft.jobId, provider, { modelId: "mock:music", modelVersion: "1.0.0" });
  assert.equal(quoted.state, "QUOTED");
  assert.equal(quoted.quote.asset, "$420");
  assert.equal(quoted.quote.amount, "420000000000000000");
  assert.equal(quoted.quote.capacity.availableSlots, 4);
  assert.equal(quoted.provider.providerId, "mock:420hz");
  assert.equal(quoted.provider.providerRevision, "rev:1");
  assert.equal(quoted.provider.modelVersion, "1.0.0");
});

test("full provider-neutral lifecycle reaches SUCCEEDED with mix stems lyrics timing and artwork", async () => {
  let now = 10_000;
  const manager = new GenerationJobManager420({ now: () => now });
  const provider = new DeterministicMockGenerationProvider420({ now: () => now, faults: { runningPolls: 1 } });
  const draft = manager.create(request(), { timeoutMs: 120_000 });
  await manager.quote(draft.jobId, provider, { modelId: "mock:music", modelVersion: "1.0.0" });
  const submitted = await manager.submit(draft.jobId, provider);
  assert.equal(submitted.state, "SUBMITTED");

  const running = await manager.poll(draft.jobId, provider);
  assert.equal(running.state, "RUNNING");

  const succeeded = await manager.poll(draft.jobId, provider);
  assert.equal(succeeded.state, "SUCCEEDED");
  assert.deepEqual(
    [...new Set(succeeded.outputManifest.artifacts.map((x) => x.kind))].sort(),
    ["ARTWORK", "LYRICS_TIMING", "MIX", "STEM"]
  );
  assert.equal(succeeded.outputManifest.providerId, succeeded.provider.providerId);
  assert.equal(succeeded.outputManifest.modelVersion, succeeded.provider.modelVersion);
});

test("same logical create and submit are replay-safe and do not duplicate provider jobs", async () => {
  let now = 20_000;
  const manager = new GenerationJobManager420({ now: () => now });
  const provider = new DeterministicMockGenerationProvider420({ now: () => now });
  const first = manager.create(request());
  const second = manager.create(request());
  assert.equal(second.jobId, first.jobId);

  await manager.quote(first.jobId, provider, { modelId: "mock:music", modelVersion: "1.0.0" });
  const submitted1 = await manager.submit(first.jobId, provider);
  const submitted2 = await manager.submit(first.jobId, provider);
  assert.equal(submitted2.providerJobRef, submitted1.providerJobRef);
  assert.equal(provider.jobs.size, 1);
});

test("transient submit failure stays quoted and can retry with the same logical binding", async () => {
  let now = 30_000;
  const provider = new DeterministicMockGenerationProvider420({ now: () => now, faults: { submitUnavailable: true } });
  const manager = new GenerationJobManager420({ now: () => now });
  const draft = manager.create(request());
  await manager.quote(draft.jobId, provider, { modelId: "mock:music", modelVersion: "1.0.0" });

  await assert.rejects(
    () => manager.submit(draft.jobId, provider),
    (error) => error.code === "PROVIDER_UNAVAILABLE" && error.retryable === true
  );
  assert.equal(manager.get(draft.jobId).state, "QUOTED");
  assert.equal(manager.get(draft.jobId).lastError.code, "PROVIDER_UNAVAILABLE");

  provider.faults.submitUnavailable = false;
  const submitted = await manager.submit(draft.jobId, provider);
  assert.equal(submitted.state, "SUBMITTED");
  assert.equal(submitted.submitAttempts, 2);
  assert.equal(provider.jobs.size, 1);
});

test("transient poll failure is retryable without resubmitting execution", async () => {
  let now = 40_000;
  const provider = new DeterministicMockGenerationProvider420({ now: () => now, faults: { pollUnavailable: true } });
  const manager = new GenerationJobManager420({ now: () => now });
  const draft = manager.create(request());
  await manager.quote(draft.jobId, provider, { modelId: "mock:music", modelVersion: "1.0.0" });
  await manager.submit(draft.jobId, provider);

  await assert.rejects(
    () => manager.poll(draft.jobId, provider),
    (error) => error.code === "PROVIDER_UNAVAILABLE" && error.retryable === true
  );
  assert.equal(manager.get(draft.jobId).state, "SUBMITTED");
  assert.equal(provider.jobs.size, 1);

  provider.faults.pollUnavailable = false;
  const done = await manager.poll(draft.jobId, provider);
  assert.equal(done.state, "SUCCEEDED");
  assert.equal(provider.jobs.size, 1);
});

test("cancellation works before and after provider submission", async () => {
  let now = 50_000;
  const provider = new DeterministicMockGenerationProvider420({ now: () => now });
  const manager = new GenerationJobManager420({ now: () => now });

  const local = manager.create(request({ prompt: "cancel before quote" }));
  assert.equal((await manager.cancel(local.jobId, provider)).state, "CANCELLED");

  const remote = manager.create(request({ prompt: "cancel after submit" }));
  await manager.quote(remote.jobId, provider, { modelId: "mock:music", modelVersion: "1.0.0" });
  const submitted = await manager.submit(remote.jobId, provider);
  assert.equal((await manager.cancel(remote.jobId, provider)).state, "CANCELLED");
  assert.equal(provider.jobs.get(submitted.providerJobRef).cancelled, true);
});

test("deadline timeout fails with provider-independent TIMEOUT without fabricating success", async () => {
  let now = 60_000;
  const provider = new DeterministicMockGenerationProvider420({ now: () => now });
  const manager = new GenerationJobManager420({ now: () => now });
  const draft = manager.create(request(), { timeoutMs: 1_000 });
  await manager.quote(draft.jobId, provider, { modelId: "mock:music", modelVersion: "1.0.0" });
  await manager.submit(draft.jobId, provider);

  now = 61_001;
  const timedOut = manager.enforceTimeout(draft.jobId);
  assert.equal(timedOut.state, "FAILED");
  assert.equal(timedOut.lastError.code, "TIMEOUT");
  assert.equal(timedOut.lastError.retryable, true);
  assert.equal(timedOut.outputManifest, null);
});

test("provider capability revision drift after quote fails closed", async () => {
  let now = 70_000;
  const first = new DeterministicMockGenerationProvider420({ now: () => now, providerRevision: "rev:1" });
  const changed = new DeterministicMockGenerationProvider420({ now: () => now, providerRevision: "rev:2" });
  const manager = new GenerationJobManager420({ now: () => now });
  const draft = manager.create(request());
  await manager.quote(draft.jobId, first, { modelId: "mock:music", modelVersion: "1.0.0" });

  await assert.rejects(
    () => manager.submit(draft.jobId, changed),
    (error) => error.code === "QUOTE_MISMATCH"
  );
  assert.equal(manager.get(draft.jobId).state, "QUOTED");
});

test("malformed output manifest fails the job rather than trusting provider success prose", async () => {
  let now = 80_000;
  const provider = new DeterministicMockGenerationProvider420({ now: () => now, faults: { malformedResult: true } });
  const manager = new GenerationJobManager420({ now: () => now });
  const draft = manager.create(request());
  await manager.quote(draft.jobId, provider, { modelId: "mock:music", modelVersion: "1.0.0" });
  await manager.submit(draft.jobId, provider);

  await assert.rejects(
    () => manager.poll(draft.jobId, provider),
    (error) => error.code === "MALFORMED_RESULT"
  );
  assert.equal(manager.get(draft.jobId).state, "FAILED");
});

test("output manifest integrity binds provider/model/job identity", () => {
  assert.throws(
    () => validateOutputManifest420({
      providerId: "provider:evil",
      providerRevision: "rev:1",
      modelId: "model:1",
      modelVersion: "1",
      providerJobRef: "job:1",
      artifacts: [{ kind: "MIX", storageRef: "storage:1", integrity: "sha256:1" }]
    }, {
      providerId: "provider:expected",
      providerRevision: "rev:1",
      modelId: "model:1",
      modelVersion: "1",
      providerJobRef: "job:1"
    }),
    (error) => error.code === "INTEGRITY_MISMATCH"
  );
});

test("provider-independent error taxonomy is frozen and does not expose provider authority states", () => {
  assert.deepEqual(GENERATION_ERROR_CODES_420, [
    "INVALID_REQUEST",
    "INVALID_CLIENT_REQUEST_ID",
    "REFERENCE_AUDIO_NOT_AUTHORIZED",
    "UNSUPPORTED_CAPABILITY",
    "NO_CAPACITY",
    "QUOTE_EXPIRED",
    "QUOTE_MISMATCH",
    "REPLAY_CONFLICT",
    "PROVIDER_UNAVAILABLE",
    "PROVIDER_REJECTED",
    "TIMEOUT",
    "CANCELLED",
    "MALFORMED_RESULT",
    "INTEGRITY_MISMATCH",
    "INTERNAL_ERROR"
  ]);
  assert.equal(GENERATION_ERROR_CODES_420.includes("CANONICAL_SUCCESS"), false);
  assert.equal(GENERATION_ERROR_CODES_420.includes("SETTLED"), false);
});

test("canonical mode fails closed without a verifier or on forged provider result",async()=>{
 assert.throws(()=>new GenerationJobManager420({requireCanonicalResult:true}),/canonical provider verifier required/);
 const now=()=>10000,provider=new DeterministicMockGenerationProvider420({now});
 const manager=new GenerationJobManager420({now,requireCanonicalResult:true,verifyProviderResult:()=>false});
 const draft=manager.create(request(),{timeoutMs:120000});
 await manager.quote(draft.jobId,provider,{modelId:"mock:music",modelVersion:"1.0.0"});
 await manager.submit(draft.jobId,provider);
 await assert.rejects(()=>manager.poll(draft.jobId,provider),e=>e.code==="INTEGRITY_MISMATCH");
 assert.equal(manager.get(draft.jobId).state,"FAILED");
});
test("canonical mode accepts only positively verified provider manifests",async()=>{
 const now=()=>10000,provider=new DeterministicMockGenerationProvider420({now});
 let observed;
 const manager=new GenerationJobManager420({now,requireCanonicalResult:true,verifyProviderResult:e=>{observed=e;return e.provider.providerId==="mock:420hz"&&e.outputManifest.providerJobRef===e.providerJobRef&&Boolean(e.verificationRef)}});
 const draft=manager.create(request(),{timeoutMs:120000});
 await manager.quote(draft.jobId,provider,{modelId:"mock:music",modelVersion:"1.0.0"});
 await manager.submit(draft.jobId,provider);
 assert.equal((await manager.poll(draft.jobId,provider)).state,"SUCCEEDED");
 assert.equal(observed.jobId,draft.jobId);
});
