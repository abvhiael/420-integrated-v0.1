# HZ-GCA-3 — 420AI / Compute Market execution adapter

Status: **COMPLETE — Level 1 exact-head qualified**

Canonical roadmap step:

**HZ-GCA-3 — 420AI / Compute Market execution adapter**

Machine-readable contract:

`hz/config/gca-compute-execution-adapter-v1.json`

Implementation:

`hz/generate/src/compute-adapter.js`

HZ-GCA-3 routes the provider-neutral HZ-GCA-2 generation lifecycle through a canonical Compute-facing execution boundary without making 420Hz, a worker/provider projection, or the development adapter a protocol authority.

## Execution boundary

`ComputeMarketGenerationProvider420` implements the same `GenerationProvider420` interface introduced by HZ-GCA-2.

That means the same application lifecycle is retained:

`DRAFT → QUOTED → SUBMITTED → RUNNING → SUCCEEDED`

with FAILED/CANCELLED exceptional terminals.

Future first-party or third-party provider/model implementations can replace the backing Compute client without changing 420Hz publication semantics.

## Canonical environment

Before discovery or execution, the adapter verifies:

- chain ID;
- Compute component graph hash.

Wrong-chain or wrong-graph operation fails closed before workload execution.

## Worker/provider discovery

The Compute client supplies worker/provider candidates as **non-authoritative projections**.

Each candidate binds:

- Compute provider ID;
- worker ID;
- resource ID;
- model ID/version;
- supported modes;
- duration limit;
- lyrics/reference-audio support;
- output kinds;
- available capacity;
- queue depth / estimated start;
- quoted price / asset;
- optional reputation/SLA signals;
- finality context.

A candidate claiming `authoritative:true` is rejected.

## Capacity-aware selection

Eligibility is checked before ranking.

A candidate must satisfy:

- exact model ID/version;
- requested vocal/instrumental mode;
- requested duration;
- lyrics capability when needed;
- approved reference-audio path when needed;
- capacity > 0;
- configured price ceiling when one exists.

Eligible candidates are then sorted by:

1. lowest quoted price;
2. highest available capacity;
3. highest reputation;
4. highest SLA;
5. stable provider/resource identity.

Reputation and SLA are explicitly **non-authoritative selection signals**. They never bypass authorization, verification, price ceilings, capacity or canonical Compute state.

## Quote and economic binding

The HZ-GCA-2 quote remains provider-neutral while binding:

- selected provider/worker/resource;
- model/version;
- request digest;
- price;
- asset;
- capacity;
- expiry.

On submit, the adapter verifies that accepted:

- provider;
- worker;
- resource;
- price

still match the selected quote.

The accepted Compute binding retains separate:

- compute request ID;
- compute job ID;
- accepted match ref;
- funding ref;
- accepted price.

Funding and matching are not treated as settlement.

## Wallet authorization

The Compute client prepares an unsigned plan.

Before submission/cancellation, the adapter requires that plan to state:

- `requiresWalletAuthorization: true`
- `canonicalAuthority: false`
- `secretMaterialManaged: false`

The adapter invokes the supplied authorization callback and refuses submission if no authorization reference is produced.

420Hz does not sign or hold Wallet private material.

## Idempotency

HZ-GCA-2's deterministic submit identity is passed into the Compute client.

Repeated submit of the same logical operation must reconcile to the same Compute job.

The deterministic development client proves that behavior locally.

## Result and verification

Compute lifecycle states map to the HZ-GCA-2 lifecycle.

RUNNING-like canonical states include:

- CREATED
- FUNDED
- MATCHED
- ACCEPTED
- RUNNING
- RESULT_COMMITTED
- DISPUTED

Application success is accepted only from:

- VERIFIED
- SETTLED

and additionally requires:

- `verificationVerdict == PASS`;
- verification reference;
- result commitment;
- valid provider-neutral output manifest.

Provider/worker/resource/accepted-price drift fails closed.

A provider result cannot become SUCCEEDED from prose or an unverified manifest.

## Settlement and refunds

The adapter preserves separate references for:

- funding;
- accepted match;
- verification;
- entitlement;
- settlement;
- refund.

