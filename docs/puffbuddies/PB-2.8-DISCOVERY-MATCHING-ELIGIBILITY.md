# PB-2.8 — Discovery/matching eligibility enforcement

## Purpose
Enforce current adult eligibility as a hard prerequisite for PuffBuddies discovery and matching actions, using the PB-2.7 authorization binding and PB-1.9 derived-state invalidation boundary.

PB-2.8 does **not** implement the PB-3 matching engine, ranking/recommendation generation, like/pass persistence, reciprocal-match creation, or messaging. It defines the eligibility gate those later components must consume.

## Canonical requirements
1. Both the requesting/viewing subject and candidate/target must have current effective ELIGIBLE state before ordinary discovery or matching action can proceed.
2. Both sides must remain in ordinary ACTIVE lifecycle state and not be blocked under the relevant authorization context.
3. Candidate DISCOVERABLE visibility is necessary but cannot override viewer or candidate ineligibility/lifecycle/block hard exclusions.
4. Discovery ranking/recommendation output is never authority and must occur only after hard eligibility exclusions.
5. Matching-action eligibility requires both sides to satisfy current ordinary eligibility/lifecycle/safety preconditions.
6. Eligibility gating must not manufacture reciprocal consent, relationship state, a match, or messaging authority.
7. Discovery must require current PB-1.9 DISCOVERY derived-generation authority for both sides.
8. Matching actions must require current PB-1.9 MATCHING derived-generation authority for both sides.
9. A revocation/expiry generation change on either side makes stale discovery/matching derived state unusable immediately.
10. UNKNOWN, EXPIRED, REVOKED, INELIGIBLE, deactivated/suspended/banned/deletion states and blocks fail closed for ordinary discovery/matching as applicable.
11. No payment, premium, token, algorithm, admin or ranking state may bypass the hard eligibility gate.
12. Persist no new raw identity/proof/profile payload in the enforcement boundary.
13. Introduce no matching engine, recommendation engine, public people-search surface, API, contract, fixed address/service ID, deployment or live service claim.
14. Do not pre-empt PB-2.9 messaging eligibility enforcement.

## Affected components
- `puffbuddies/domain/discovery_matching_eligibility.py`
- `puffbuddies/tests/test_pb_2_8_discovery_matching_eligibility.py`
- `.github/workflows/puffbuddies-pb2.yml`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- this canonical definition and qualification evidence

## Qualification
**Level 1 — ordinary roadmap-step fast qualification.**

PB-2.8 is not Level 2. **PB-2.13 — PB-2 Integration Milestone** remains Level 2 and **PB-2.14 — PB-2 Phase Closeout** remains Level 3.

## Dependencies
PB-0.5 consent invariants; PB-0.6 eligibility policy; PB-0.12 lifecycle; PB-0.13 matching principles; PB-1.5 authorization; PB-1.9 derived invalidation; PB-2.1 through PB-2.7 COMPLETE.

## Exit criteria
Discovery rejects either-side ineligibility/lifecycle/block failures; matching action rejects either-side ineligibility/lifecycle failures; current eligibility plus current derived generations passes the gate; stale discovery/matching generation on either side fails; gating cannot create reciprocal consent/match state; retained PuffBuddies regressions pass; exact-head PB-2 fast qualification passes; durable Level-1 evidence is recorded.
