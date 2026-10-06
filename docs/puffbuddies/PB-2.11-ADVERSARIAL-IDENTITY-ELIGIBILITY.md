# PB-2.11 — Adversarial identity/eligibility qualification

## Purpose
Qualify the accumulated PB-2.1 through PB-2.10 identity/eligibility boundary against the canonical PB-0.6/PB-0.7 adversarial classes as one cross-step attack surface.

PB-2.11 is an adversarial **Level 1 roadmap step**, not the PB-2.13 Level-2 integration milestone and not PB-2.14 Level-3 phase closeout.

## Canonical adversarial requirements
1. Self-asserted age or an untrusted authority cannot create adult eligibility.
2. Another subject's verification or proof cannot be replayed onto the current profile.
3. Verification/proof nonce replay, audience mismatch, predicate mismatch and policy mismatch fail closed.
4. Stale/future/expired verification or proof material cannot create current eligibility.
5. Untrusted verifier/source or missing authoritative source version fails closed.
6. Stale sequence/time ordering cannot overwrite a newer eligibility decision.
7. Policy-version drift forces reevaluation/UNKNOWN rather than preserving stale ELIGIBLE.
8. Authority/provider unavailability results in UNKNOWN rather than fail-open eligibility.
9. Revocation after prior active eligibility invalidates stale downstream derived authority.
10. Expired/revoked/policy-stale state cannot be rebound as current ELIGIBLE authorization.
11. Payment, premium, token, moderator/admin, Messenger-native state or recommendation state cannot manufacture eligibility/consent.
12. Block/unmatch/lifecycle restrictions outrank otherwise-valid eligibility.
13. Discovery, matching and messaging cannot continue from stale derived-generation authority.
14. Privacy hardening prevents eligibility/policy/relationship state from becoming an oracle through reason codes, public probes or external payloads.
15. Raw DOB, identity/proof payloads and wallet/profile linkage remain outside ordinary PuffBuddies authorization surfaces.
16. Adversarial qualification must preserve prior PB-2 semantics rather than weaken checks merely to pass CI.

## Affected components
- `puffbuddies/tests/test_pb_2_11_adversarial_identity_eligibility.py`
- `.github/workflows/puffbuddies-pb2.yml`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- this canonical definition and qualification evidence

No production domain implementation change is required unless this accumulated adversarial suite exposes a genuine protocol gap.

## Qualification
**Level 1 — adversarial roadmap-step fast qualification.**

PB-2.11 does not trigger Level 2. **PB-2.13 — PB-2 Integration Milestone** remains the documented Level-2 boundary. **PB-2.14 — PB-2 Phase Closeout** remains Level 3.

## Dependencies
PB-0.4 privacy invariants; PB-0.5 consent; PB-0.6 adult eligibility policy; PB-0.7 threat/trust model; PB-1.9 invalidation; PB-1.10 privacy hardening; PB-2.1 through PB-2.10 COMPLETE.

## Exit criteria
The accumulated adversarial suite passes for cross-subject/replay/source/policy/freshness/revocation/outage/economic/admin/consent/stale-derived/privacy-oracle cases; retained PB-2 and PuffBuddies regressions remain green; exact-head PB-2 fast qualification passes; durable Level-1 evidence records the attack classes and result.
