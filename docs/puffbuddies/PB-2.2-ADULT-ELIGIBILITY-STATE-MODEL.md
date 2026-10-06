# PB-2.2 — Adult eligibility state model

## Purpose
Implement the canonical private PuffBuddies adult-eligibility state model over time, building on PB-2.1's minimum-disclosure 420Identity boundary and PB-0.6's expiry, revocation, staleness, reverification and policy-version requirements.

## Canonical requirements
1. Start eligibility at UNKNOWN; UNKNOWN fails closed for ordinary participation.
2. Model current ELIGIBLE, INELIGIBLE, EXPIRED and REVOKED conclusions without storing raw identity evidence.
3. Bind every accepted authoritative decision to a nonempty source version, current PuffBuddies policy version, monotonic decision sequence and checked time.
4. Reject stale/replayed decisions and time rollback.
5. Expire ELIGIBLE authority at its expiry boundary; missing expiry cannot create ordinary eligibility.
6. Provider/authority unavailability resolves to UNKNOWN, never fail-open ELIGIBLE.
7. A policy-version change makes prior eligibility UNKNOWN until fresh compatible authoritative reevaluation.
8. Reverification may restore ELIGIBLE after EXPIRED/REVOKED/UNKNOWN only through a fresh higher-sequence authoritative conclusion.
9. INELIGIBLE/EXPIRED/REVOKED/UNKNOWN cannot authorize ordinary participation.
10. ELIGIBLE remains necessary but not sufficient: lifecycle/safety/consent restrictions retain authority.
11. Eligibility changes retain PB-1.9 all-derived invalidation semantics so stale discovery/matching/messaging/cache/index/analytics authority cannot survive.
12. Introduce no jurisdiction database, production identity provider/RPC adapter, raw identity persistence, public eligibility registry, fixed address/service ID, deployment or live dependency.

## Affected components
- `puffbuddies/domain/eligibility_state.py`
- `puffbuddies/tests/test_pb_2_2_adult_eligibility_state.py`
- `.github/workflows/puffbuddies-pb2.yml`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- this canonical definition and later qualification evidence

## Qualification
**Level 1 — ordinary roadmap-step fast qualification.**

PB-2.2 is not Level 2 milestone A. No shared dependency implementation is introduced; retained app integration remains deferred to the documented accumulated PB-1/PB-2 account/profile/private-state milestone.

## Dependencies
PB-0.6 adult eligibility policy; PB-1 eligibility projection, authorization and invalidation; PB-2.1 identity/minimum-disclosure boundary.

## Exit criteria
UNKNOWN fail-closed behavior passes; authoritative eligible/ineligible transitions pass; expiry/revocation/provider-failure/policy-change semantics pass; stale replay/time rollback fail; reverification requires fresh sequence; eligibility invalidates all derived authority; ELIGIBLE cannot override lifecycle restrictions; retained PuffBuddies regressions pass; exact-head PB-2 fast qualification passes; durable Level-1 evidence is recorded.
