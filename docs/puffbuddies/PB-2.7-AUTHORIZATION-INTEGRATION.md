# PB-2.7 — Authorization integration

## Purpose
Bind the canonical current PB-2 eligibility record into the existing PB-1.5 server-side authorization primitives so protected PuffBuddies authorization cannot be satisfied by an injected/stale bare ELIGIBLE flag.

PB-2.7 is generic eligibility-to-authorization integration. PB-2.8 owns discovery/matching-specific eligibility enforcement and PB-2.9 owns messaging-specific eligibility enforcement.

## Canonical requirements
1. Authorization must consume the full current EligibilityRecord, not trust a caller-supplied bare eligibility enum.
2. Require exact profile/subject binding between the eligibility record, requested profile, and AuthorizationContext subject.
3. Require a nonempty current policy version.
4. If the record policy version differs from current policy, effective authorization eligibility becomes UNKNOWN and fails closed.
5. If authorization time predates the record's checked time, reject the authorization binding as inconsistent.
6. Only a current ELIGIBLE record whose bounded expiry remains in the future may become effective ELIGIBLE authorization state.
7. Expired ELIGIBLE becomes effective EXPIRED; REVOKED, INELIGIBLE and UNKNOWN remain noneligible.
8. Feed only the effective eligibility state into existing PB-1.5 authorization primitives; do not duplicate or bypass lifecycle, relationship, block/safety, moderator, service, visibility or consent authority.
9. Lifecycle, block/safety and relationship denials continue to override otherwise-current eligibility.
10. Do not broaden moderator or service authority merely because the subject is eligible.
11. Retain minimum auditable binding metadata (record sequence, policy version, checked time) without adding raw identity/proof evidence.
12. Introduce no transport/session API, public registry, contract, fixed address/service ID, deployment, or live provider claim.
13. Do not pre-empt PB-2.8 discovery/matching-specific or PB-2.9 messaging-specific enforcement.

## Affected components
- `puffbuddies/domain/eligibility_authorization.py`
- `puffbuddies/tests/test_pb_2_7_authorization_integration.py`
- `.github/workflows/puffbuddies-pb2.yml`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- this canonical definition and qualification evidence

## Qualification
**Level 1 — ordinary roadmap-step fast qualification.**

PB-2.7 is not Level 2. **PB-2.13 — PB-2 Integration Milestone** remains Level 2 and **PB-2.14 — PB-2 Phase Closeout** remains Level 3.

## Dependencies
PB-0.6 eligibility policy; PB-0.12 lifecycle authority; PB-1.5 authorization primitives; PB-2.1 through PB-2.6 COMPLETE.

## Exit criteria
Current/policy-compatible/unexpired eligibility enables existing ordinary authorization where all other PB-1.5 conditions permit; expired/revoked/ineligible/unknown/policy-stale eligibility fails closed; subject/time mismatches reject binding; lifecycle/block/relationship/service/moderator boundaries remain intact; retained PuffBuddies regressions pass; exact-head PB-2 fast qualification passes; durable Level-1 evidence is recorded.
