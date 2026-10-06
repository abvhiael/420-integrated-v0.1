# PB-2.3 — Age-verification interface

## Purpose
Define the PuffBuddies-side age-verification consumer interface that bridges an approved 420Identity verifier/adapter into PB-2.1 minimum-disclosure eligibility and PB-2.2 state handling without inventing a conflicting direct Identity420 RPC/API contract.

## Canonical requirements
1. Define a request containing only private PuffBuddies profile binding, current policy version, a strong request nonce and request time.
2. Define a minimum-disclosure response containing only profile binding, policy binding, nonce echo, trusted source/source version, ELIGIBLE/INELIGIBLE/UNKNOWN conclusion, verification time, bounded expiry and revocation state.
3. Accept only the canonical 420Identity authority (or later explicitly approved successor through canonical architecture change).
4. Reject subject-binding mismatch, policy-binding mismatch, nonce/replay mismatch, untrusted source and missing source version.
5. Reject responses predating the request, future responses and responses older than the configured freshness bound.
6. Require a bounded expiry for ELIGIBLE/INELIGIBLE conclusions; UNKNOWN remains fail-closed and does not require fabricated expiry.
7. Convert validated responses through the existing PB-2.1 AdultEligibilityAssertion/EligibilityProjection boundary rather than bypassing it.
8. Preserve PB-2.2 policy/current-state handling; the interface cannot create lifecycle, relationship, consent, visibility or safety authority.
9. Exclude DOB, legal name, government ID/document images, wallet/profile linkage, claim hashes, biometric data, exact address and precise location from the PuffBuddies verification contract.
10. Do not encode or claim a direct production Identity420 method shape while repository Identity interface/deployment compatibility remains separately qualified.
11. Introduce no live provider/RPC adapter, credential selector, fixed address/service ID, deployment, public membership/eligibility registry or testnet readiness claim.

## Affected components
- `puffbuddies/domain/age_verification.py`
- `puffbuddies/tests/test_pb_2_3_age_verification_interface.py`
- `.github/workflows/puffbuddies-pb2.yml`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- this canonical definition and later qualification evidence

## Qualification
**Level 1 — ordinary roadmap-step fast qualification.**

PB-2.3 is not Level 2 milestone A. It defines an app-side boundary only; no shared/live dependency is introduced.

## Dependencies
PB-0.6 adult eligibility policy; canonical 420Identity architecture; PB-2.1 COMPLETE; PB-2.2 COMPLETE.

## Exit criteria
Request/response interface compiles; trusted source/subject/policy/nonce/time/freshness/expiry/revocation checks pass; UNKNOWN fails closed; raw identity and wallet-link fields are absent; validated results reuse PB-2.1/PB-2.2 authority rather than bypassing it; retained PuffBuddies regressions pass; exact-head PB-2 fast qualification passes; durable Level-1 evidence is recorded.
