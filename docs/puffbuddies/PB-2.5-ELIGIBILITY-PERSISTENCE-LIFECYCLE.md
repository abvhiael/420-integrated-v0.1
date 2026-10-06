# PB-2.5 — Eligibility persistence & lifecycle

## Purpose
Persist the current canonical PB-2 adult-eligibility state privately and durably enough that sequence, time, policy, expiry and source authority survive repository reloads without persisting raw identity or proof evidence.

PB-2.5 owns persistence of the PB-2.2 eligibility state lifecycle. It does not replace PB-2.6 revocation/expiry handling, PB-2.7 authorization integration, or the canonical PuffBuddies account lifecycle state machine.

## Canonical requirements
1. Persist the minimum-disclosure PB-2.2 eligibility record in the existing private `eligibility_projection` canonical table.
2. Persist profile binding, decision, source version, policy version, bounded expiry where applicable, monotonic eligibility sequence, and checked time.
3. Preserve PB-2.2 replay resistance across process/repository reload by rejecting non-advancing sequences.
4. Preserve PB-2.2 temporal ordering by rejecting persisted updates whose checked time moves backwards.
5. Preserve optimistic repository concurrency; stale repository versions cannot overwrite newer eligibility state.
6. Decode persisted state fail-closed: wrong table, subject mismatch, missing/extra fields, malformed enum/integer data, or invalid state invariants are rejected.
7. UNKNOWN remains fail-closed and carries no expiry authority.
8. ELIGIBLE persistence requires a bounded future expiry relative to its checked time.
9. Persisted policy version is not permanent authority; consumers must require compatibility with current policy or reevaluate.
10. Persist no DOB, legal identity, government ID/document, wallet linkage, biometrics, exact address/location, claim hash, raw identity evidence, raw proof bytes, or credential payload.
11. Keep storage private/off-chain and storage-neutral; introduce no production database, API, worker, public registry, fixed address/service ID, deployment, or live provider claim.
12. Do not pre-empt PB-2.6: revocation/expiry event processing and downstream invalidation remain the next canonical step.

## Affected components
- `puffbuddies/persistence/schema.py`
- `puffbuddies/domain/eligibility_persistence.py`
- `puffbuddies/tests/test_pb_2_5_eligibility_persistence_lifecycle.py`
- `.github/workflows/puffbuddies-pb2.yml`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- this canonical definition and qualification evidence

## Qualification
**Level 1 — ordinary roadmap-step fast qualification.**

PB-2.5 is not Level 2. **PB-2.13 — PB-2 Integration Milestone** remains the Level-2 boundary; **PB-2.14 — PB-2 Phase Closeout** remains Level 3.

## Dependencies
PB-0.6 adult eligibility; PB-0.11/PB-0.12 private data and lifecycle rules; PB-1.3 private schema; PB-1.4 optimistic repository; PB-1.8 anti-resurrection foundations; PB-2.1 through PB-2.4 COMPLETE.

## Exit criteria
Eligibility state round-trips through canonical private persistence; sequence/time/policy/subject invariants survive reload; stale sequence/time/repository-version updates fail closed; UNKNOWN and ELIGIBLE persistence invariants pass; forbidden identity/proof material remains absent; retained PuffBuddies regressions pass; exact-head PB-2 fast qualification passes; durable Level-1 evidence is recorded.
