# PB-2.6 — Revocation & expiry handling

## Purpose
Implement canonical adult-eligibility revocation and expiry transitions over the PB-2.2/PB-2.5 private eligibility record, and connect those transitions to the existing PB-1.8/PB-1.9 stale-derived-state invalidation boundary.

PB-2.6 handles loss of eligibility authority. It does not yet authorize or deny concrete product actions; PB-2.7 owns authorization integration.

## Canonical requirements
1. Accept an authoritative revocation only when it is bound to the currently stored identity/source version.
2. Revocation events must advance the eligibility sequence and must not move checked/event time backwards.
3. Reject stale/replayed revocation sequence, stale source-version revocation, time rollback, and attempts to fabricate a revocation from UNKNOWN.
4. Transition a valid current eligibility record to REVOKED while preserving private profile, policy, source and existing expiry metadata needed for audit/state reconstruction.
5. Detect expiry only for currently ELIGIBLE state with a bounded expiry.
6. Do not expire before the bound; at or after expiry, advance sequence/time and transition to EXPIRED.
7. Do not repeatedly re-expire EXPIRED, REVOKED, INELIGIBLE or UNKNOWN records.
8. Every actual eligibility revocation/expiry is a canonical ELIGIBILITY change and must advance the existing PB revocation generation/invalidate every PB-1.9 derived surface.
9. A stale derived token from before revocation/expiry must immediately cease to be current.
10. Persist the resulting REVOKED/EXPIRED record through PB-2.5 optimistic-concurrency persistence so the loss of authority survives reload/restart.
11. Preserve minimum disclosure: no raw DOB, identity documents, wallet linkage, claim/proof payload, exact address/location or public membership state is added.
12. Introduce no production polling worker, callback/webhook contract, provider adapter, database, public registry, fixed address/service ID, deployment or live revocation feed claim.
13. Do not pre-empt PB-2.7 authorization integration, PB-2.8 discovery/matching enforcement, or PB-2.9 messaging enforcement.

## Affected components
- `puffbuddies/domain/eligibility_revocation.py`
- `puffbuddies/tests/test_pb_2_6_revocation_expiry_handling.py`
- `.github/workflows/puffbuddies-pb2.yml`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- this canonical definition and qualification evidence

## Qualification
**Level 1 — ordinary roadmap-step fast qualification.**

PB-2.6 is not Level 2. **PB-2.13 — PB-2 Integration Milestone** remains Level 2 and **PB-2.14 — PB-2 Phase Closeout** remains Level 3.

## Dependencies
PB-0.6 eligibility expiry/revocation policy; PB-0.12 eligibility-loss lifecycle semantics; PB-1.8 revocation generation; PB-1.9 derived-state invalidation; PB-2.1 through PB-2.5 COMPLETE.

## Exit criteria
Current-source revocation advances to REVOKED; expiry-at-bound advances to EXPIRED; stale source/sequence/time events fail closed; pre-expiry/noneligible states do not spuriously expire; every actual revocation/expiry invalidates all derived surfaces and advances generation; resulting state persists/reloads through PB-2.5; retained PuffBuddies regressions pass; exact-head PB-2 fast qualification passes; durable Level-1 evidence is recorded.
