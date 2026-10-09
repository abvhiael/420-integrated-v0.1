# HZ-GCA-2 — Generation job and provider abstraction qualification evidence

Status: **COMPLETE — Level 1**

Canonical roadmap step: **HZ-GCA-2 — Generation job and provider abstraction**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` / base SHA: `0993ff5b5b3b213a0768dbde90e4734df5ab4cc0`
- Qualified implementation SHA: `d983e77cadb8d6cfb09bc3a6da0c02e027c1b3f2`
- Evidence SHA: the repository commit containing this document; the completion report records the exact resulting evidence HEAD.
- Qualification level: **Level 1 — ordinary app-scoped step**
- Level 2: **NOT REQUIRED / NOT RUN**
- Level 3: **DEFERRED to HZ-GCA-17**

## Canonical definition

HZ-GCA-2 requires a provider-neutral 420Hz generation job model with:

- prompt and optional lyrics;
- genre/style/mood/instrumentation controls;
- duration and instrumental/vocal mode;
- optional reference audio only through explicitly permitted paths;
- deterministic client request ID / replay protection;
- quoted cost/capacity envelope;
- lifecycle, cancellation and timeout;
- provider capability descriptors;
- provider/model version identity;
- output manifest supporting mix, stems, lyrics/timing and artwork references when available;
- provider-independent error taxonomy;
- no provider becoming canonical protocol authority.

Canonical exit:

**provider abstraction + mocks + lifecycle tests + failure/retry tests.**

## Implementation completed

Added provider-neutral runtime/model:

- `hz/generate/package.json`
- `hz/generate/src/index.js`
- `hz/generate/src/errors.js`
- `hz/generate/src/schema.js`
- `hz/generate/src/provider.js`
- `hz/generate/src/jobs.js`
- `hz/generate/test/generation-job.test.js`

Added architecture/config/verifier:

- `hz/config/gca-generation-provider-abstraction-v1.json`
- `docs/architecture/420hz/HZ-GCA-2-GENERATION-PROVIDER-ABSTRACTION.md`
- `scripts/verify-420hz-gca-2.py`

Updated:

- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-gca.yml`

## Requirements satisfied

### Prompt / lyrics / music controls

The normalized request supports:

- prompt;
- optional lyrics;
- genre;
- style;
- mood;
- instrumentation;
- duration;
- VOCAL / INSTRUMENTAL mode.

INSTRUMENTAL mode rejects non-empty lyrics rather than silently discarding committed request material.

### Reference audio authorization path

Reference audio is optional.

The only HZ-GCA-2 path is:

`AUTHORIZED_STORAGE_REF`

and it requires:

- `storageRef`;
- `authorizationRef`.

Raw provider URLs and unapproved reference-audio path values fail closed.

HZ-GCA-2 does not itself claim the authorization is canonical Rights truth; it preserves the HZ-GCA-1.6 boundary by requiring an already-authorized reference.

### Deterministic request identity / replay

The implementation canonicalizes normalized request material and derives:

`hzgen:<sha256>`

The same request produces the same client request ID.

Changed material cannot be accepted under an expected prior request ID.

Repeated creation resolves to the same job identity.

Provider submission uses a deterministic idempotency key bound to request, quote, provider revision and model version.

### Quote / cost / capacity

The provider-neutral quote binds:

- quote ID;
- provider ID/revision;
- model ID/version;
- client request ID;
- request digest;
- amount;
- asset;
- available slots;
- queue depth;
- estimated start delay;
- issue time;
- expiry.

A changed provider revision/capability descriptor after quote fails closed.

### Lifecycle / cancellation / timeout

Application execution states:

`DRAFT -> QUOTED -> SUBMITTED -> RUNNING -> SUCCEEDED`

Exceptional terminal states:

- FAILED
- CANCELLED

Timeout is represented as:

`FAILED + TIMEOUT`

Provider success is not accepted as SUCCEEDED until the provider-neutral output manifest validates.

Cancellation is supported both before and after provider submission.

### Provider capability descriptors

Descriptors bind:

- provider ID;
- provider revision;
- model ID;
- model version;
- max duration;
- supported modes;
- lyrics support;
- reference-audio support and allowed paths;
- output kinds;
- capacity.

### Output manifest

Required identity:

- provider ID/revision;
- model ID/version;
- provider job ref.

A successful result requires at least one MIX artifact.

Optional provider-neutral artifact types:

- STEM
- LYRICS_TIMING
- ARTWORK

Every artifact uses a storage reference plus integrity reference.

Provider/model/job identity mismatch fails as `INTEGRITY_MISMATCH`.

Malformed provider output fails as `MALFORMED_RESULT`.

### Provider-independent error taxonomy

Frozen application errors:

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

Provider-native codes are retained only as diagnostic metadata.

### Deterministic mock provider

The mock uses the exact provider interface future real adapters must implement and supports deterministic:

- descriptor;
- quote;
- submit;
- poll;
- cancel;
- output manifests;
- idempotent replay;
- injected provider/network/result faults.

It is not represented as a production/live provider.

### Authority boundary

HZ-GCA-2 does not create:

- Wallet authority;
- Identity authority;
- Creative publication identity;
- Rights/license truth;
- ComputeMarket matching/settlement;
- Vault funding;
- provider entitlement;
- payment/refund finality;
- publication state;
- Chart/Awards/moderation/governance authority.

Provider descriptor/quote/job/output state is application/provider input only.

HZ-GCA-3 remains the owner of canonical 420AI / Compute Market execution routing and settlement integration.

## Invariants

The machine-readable manifest freezes:

