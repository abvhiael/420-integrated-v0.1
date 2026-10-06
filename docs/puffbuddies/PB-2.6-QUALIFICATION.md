# PB-2.6 qualification evidence

## Step
**PB-2.6 — Revocation & expiry handling — COMPLETE**

## Qualification level
**Level 1 — ordinary roadmap-step fast qualification**

## Qualified implementation SHA
`a2736d2a397755e91c2d759a8a90ef1f82c562d5`

## Repository relationship
- branch: `puffbuddies-pb2-eligibility-20261006`
- PR: #538
- current main / PR base: `23ebff000a471bfbc4439894f797f3b17a530867`
- PR was mergeable when qualification was inspected

## Implementation summary
PB-2.6 implements source-bound eligibility revocation and bounded-expiry transitions over the PB-2.2/PB-2.5 private eligibility record. Each real revocation/expiry advances the eligibility sequence/time, advances the existing PB revocation generation, invalidates every PB-1.9 derived surface, and persists the resulting REVOKED/EXPIRED state through PB-2.5 optimistic concurrency. It does not yet grant or deny concrete application actions; PB-2.7 owns authorization integration.

## Files changed
- `puffbuddies/domain/eligibility_revocation.py`
- `puffbuddies/tests/test_pb_2_6_revocation_expiry_handling.py`
- `docs/puffbuddies/PB-2.6-REVOCATION-EXPIRY-HANDLING.md`
- `.github/workflows/puffbuddies-pb2.yml`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`

## Requirements satisfied
- authoritative revocation is bound to the currently stored source version;
- revocation requires an advancing sequence and nondecreasing event time;
- stale/replayed sequence, stale source version, time rollback and UNKNOWN revocation fail closed;
- valid revocation transitions current eligibility to REVOKED;
- expiry applies only to current ELIGIBLE state with bounded expiry;
- no expiry occurs before the bound;
- at/after expiry, sequence/time advance and state becomes EXPIRED;
- EXPIRED, REVOKED, INELIGIBLE and UNKNOWN are not repeatedly re-expired;
- every real eligibility revocation/expiry advances the PB revocation generation;
- every real eligibility revocation/expiry emits canonical ELIGIBILITY invalidation over all PB-1.9 derived surfaces;
- stale pre-event derived generation immediately ceases to be current;
- resulting REVOKED/EXPIRED eligibility state persists and reloads through PB-2.5;
- no raw identity/proof/public-membership state is introduced;
- no production poller/webhook/provider adapter/database/public registry/fixed address/service ID/deployment/live feed is claimed;
- PB-2.7/2.8/2.9 enforcement scope is not pre-empted.

## Exact-SHA Level 1 CI evidence
**PuffBuddies PB-2 Qualification**
- run: `37510105067` — **SUCCESS**
- job: `112428727134` (`pb2-fast`) — **SUCCESS**
- exact qualification head — PASS
- PuffBuddies compile — PASS
- PB-2.1 retained identity/eligibility boundaries — PASS
- PB-2.2 retained adult eligibility state model — PASS
- PB-2.3 retained age-verification interface — PASS
- PB-2.4 retained privacy-preserving eligibility proofs — PASS
- PB-2.5 retained eligibility persistence/lifecycle — PASS
- PB-2.6 targeted revocation & expiry handling — PASS
- retained PuffBuddies regression inventory — PASS
- identity privacy/public-chain negative gate — PASS

## Security / adversarial / invariant results
PASS for stale revocation sequence, stale source version, revocation time rollback, UNKNOWN revocation, pre-expiry no-op, expiry at boundary, missing expiry on ELIGIBLE, repeated expiry suppression, derived-generation invalidation and durable persistence/reload of REVOKED state.

## Milestone status
PB-2.6 is **not** Level 2. **PB-2.13 — PB-2 Integration Milestone** remains the Level-2 boundary. **PB-2.14 — PB-2 Phase Closeout** remains Level 3.

## Intentionally deferred Level 3 checks
Canonical full Solidity inventory, Genesis/address-authority qualification, 420 Integrated/global qualification, Geth/fault/soak, repository-wide Docs/global reconciliation, unrelated app suites, deployment/configuration verification and live/testnet revocation-provider qualification remain deferred to PB-2.14.

## Limitations / blockers
No blocker for PB-2.6. There is no production revocation callback/poller/provider feed in this step. Concrete application-action authorization is intentionally deferred to PB-2.7.

## Evidence inheritance
This qualification document and roadmap COMPLETE marker are evidence-only bookkeeping after exact-head Level-1 qualification passed. They modify no executable source, tests, workflows, dependencies, configuration, interfaces, deployment state or substantive requirements, so they inherit the qualified implementation SHA without recursive qualification.

## Completion state
**COMPLETE** against exact Level-1 implementation SHA `a2736d2a397755e91c2d759a8a90ef1f82c562d5`.

## Next canonical roadmap step
**PB-2.7 — Authorization integration**
