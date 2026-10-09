# HZ-GCA-2 — Generation job and provider abstraction

Status: **COMPLETE — Level 1 exact-head qualified**

Canonical roadmap step:

**HZ-GCA-2 — Generation job and provider abstraction**

Machine-readable contract:

`hz/config/gca-generation-provider-abstraction-v1.json`

Implementation:

`hz/generate/`

HZ-GCA-2 creates a provider-neutral application abstraction for music-generation jobs.

It deliberately stops before HZ-GCA-3. It does not route jobs into 420AI/ComputeMarket, create escrow/settlement authority, register Creative objects, publish music, or make any provider canonical protocol authority.

## Request model

A generation request supports:

- prompt;
- optional lyrics;
- genre controls;
- style controls;
- mood controls;
- instrumentation controls;
- requested duration;
- VOCAL or INSTRUMENTAL mode;
- optional reference audio through an approved authorization path only.

The normalized request is canonicalized and SHA-256 hashed to derive:

`hzgen:<64-hex-digest>`

as its client request ID.

The same normalized request produces the same client request ID.

If a caller supplies an expected request ID that does not match the normalized request material, the request fails closed with `INVALID_CLIENT_REQUEST_ID`.

This prevents callers from assigning the same replay identity to changed material.

## Lyrics and instrumental mode

Lyrics are optional for VOCAL generation.

INSTRUMENTAL mode rejects non-empty lyrics rather than silently ignoring them.

That keeps the client request commitment honest about the requested generation semantics.

## Reference audio

Reference audio is optional.

HZ-GCA-2 permits exactly:

`AUTHORIZED_STORAGE_REF`

The reference requires:

- `storageRef`;
- `authorizationRef`.

It may additionally carry:

- `sourceRecordingId`;
- purpose metadata.

Raw URLs, arbitrary provider uploads, or caller claims without an authorization reference are not accepted by the provider-neutral request schema.

The abstraction does not decide whether the underlying rights claim is legally or canonically valid; it only requires the later provider path to carry an already-authorized reference rather than bypassing HZ-GCA-1.6.

## Provider capability descriptor

Every provider exposes a descriptor containing:

- provider ID;
- provider revision;
- model list;
- capacity envelope.

Each model binds:

- model ID;
- model version;
- maximum duration;
- supported VOCAL/INSTRUMENTAL modes;
- lyrics support;
- reference-audio support;
- permitted reference-audio paths;
- output kinds.

The descriptor also reports:

- available slots;
- queue depth;
- estimated start delay.

These values are provider/app selection information.

They are not protocol truth, settlement authority, Creative identity, Rights authority, or guaranteed SLA.

## Model/version identity

Model family and model version remain distinct.

A quote is bound to the exact:

- provider ID;
- provider revision;
- model ID;
- model version;
- client request ID;
- request digest.

If the provider revision or capability descriptor changes after quote, submission fails closed and requires a new compatible quote.

HZ-GCA-2 does not silently carry an old quote across a materially changed provider capability revision.

## Quote model

The provider-neutral quote contains:

- quote ID;
- provider ID/revision;
- model ID/version;
- client request ID;
- request digest;
- amount;
- asset;
- capacity envelope;
- issue time;
- expiry.

The quote is application/provider information only.

It does not prove:

- Vault funding;
- accepted ComputeMarket price;
- provider entitlement;
- settlement;
- refund;
- payment.

Those remain HZ-GCA-3 / canonical compute-economic concerns.

## Job lifecycle

HZ-GCA-2 freezes the application execution lifecycle:

`DRAFT → QUOTED → SUBMITTED → RUNNING → SUCCEEDED`

Exceptional terminal states:

- FAILED
- CANCELLED

Timeout is represented as:

`FAILED + TIMEOUT`

rather than inventing a separate canonical provider/protocol state.

Key rules:

- DRAFT may be quoted or cancelled locally;
- QUOTED may be submitted, requoted or cancelled;
- SUBMITTED/RUNNING may be polled or cancelled;
- provider SUCCESS does not become HZ-GCA SUCCEEDED until the output manifest validates;
- timeout never fabricates success/output;
- provider job state never implies VERIFIED/SETTLED/REGISTERED/PUBLISHED.

## Replay and idempotency

Generation creation is keyed by deterministic client request ID.

The same normalized request resolves to the same application job identity.

Provider submission uses a deterministic idempotency key bound to:

- client request ID;
- request digest;
- quote ID;
- provider ID/revision;
- model ID/version.

A repeated submit returns the same logical provider job rather than creating another one.

Changed request material cannot reuse an expected client request ID.

Transient submit failure leaves the job QUOTED so the exact bound operation may be retried.

Transient poll failure leaves SUBMITTED/RUNNING state intact and never resubmits execution.

## Cancellation

Cancellation before provider submission is local application cancellation.

Cancellation after SUBMITTED/RUNNING calls the selected provider's cancel boundary and only changes the app job to CANCELLED after a valid provider cancellation response.

Cancellation does not imply refund/payment movement.

## Timeout

Every job has an application deadline.

When the deadline passes before terminal success:

- the app job becomes FAILED;
- `lastError.code = TIMEOUT`;
- the error is retryable as an application diagnostic;
- no output manifest is fabricated.

HZ-GCA-2 does not automatically submit a second provider job after timeout.

Any later paid retry/recovery rules remain constrained by HZ-GCA-1.9 and HZ-GCA-1.17.

## Output manifest

A successful output manifest binds:

- provider ID;
- provider revision;
- model ID;
- model version;
- provider job reference;
- artifact list.

The manifest requires at least one:

- MIX artifact.

It can additionally carry:

