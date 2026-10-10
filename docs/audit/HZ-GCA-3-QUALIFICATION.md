# HZ-GCA-3 — 420AI / Compute Market execution adapter qualification evidence

Status: **COMPLETE — Level 1**

Canonical roadmap step: **HZ-GCA-3 — 420AI / Compute Market execution adapter**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` / base SHA: `0993ff5b5b3b213a0768dbde90e4734df5ab4cc0`
- Qualified implementation SHA: `28a87b7fda4e9a719dfedc4999466fc5beb75922`
- Evidence SHA: the commit containing this document; completion reporting records the resulting exact evidence HEAD.
- Qualification level: **Level 1 — ordinary app-scoped integration step**
- Level 2: **NOT REQUIRED / NOT RUN**
- Level 3: **DEFERRED to HZ-GCA-17**

## Canonical definition

HZ-GCA-3 routes music-generation execution through the canonical 420AI / Compute Market architecture while preserving the HZ-GCA-2 provider-neutral lifecycle.

Canonical requirements satisfied:

- 420AI job adapter for music-generation workloads;
- Compute worker/provider capability discovery;
- capacity-aware selection;
- price quote / funding / accepted-match / settlement integration where applicable;
- idempotent submit/retry/cancel;
- result commitment and verification hooks;
- timeout/failure/refund behavior;
- provider reputation/SLA as non-authoritative selection inputs;
- deterministic local/non-production adapter;
- future first-party/third-party model replacement without changing 420Hz publication semantics.

Canonical exit:

**end-to-end test generation using a qualified non-production adapter and the same lifecycle used by real providers.**

## Repository state / dependency inspection

The step was implemented against current main:

`0993ff5b5b3b213a0768dbde90e4734df5ab4cc0`

No newer relevant main change appeared before closeout, so no ceremonial reconciliation was required for this ordinary step.

Existing shared repository authority was inspected and retained rather than replaced:

- `contracts/src/ai/AIComputeAdapter420.sol`
- `packages/420-sdk/src/compute-client.ts`
- `services/compute-api/src/job-api.ts`
- `services/420ai-provider/src/runtime.js`
- existing 420AI Compute integration/runtime verifiers and tests.

HZ-GCA-3 changes no Solidity contract or shared Compute/AI protocol implementation.

## Implementation completed

Added:

- `hz/generate/src/compute-adapter.js`
- `hz/generate/test/compute-adapter.test.js`
- `hz/config/gca-compute-execution-adapter-v1.json`
- `docs/architecture/420hz/HZ-GCA-3-COMPUTE-EXECUTION-ADAPTER.md`
- `scripts/verify-420hz-gca-3.py`

Updated:

- `hz/generate/src/index.js`
- `hz/generate/package.json`
- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-gca.yml`
- `.github/workflows/420hz-web.yml`

## 420AI / Compute-backed provider adapter

`ComputeMarketGenerationProvider420` implements the exact HZ-GCA-2 `GenerationProvider420` interface.

The application therefore preserves:

`DRAFT -> QUOTED -> SUBMITTED -> RUNNING -> SUCCEEDED`

with FAILED/CANCELLED exceptional terminals rather than creating a second provider-specific application lifecycle.

## Canonical environment checks

Before discovery or execution the adapter verifies:

- selected chain ID;
- Compute component graph identity.

Wrong-chain and wrong-graph operation fails before generation discovery/execution.

## Worker/provider discovery

Discovery records are required to be explicitly:

`authoritative: false`

Candidates bind:

- Compute provider ID;
- worker ID;
- resource ID;
- model ID/version;
- supported generation mode;
- duration limit;
- lyrics/reference-audio capability;
- provider-neutral output kinds;
- available capacity;
- queue/start estimates;
- quoted price/asset;
- reputation/SLA signals;
- finality context.

A discovery record claiming canonical authority is rejected.

## Capacity-aware selection

A candidate is eligible only when it satisfies:

- exact model ID/version;
- requested VOCAL/INSTRUMENTAL mode;
- duration;
- lyrics support when required;
- approved reference-audio path when required;
- available capacity > 0;
- configured maximum price.

Eligible candidates are selected deterministically using:

1. lowest quote;
2. highest available capacity;
3. highest reputation;
4. highest SLA;
5. stable provider/resource identity.

Reputation and SLA remain non-authoritative selection inputs and cannot bypass compatibility, capacity, price, authorization or verification.

## Quote / accepted economic binding

The provider-neutral quote binds:

- model/version;
- request/client identity;
- price/asset;
- capacity;
- expiry;
- selected Compute provider/worker/resource.

On canonical submission the adapter separately retains:

- `computeRequestId`;
- `computeJobId`;
- `acceptedMatchRef`;
- `fundingRef`;
- accepted provider;
- accepted worker/resource;
- accepted price.

Provider/worker/resource or accepted-price drift after quote/acceptance fails closed.

Funding and accepted matching are not represented as settlement.

## Wallet authorization boundary

