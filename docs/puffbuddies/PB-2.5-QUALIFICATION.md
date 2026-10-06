# PB-2.5 qualification evidence

## Step
**PB-2.5 — Eligibility persistence & lifecycle — COMPLETE**

## Qualification level
**Level 1 — ordinary roadmap-step fast qualification**

## Qualified implementation SHA
`c5116933e1918b38f18b97e31dd6cd41831a9e31`

## Repository relationship
- branch: `puffbuddies-pb2-eligibility-20261006`
- PR: #538
- current main / PR base: `23ebff000a471bfbc4439894f797f3b17a530867`
- PR was mergeable when qualification was inspected

## Implementation summary
PB-2.5 extends the existing private `eligibility_projection` schema so the PB-2.2 eligibility record's monotonic sequence and checked-time are durably persisted. A storage-neutral persistence boundary round-trips the minimum-disclosure eligibility state, preserves optimistic repository concurrency, rejects stale sequence/time updates after reload, validates exact canonical schema and subject binding on decode, and requires current policy compatibility. No raw identity or raw proof evidence is persisted.

## Files changed
- `puffbuddies/persistence/schema.py`
- `puffbuddies/domain/eligibility_persistence.py`
- `puffbuddies/tests/test_pb_2_5_eligibility_persistence_lifecycle.py`
- `docs/puffbuddies/PB-2.5-ELIGIBILITY-PERSISTENCE-LIFECYCLE.md`
- `.github/workflows/puffbuddies-pb2.yml`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`

## Requirements satisfied
- eligibility state persists in the canonical private eligibility projection;
- profile, decision, source version, policy version, expiry, sequence and checked time are preserved;
- sequence replay protection survives repository reload;
- checked-time ordering survives repository reload;
- optimistic repository concurrency remains authoritative;
- wrong table, subject mismatch, malformed or non-exact schema state fails closed;
- UNKNOWN remains fail-closed and carries no expiry authority;
- ELIGIBLE requires bounded expiry after checked time;
- persisted policy version must remain current or be reevaluated;
- raw DOB, legal identity, government ID/document, wallet linkage, biometrics, exact address/location, claim hash, raw identity evidence, raw proof bytes and credential payload remain outside persistence;
- no production database/API/worker/public registry/fixed address/service ID/deployment/live provider claim is introduced;
- PB-2.6 revocation and expiry event handling is not pre-empted.

## Exact-SHA Level 1 CI evidence
**PuffBuddies PB-2 Qualification**
- run: `37508259287` — **SUCCESS**
- job: `112422362760` (`pb2-fast`) — **SUCCESS**
- exact qualification head — PASS
- PuffBuddies compile — PASS
- PB-2.1 retained identity/eligibility boundaries — PASS
- PB-2.2 retained adult eligibility state model — PASS
- PB-2.3 retained age-verification interface — PASS
- PB-2.4 retained privacy-preserving eligibility proofs — PASS
- PB-2.5 targeted eligibility persistence lifecycle — PASS
- retained PuffBuddies regression inventory — PASS
- identity privacy/public-chain negative gate — PASS

## Security / adversarial / boundary results
PASS for stale sequence replay, checked-time rollback, stale optimistic version, subject mismatch, malformed persisted row, policy mismatch, UNKNOWN expiry misuse, ELIGIBLE invalid expiry, forbidden evidence fields and minimum-disclosure schema preservation.

## Milestone status
PB-2.5 is **not** Level 2. **PB-2.13 — PB-2 Integration Milestone** remains the Level-2 boundary. **PB-2.14 — PB-2 Phase Closeout** remains Level 3.

## Intentionally deferred Level 3 checks
Canonical full Solidity inventory, Genesis/address-authority qualification, 420 Integrated/global qualification, Geth/fault/soak, repository-wide Docs/global reconciliation, unrelated app suites, deployment/configuration verification and live/testnet qualification remain deferred to PB-2.14.

## Limitations / blockers
No blocker for PB-2.5. The storage adapter remains intentionally in-memory/non-production. PB-2.6 owns dedicated revocation/expiry event handling and downstream consequences.

## Evidence inheritance
This qualification document and roadmap COMPLETE marker are evidence-only bookkeeping after exact-head Level-1 qualification passed. They do not modify executable source, tests, workflows, dependencies, configuration, interfaces, deployment state or substantive requirements, so they inherit the qualified implementation SHA without recursive qualification.

## Completion state
**COMPLETE** against exact Level-1 implementation SHA `c5116933e1918b38f18b97e31dd6cd41831a9e31`.

## Next canonical roadmap step
**PB-2.6 — Revocation & expiry handling**