- STEM;
- LYRICS_TIMING;
- ARTWORK.

Every artifact carries:

- kind;
- storage reference;
- integrity reference;
- optional label.

The abstraction intentionally carries references and integrity commitments rather than provider-specific raw payload structures.

Provider/model/job identity mismatch produces `INTEGRITY_MISMATCH`.

Malformed or MIX-less provider output produces `MALFORMED_RESULT`.

## Provider-independent error taxonomy

HZ-GCA-2 freezes:

- INVALID_REQUEST
- INVALID_CLIENT_REQUEST_ID
- REFERENCE_AUDIO_NOT_AUTHORIZED
- UNSUPPORTED_CAPABILITY
- NO_CAPACITY
- QUOTE_EXPIRED
- QUOTE_MISMATCH
- REPLAY_CONFLICT
- PROVIDER_UNAVAILABLE
- PROVIDER_REJECTED
- TIMEOUT
- CANCELLED
- MALFORMED_RESULT
- INTEGRITY_MISMATCH
- INTERNAL_ERROR

Provider-native error codes may be retained as diagnostic metadata only.

They cannot define cross-provider application semantics.

Transient network/provider errors normalize to retryable `PROVIDER_UNAVAILABLE`.

## Deterministic mock provider

`DeterministicMockGenerationProvider420` implements the same provider interface used by future real adapters.

The mock provides:

- deterministic descriptors;
- deterministic quotes;
- idempotent submit;
- provider job references;
- RUNNING/SUCCEEDED progression;
- MIX/STEM/LYRICS_TIMING/ARTWORK output references;
- cancellation;
- deterministic fault injection.

Supported fault fixtures include:

- descriptor unavailable;
- quote unavailable;
- submit unavailable;
- submit rejected;
- poll unavailable;
- provider execution failed;
- malformed result;
- configurable RUNNING poll count.

The mock is not represented as a production provider.

## Authority boundary

No provider becomes canonical protocol authority.

A provider may supply:

- capability descriptors;
- capacity observations;
- quotes;
- execution status;
- output references;
- provider diagnostics.

It cannot, through HZ-GCA-2, establish:

- Wallet authority;
- Identity;
- Creative Creator/Work/Recording IDs;
- Rights/license authorization;
- canonical 420AI verification;
- ComputeMarket accepted settlement terms;
- Vault funding;
- provider entitlement;
- payment/refund finality;
- publication state;
- Charts;
- Awards;
- moderation;
- governance.

HZ-GCA-3 remains the owner of canonical 420AI / Compute Market execution integration.

## Tests

`hz/generate/test/generation-job.test.js` covers:

- deterministic request IDs;
- mismatched request-ID replay failure;
- authorized reference-audio path;
- instrumental/lyrics conflict;
- provider capability/model/version/capacity descriptors;
- rejection of unapproved reference-audio capability paths;
- quoted cost/capacity envelope;
- full DRAFT→QUOTED→SUBMITTED→RUNNING→SUCCEEDED lifecycle;
- provider-neutral output manifest;
- idempotent create/submit replay;
- transient submit retry;
- transient poll retry without resubmission;
- cancellation before/after provider submission;
- timeout;
- provider capability-revision drift;
- malformed result failure;
- output identity mismatch;
- exact error-taxonomy freeze.

## Invariants

The machine-readable manifest freezes **HZGCA2-001 through HZGCA2-018**.

The central guarantees are:

- deterministic request/replay identity;
- authorized reference-audio path only;
- provider/model/version binding;
- explicit quote cost/capacity/expiry;
- idempotent provider submission;
- provider-independent failure semantics;
- fail-closed malformed/integrity handling;
- provider-neutral output artifacts;
- no provider canonical authority;
- HZ-GCA-3 ownership of 420AI/Compute routing/settlement.

## Qualification level

HZ-GCA-2 is an ordinary **Level 1** app-scoped implementation step.

It does not independently trigger a new Level-2 milestone.

The implementation changes only the 420Hz generation abstraction, its tests, docs/config/verifier and directly applicable 420Hz GCA workflow.

## Exit criteria

HZ-GCA-2 is complete when:

- provider abstraction exists;
- deterministic mock exists;
- required request controls exist;
- reference audio is authorization-path constrained;
- deterministic request/replay identity exists;
- quote cost/capacity envelope exists;
- lifecycle/cancellation/timeout exist;
- provider/model/version identity exists;
- output manifest supports MIX/STEM/LYRICS_TIMING/ARTWORK references;
- provider-independent errors are frozen;
- lifecycle and failure/retry tests pass;
- provider authority remains bounded;
- exact-head Level-1 qualification passes with no required skipped/cancelled/missing checks.

Next canonical roadmap step:

**HZ-GCA-3 — 420AI / Compute Market execution adapter**


## Qualification result

Qualified implementation SHA:

`d983e77cadb8d6cfb09bc3a6da0c02e027c1b3f2`

Required workflow:

- **420Hz GCA Qualification**
- Run: **37809590885** (#291)
- Job: **HZ-GCA Level 1**
- Job ID: **113422667411**
- Result: **PASS**

The generation module qualification executed 17 Node tests with:

- pass: 17
- fail: 0
- cancelled: 0
- skipped: 0

The targeted HZ-GCA-2 verifier passed, and retained HZ-GCA-1.1 through HZ-GCA-1.19 architecture verifiers also passed on the exact same implementation SHA.

Level 2 was intentionally not run for HZ-GCA-2. The conditional HZ-GCA Level-2 job correctly classified this commit as non-milestone and skipped its broader retained integration steps.

**HZ-GCA-2 is COMPLETE at Level 1.**