Submission and cancellation require an unsigned plan declaring:

- `requiresWalletAuthorization: true`;
- `canonicalAuthority: false`;
- `secretMaterialManaged: false`.

The adapter invokes the supplied Wallet authorization boundary and refuses to submit/cancel without an authorization reference.

420Hz neither signs nor holds Wallet private material.

## Idempotent submit / retry

HZ-GCA-2's deterministic submission identity is passed through to the Compute client.

Repeated submission of the same logical operation resolves to one Compute job.

The development adapter proves a single canonical job is created under replay.

## Compute lifecycle / verification

Running-like Compute states remain nonterminal application execution:

- CREATED
- FUNDED
- MATCHED
- ACCEPTED
- RUNNING
- RESULT_COMMITTED
- DISPUTED

Application success may be accepted only from:

- VERIFIED
- SETTLED

and only with:

- positive verification verdict;
- verification reference;
- result commitment;
- valid provider-neutral output manifest.

A malformed, negatively verified or identity-mismatched result cannot become application SUCCEEDED.

## Output manifest

Verified Compute output is mapped back into the same HZ-GCA-2 provider-neutral vocabulary:

- MIX
- STEM
- LYRICS_TIMING
- ARTWORK

At least one MIX remains mandatory.

This allows later provider/model replacement without changing 420Hz publication semantics.

## Settlement / entitlement / refund separation

HZ-GCA-3 keeps distinct:

- funding reference;
- accepted-match reference;
- result commitment;
- verification reference;
- entitlement reference;
- settlement reference;
- refund reference.

The adapter does not fabricate PAID or REFUNDED state.

A cancellation refund reference is an observed canonical reference, not a claim that money has already been paid back.

## Deterministic development adapter

`DeterministicDevelopmentComputeClient420` provides a repository/local non-production adapter implementing the same provider/GenerationJobManager lifecycle.

It deterministically exercises:

- discovery;
- quote/capacity;
- unsigned authorization plan;
- canonical-like request/job/match/funding identities;
- RUNNING -> VERIFIED/SETTLED progression;
- result commitment;
- positive verification;
- entitlement;
- settlement;
- cancellation/refund reference;
- MIX/STEM/LYRICS_TIMING/ARTWORK outputs.

It is explicitly not production/testnet evidence.

## Authority boundaries retained

HZ-GCA-3 creates no new:

- Wallet authority;
- custody authority;
- Compute matching authority;
- settlement/refund authority;
- Creative identity/publication authority;
- Rights/consent authority;
- Identity authority;
- Charts/Awards/moderation/governance authority.

Compute VERIFIED/SETTLED remains distinct from 420Hz REGISTERED/PUBLISHED.

## Machine-readable invariants

`hz/config/gca-compute-execution-adapter-v1.json` freezes:

**HZGCA3-001 through HZGCA3-018**

covering:

- chain/graph identity;
- derived discovery non-authority;
- capacity and maximum-price eligibility;
- non-authoritative reputation/SLA;
- immutable selected assignment;
- accepted-price integrity;
- Wallet authorization;
- replay/idempotency;
- positive verification;
- economic-reference separation;
- cancellation/refund boundaries;
- canonical failure handling;
- deterministic development parity;
- no publication/Rights authority;
- provider/model replacement semantics.

## Level-1 qualification

Because HZ-GCA-3 materially consumes already-existing 420AI/Compute interfaces, the ordinary Level-1 gate retained those directly affected compatibility suites without broadening into repository-global qualification.

Authoritative workflow:

**420Hz Web Qualification**

The existing main-backed 420Hz workflow was extended with a dedicated:

**HZ-GCA-3 Level 1**

job so the PR event could provide exact-head qualification even though the feature-only `420hz-gca.yml` workflow itself is not present on current main and therefore did not provide a reliable PR-triggered gate for this step.

Successful exact-head run:

- Run ID: **37813944369**
- Run number: **#195**
- Job: **HZ-GCA-3 Level 1**
- Job ID: **113437604323**
- Exact tested SHA: `28a87b7fda4e9a719dfedc4999466fc5beb75922`
- Result: **PASS**

Required checks:

1. exact PR-head checkout/verification — PASS;
2. generation module syntax/static checks — PASS;
3. combined HZ-GCA-2/HZ-GCA-3 Node suite — **29 PASS / 0 FAIL / 0 SKIPPED**;
4. retained HZ-GCA-2 targeted verifier — PASS;
5. HZ-GCA-3 targeted verifier — PASS;
6. canonical 420AI Compute integration verifier — PASS;
7. 420AI provider runtime — **14 PASS / 0 FAIL / 0 SKIPPED**;
8. 420AI provider runtime verifier — PASS;
9. Compute SDK — **28 PASS / 0 FAIL / 0 SKIPPED**;
10. Compute SDK build — PASS;
11. Compute API — **14 PASS / 0 FAIL / 0 SKIPPED**;
12. retained 420Hz web job — PASS.

No required HZ-GCA-3 check was skipped, cancelled, missing or untriggered on the qualified implementation SHA.