A refund reference is observable state only. It is not represented as paid/refunded cash unless the canonical economic source says so.

Cancellation uses an independently authorized cancellation plan and requires canonical cancellation confirmation.

## Development adapter

`DeterministicDevelopmentComputeClient420` is repository/local qualification infrastructure only.

It uses the same provider abstraction and GenerationJobManager lifecycle that a real Compute-backed client uses.

It deterministically produces:

- funding ref;
- accepted match ref;
- result commitment;
- positive verification ref;
- entitlement ref;
- settlement ref;
- refund ref for cancellation.

It is not production or testnet evidence.

## Shared 420AI / Compute consistency

HZ-GCA-3 consumes the existing repository authority model rather than redefining it.

Directly affected shared checks retain:

- `AIComputeAdapter420` binding semantics;
- canonical Compute graph / request / match / verification boundaries;
- 420AI provider runtime behavior;
- non-authoritative projection discipline.

No Solidity contract or shared Compute protocol implementation is changed by HZ-GCA-3.

## Tests

`hz/generate/test/compute-adapter.test.js` covers:

- capacity-aware selection;
- price ceilings;
- reputation/SLA as non-authoritative tie breakers;
- rejection of authoritative discovery projections;
- complete end-to-end HZ-GCA-2 lifecycle;
- unsigned authorization-plan boundary;
- missing-authorization fail closed;
- idempotent canonical submit;
- assignment/accepted-price drift;
- positive verification requirement;
- authorized cancellation and refund observation;
- wrong chain/graph fail closed;
- separate funding/match/verification/entitlement/settlement state.

## Authority boundary

HZ-GCA-3 does not create:

- Wallet signing authority;
- provider custody;
- Compute matching authority;
- canonical settlement/refund authority;
- Rights/consent authority;
- Creative registration/publication authority;
- Charts/Awards/moderation/governance authority.

`VERIFIED` or `SETTLED` Compute execution does not imply REGISTERED or PUBLISHED 420Hz music.

## Qualification

HZ-GCA-3 is an ordinary **Level 1** implementation step.

It materially consumes existing 420AI/Compute surfaces, so the Level-1 gate includes directly affected shared compatibility checks, but it changes no shared Compute/AI contract/service implementation and therefore does not independently create a new Level-2 milestone.

## Exit criteria

HZ-GCA-3 is complete when:

- 420AI/Compute-backed generation provider adapter exists;
- worker/provider discovery is capacity-aware and non-authoritative;
- price/capacity quote and accepted-match bindings are validated;
- submit/retry/cancel is idempotent and authorization-gated;
- result commitment and positive verification gate SUCCEEDED;
- funding/settlement/refund states remain distinct;
- reputation/SLA remain selection-only;
- deterministic non-production adapter completes the same lifecycle used by real providers;
- future provider/model replacements do not alter publication semantics;
- exact-head Level-1 app/shared qualification passes with no required skipped/cancelled/missing checks.

Next canonical roadmap step:

**HZ-GCA-4 — Provenance, consent and AI rights metadata**


## Qualification result

Qualified implementation SHA:

`28a87b7fda4e9a719dfedc4999466fc5beb75922`

Authoritative step workflow:

- **420Hz Web Qualification**
- Run: **37813944369** (#195)
- Job: **HZ-GCA-3 Level 1**
- Job ID: **113437604323**
- Result: **PASS**

Exact-head required results:

- 420Hz generation module: **29 PASS / 0 FAIL / 0 SKIPPED**
- HZ-GCA-2 retained verifier: **PASS**
- HZ-GCA-3 targeted verifier: **PASS**
- canonical 420AI Compute integration verifier: **PASS**
- 420AI provider runtime: **14 PASS / 0 FAIL / 0 SKIPPED**
- 420AI provider runtime verifier: **PASS**
- Compute SDK: **28 PASS / 0 FAIL / 0 SKIPPED**
- Compute SDK build: **PASS**
- Compute API: **14 PASS / 0 FAIL / 0 SKIPPED**
- 420Hz web job: **PASS**

No Level-2 milestone was required for HZ-GCA-3 and no Level-3 repository-wide inventory was run.