**HZGCA2-001 through HZGCA2-018**

covering deterministic replay identity, reference authorization, provider/model binding, quote/capacity, idempotency, error normalization, timeout/cancel, output validation, authority isolation and HZ-GCA-3 ownership.

## Level-1 qualification

Required workflow:

**420Hz GCA Qualification**

Successful exact-head run:

- Run ID: **37809590885**
- Run number: **#291**
- Job: **HZ-GCA Level 1**
- Job ID: **113422667411**
- Exact tested SHA: `d983e77cadb8d6cfb09bc3a6da0c02e027c1b3f2`
- Result: **PASS**

Required HZ-GCA-2 module qualification:

- syntax/static parse: PASS;
- Node generation suite: **17 PASS / 0 FAIL / 0 CANCELLED / 0 SKIPPED**;
- HZ-GCA-2 targeted verifier: PASS.

The same exact job also retained HZ-GCA-1.1 through HZ-GCA-1.19 verifiers, all PASS.

No required Level-1 check was skipped, cancelled, missing or untriggered.

## Directly relevant collateral

The same exact implementation SHA also passed:

- **420Hz Web Qualification #178**
- **420Docs Qualification #7440**

These are collateral; the authoritative HZ-GCA-2 result is the exact-head GCA Level-1 job.

Unrelated Oracle/Town workflows are not HZ-GCA-2 completion gates.

## Diagnosed failed attempts

### Attempt 1 — implementation defect

SHA:

`0bd0d22298c708f3629d7092ff5bc6d1956c7466`

Run:

`37808254835`

Failure:

the malformed provider-output test received `INVALID_REQUEST` from a shared string validator instead of the provider-independent `MALFORMED_RESULT` required by the output-manifest contract.

Repair:

- added manifest-specific string normalization;
- malformed provider manifest fields now map to `MALFORMED_RESULT`;
- no test assertion was weakened.

### Attempt 2 — verifier syntax defect

SHA:

`c54ef89005318aefda6cf5675c2b2d063aa02c4a`

Run:

`37808953828`

The Node suite passed all 17 tests.

The targeted verifier did not execute because its generated Python source contained an unterminated newline string.

Repair:

- fixed only verifier source syntax;
- application semantics unchanged.

### Attempt 3 — verifier wording/source-location defect

SHA:

`1d85ac62f993b5a3be399c299052b31b322cec65`

Run:

`37809287192`

The Node suite again passed 17/17.

The verifier required a literal `PROVIDER_UNAVAILABLE` token inside `jobs.js`, while the job manager correctly consumes `normalizeProviderError420` from `errors.js`, where the frozen code actually lives.

Repair:

- changed the verifier to require the normalization boundary in `jobs.js`;
- retained the exact error-code assertion in `errors.js`;
- no application behavior or security assertion weakened.

The repaired exact implementation SHA passed.

## CI classification repair

HZ-GCA-1.20 Level 2 had previously been configured to run whenever the milestone manifest merely existed.

That would have converted every later ordinary roadmap step into repeated Level-2 integration work.

HZ-GCA-2 repaired the classifier so HZ-GCA Level 2 activates only when the exact commit changes the HZ-GCA-1.20 milestone manifest/document.

On the successful HZ-GCA-2 run, the Level-2 job correctly classified the commit as non-milestone and skipped its broader steps.

Those skips are intentional and are **not required HZ-GCA-2 checks**.

## Level 2 status

**Not required / not run.**

HZ-GCA-2 is an ordinary app-scoped implementation step.

It introduces a provider-neutral 420Hz application abstraction and deterministic mock, but does not yet introduce the canonical 420AI/ComputeMarket adapter owned by HZ-GCA-3.

No new documented Level-2 milestone occurs at HZ-GCA-2.

## Intentionally deferred Level 3

Deferred to HZ-GCA-17:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Geth/global fault/soak;
- complete retained application/client/service/Indexer/Search/RPC suites;
- final security/static/deployment/config qualification;
- final roadmap/evidence/deployment reconciliation.

The full Solidity inventory remains owned by Solidity Contracts and must not be duplicated by Genesis.

## Limitations

HZ-GCA-2 intentionally does not implement or claim:

- live provider network endpoints;
- 420AI execution routing;
- Compute Market discovery/matching;
- canonical accepted price;
- Vault funding/escrow;
- provider entitlement/settlement/refund;
- result verification;
- production storage upload;
- production AI model/provider integration;
- testnet/production qualification.

Those belong to HZ-GCA-3 and later roadmap steps.

## Exit criteria verification

- provider-neutral abstraction: **PASS**
- deterministic mock provider: **PASS**
- prompt/lyrics/music controls: **PASS**
- duration and vocal/instrumental mode: **PASS**
- authorized reference-audio path: **PASS**
- deterministic client request ID/replay: **PASS**
- quote cost/capacity envelope: **PASS**
- lifecycle/cancel/timeout: **PASS**
- provider capability descriptors: **PASS**
- provider/model version identity: **PASS**
- output manifest MIX/STEM/LYRICS_TIMING/ARTWORK support: **PASS**
- provider-independent error taxonomy: **PASS**
- provider cannot become canonical authority: **PASS**
- lifecycle tests: **PASS**
- failure/retry tests: **PASS**
- exact-head Level-1 qualification: **PASS**
- required skipped/cancelled checks: **NONE**

## Blockers

None.

## Completion state

**HZ-GCA-2 — COMPLETE (Level 1).**

Next canonical roadmap step:

**HZ-GCA-3 — 420AI / Compute Market execution adapter**