## Diagnosed qualification failures

### Attempt 1 — implementation defect: BigInt plan digest

Exact SHA:

`fedf143acf8ee2ccdc0ea544642404b663c45e51`

Workflow/run:

- 420Hz Web Qualification #193
- Run ID: `37813737773`
- HZ-GCA-3 Level 1 job: `113436899363`

Failure:

The development Compute submission plan hashed an object containing BigInt-valued selected candidate fields. The JSON-based canonical digest could not serialize BigInt, and the resulting generic exception was normalized as `PROVIDER_REJECTED`.

Repair:

- added deterministic recursive wire serialization converting BigInt values to decimal strings before plan hashing;
- retained the exact economic values;
- changed no test expectation or authority rule.

### Attempt 2 — implementation defect: non-authority marker lost

Exact SHA:

`b9083f12786f93405ea660c4775ac4035d2883d9`

Workflow/run:

- 420Hz Web Qualification #194
- Run ID: `37813849208`
- HZ-GCA-3 Level 1 job: `113437276456`

Failure:

Discovery correctly required `authoritative:false`, but candidate normalization omitted that field from the normalized object. The development client deliberately revalidated the selected candidate during authorized submission and therefore rejected the internally normalized candidate as `UNSUPPORTED_CAPABILITY`.

Repair:

- preserved `authoritative:false` in the normalized candidate;
- retained the fail-closed requirement that discovery records claiming authority are rejected;
- weakened no assertion.

The repaired implementation SHA passed all required checks.

## CI/workflow diagnosis

During initial HZ-GCA-3 CI work, an attempted change detector in the feature-only `.github/workflows/420hz-gca.yml` was malformed by a workflow-editing defect.

It was repaired rather than treated as green.

Repository reality also showed that this GCA workflow is introduced only on the feature branch and is absent from current `main`, so PR-triggered exact-head runs could not be relied on as the completion gate.

The existing main-backed `.github/workflows/420hz-web.yml` was therefore expanded narrowly with an HZ-GCA-3-specific Level-1 job and the directly applicable paths/checks.

That active workflow produced the authoritative exact-head PASS recorded above.

No required check was substituted with a skipped or untriggered workflow.

## Security / adversarial result

Result: **PASS**

The qualified suite verifies negative boundaries for:

- wrong chain / wrong Compute graph;
- discovery records falsely claiming authority;
- no compatible capacity;
- price above maximum;
- missing Wallet authorization;
- duplicate submit/replay;
- provider/worker/resource assignment drift;
- accepted-price drift;
- negative/missing verification;
- cancellation authorization;
- distinct refund/settlement references;
- provider-neutral output validation.

Existing 420AI provider runtime qualification additionally retained:

- private-payload commitment isolation;
- provider/resource/deadline checks;
- signed execution/receipt integrity;
- bounded retries;
- restart/recovery;
- idempotent receipt submission;
- non-authoritative runtime health.

## Level 2 status

**Not required / not run.**

HZ-GCA-3 is an ordinary app-scoped integration step.

It materially consumes existing 420AI/Compute surfaces, so those directly affected shared compatibility checks were retained at Level 1.

It did not modify shared Compute/AI contracts/services or create a documented accumulated milestone requiring broader Level-2 app qualification.

## Intentionally deferred Level 3

Deferred to **HZ-GCA-17**:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Geth/global fault/soak where applicable;
- final Docs/global reconciliation;
- complete app/service/client/Indexer/Search/RPC qualification;
- comprehensive security/static/deployment/config closeout.

Solidity Contracts remains the owner of the complete repository Foundry inventory; Genesis/address authority must not duplicate it.

## Limitations

HZ-GCA-3 intentionally does not claim:

- live production ComputeMarket deployment;
- live Registry-resolved endpoints/deployed addresses;
- production GPU/provider availability;
- a real funded production/testnet job;
- live Vault escrow/settlement/refund transaction;
- production model execution;
- testnet qualification;
- production publication.

The deterministic adapter is repository/local qualification infrastructure only.

## Exit criteria verification

- 420AI job adapter for music-generation workload: **PASS**
- Compute worker/provider capability discovery: **PASS**
- capacity-aware selection: **PASS**
- quote / funding / accepted-match / settlement reference integration: **PASS**
- idempotent submit/retry/cancel: **PASS**
- result commitment / verification hooks: **PASS**
- timeout/failure/refund behavior: **PASS**
- reputation/SLA non-authoritative: **PASS**
- deterministic non-production development adapter: **PASS**
- same HZ-GCA-2 lifecycle end to end: **PASS**
- future provider/model abstraction preserves publication semantics: **PASS**
- exact-head Level-1 qualification: **PASS**
- required skipped/cancelled/missing checks: **NONE**

## Blockers

None.

## Completion state

**HZ-GCA-3 — COMPLETE (Level 1).**

Next canonical roadmap step:

**HZ-GCA-4 — Provenance, consent and AI rights metadata**
