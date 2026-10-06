# PB-2.4 — Privacy-preserving eligibility proofs

## Purpose
Define and implement the PuffBuddies-side privacy-preserving proof-consumption boundary for adult eligibility. PuffBuddies accepts only a verifier-produced minimum-disclosure result bound to the current profile/policy/challenge and does not ingest raw identity evidence or raw cryptographic proof payloads.

PB-2.4 does **not** invent a production zero-knowledge system, credential format, Identity420 RPC, proof circuit, proving key, verifier contract, fixed address, or live provider. The concrete proof/credential mechanism remains owned by the canonical 420Identity/approved verifier architecture.

## Canonical requirements
1. Create a domain-separated proof challenge bound to PuffBuddies audience, adult-eligibility predicate, private profile, current policy, strong nonce, and request time.
2. Consume only a verifier-produced minimum-disclosure proof result, not raw DOB, legal identity, document, biometric, wallet-link, exact-address, precise-location, claim-hash, credential payload, or raw proof bytes.
3. Bind every accepted result to the challenged profile, policy, nonce, audience, and predicate.
4. Accept only the canonical 420Identity authority or an explicitly approved successor established by later canonical architecture.
5. Require verifier/source version and a non-empty proof-scheme identifier while remaining scheme-neutral.
6. Reject proof results predating the challenge, from the future, or older than the configured freshness bound.
7. Require bounded expiry for ELIGIBLE/INELIGIBLE results; UNKNOWN remains fail-closed without fabricated expiry.
8. Make revocation and expiry override a positive eligibility conclusion.
9. Convert accepted proof results only into the existing PB eligibility projection/state authority; proof verification cannot grant lifecycle, relationship, consent, visibility, messaging, payment, moderation, or safety authority.
10. Keep proof material and eligibility membership non-enumerable/publicly undisclosed; introduce no public-chain PuffBuddies eligibility registry.
11. Do not claim live/testnet proof-system readiness or direct Identity420 proof API compatibility until those dependencies are separately implemented and qualified.

## Affected components
- `puffbuddies/domain/eligibility_proofs.py`
- `puffbuddies/tests/test_pb_2_4_privacy_preserving_eligibility_proofs.py`
- `.github/workflows/puffbuddies-pb2.yml`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- this canonical definition and qualification evidence

## Qualification
**Level 1 — ordinary roadmap-step fast qualification.**

PB-2.4 is not Level 2 milestone A. The documented PB-2.13 integration milestone remains the Level 2 boundary.

## Dependencies
PB-0.3 privacy/data boundary; PB-0.4 privacy invariants; PB-0.6 adult eligibility policy; PB-0.8 420Identity authority boundary; PB-2.1, PB-2.2 and PB-2.3 COMPLETE.

## Exit criteria
Proof challenge/result types compile; domain/subject/policy/nonce/audience/predicate/verifier bindings pass; stale/future/replayed/expired/revoked results fail closed; UNKNOWN fails closed; raw identity and raw proof material are absent from the interface; accepted results feed existing PB-2 eligibility authority without bypassing it; retained PuffBuddies regressions pass; exact-head PB-2 fast qualification passes; durable Level-1 evidence is recorded.
