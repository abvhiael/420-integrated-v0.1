# PB-2.12 — Failure & recovery qualification

## Purpose
Qualify accumulated PB-2 eligibility state under storage/dependency failure, stale/conflicting replica state, restore/rollback, optimistic concurrency and recovery scenarios while preserving fail-closed authorization, revocation and privacy semantics.

PB-2.12 composes the already-qualified PB-1.12 recovery primitives with PB-2.5 persistence, PB-2.6 revocation/invalidation, PB-2.7 authorization and PB-2.10 privacy. It does not invent a production database, distributed transaction protocol, backup service or live recovery topology.

## Canonical requirements
1. Authoritative eligibility-store unavailability fails closed; missing/unreachable persistence cannot be treated as ELIGIBLE.
2. A stale replica containing older ELIGIBLE state must not replace a newer authoritative revoked/expired/changed decision.
3. Same-version conflicting replicas must be rejected.
4. A restore snapshot predating the current eligibility-revocation generation must be rejected.
5. Current-generation restore validation must still reject conflicting duplicate records.
6. Optimistic concurrency must prevent stale writers from overwriting a newer eligibility decision.
7. Partial storage/derived-operation failure must not be reported or published as successful derived authorization.
8. The nontransactional in-memory qualification adapter must not be falsely represented as providing transactional rollback.
9. Rollback planning must use a complete known-good before-image rather than a partial after-image.
10. Restored/recovered records remain subject to current policy, expiry and authorization checks; recovery never makes stale state authoritative merely because it was restored.
11. Recovery/restore paths must not introduce raw DOB, identity evidence, proof bytes, credential payloads or wallet/profile linkage into eligibility persistence.
12. Recovery metadata must preserve PB-2.10 privacy and must not become a public/derived eligibility oracle.
13. Deletion-complete and later-generation revocation semantics from PB-1.12/PB-2.6 remain supreme over restore.
14. Recovery qualification must preserve replay/sequence/time monotonicity and never broaden authorization after failure.
15. Introduce no production database choice, backup provider, replication protocol, contract, fixed address/service ID, deployment or live recovery claim.

## Affected components
- `puffbuddies/tests/test_pb_2_12_failure_recovery.py`
- `.github/workflows/puffbuddies-pb2.yml`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- this canonical definition and qualification evidence

No production domain implementation change is required unless this qualification exposes a genuine PB-2 recovery defect.

## Qualification
**Level 1 — failure/recovery roadmap-step fast qualification.**

PB-2.12 is not Level 2. **PB-2.13 — PB-2 Integration Milestone** remains the documented Level-2 boundary. **PB-2.14 — PB-2 Phase Closeout** remains Level 3.

## Dependencies
PB-0.6 eligibility; PB-0.7 threat model; PB-0.11 lifecycle/deletion; PB-1.9 invalidation; PB-1.12 failure/recovery; PB-2.5 through PB-2.11 COMPLETE.

## Exit criteria
Authoritative outage fails closed; stale/conflicting replicas and stale restores are rejected; optimistic concurrency protects newer eligibility state; partial failure is not publishable success; rollback uses known-good state; recovered records remain policy/expiry constrained; raw identity/proof and privacy leakage remain rejected; retained PB-2/PuffBuddies regressions pass; exact-head PB-2 fast qualification passes; durable Level-1 evidence is recorded.
