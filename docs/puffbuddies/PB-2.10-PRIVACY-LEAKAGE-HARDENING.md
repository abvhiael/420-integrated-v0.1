# PB-2.10 — Privacy & information-leakage hardening

## Purpose
Harden the accumulated PB-2 eligibility/authorization boundary against direct and inferential disclosure of PuffBuddies eligibility, relationship, membership, policy/freshness and identity-linked state.

PB-1.10 already provides the general PuffBuddies public/derived privacy boundary. PB-2.10 adds the PB-2-specific rules needed after eligibility persistence, revocation, authorization, discovery/matching and messaging gates exist.

## Canonical requirements
1. Public or generic derived surfaces must not expose eligibility state, decision, source version, policy version, record sequence, checked time, expiry or revocation metadata.
2. Public/generic derived surfaces must not expose profile/subject/actor identifiers, relationship state, block state, lifecycle state, match identifiers, conversation identifiers or Messenger-native deny state.
3. Raw identity/proof material, DOB, credentials and wallet/profile linkage remain prohibited.
4. Externally consumable authorization conclusions must be minimum-disclosure and must not carry denial reasons or protected state.
5. Denial behavior must not distinguish expired, revoked, ineligible, policy-stale, blocked, unmatched, suspended or unknown state through reason codes.
6. Public eligibility lookup and public authorization probing/enumeration are prohibited.
7. Existing PB-1.10 protected-category checks remain authoritative and are composed rather than replaced.
8. PB-2 minimum-disclosure conclusions must not become a public membership oracle.
9. Operational derived metadata is permitted only when it is nonidentifying and passes the existing PB-1.10 derived-payload gate.
10. Discovery/matching and messaging decisions remain private authorization outcomes; no public match/eligibility/relationship graph is introduced.
11. Privacy hardening must not weaken authorization, consent, replay, revocation, generation or lifecycle checks.
12. Introduce no public API, analytics feed, Search/Indexer/Explorer projection, chain event, contract, fixed address/service ID, deployment or live integration claim.
13. Preserve PB-0.4 minimum disclosure, metadata privacy, wallet/profile unlinkability, anti-enumeration, relationship confidentiality and inference-resistance requirements.
14. Do not pre-empt PB-2.11 adversarial identity/eligibility qualification.

## Affected components
- `puffbuddies/domain/eligibility_privacy.py`
- `puffbuddies/tests/test_pb_2_10_eligibility_privacy.py`
- `.github/workflows/puffbuddies-pb2.yml`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- this canonical definition and qualification evidence

## Qualification
**Level 1 — ordinary roadmap-step fast qualification.**

PB-2.10 is not Level 2. **PB-2.13 — PB-2 Integration Milestone** remains Level 2 and **PB-2.14 — PB-2 Phase Closeout** remains Level 3.

## Dependencies
PB-0.3 blockchain/off-chain boundary; PB-0.4 privacy invariants; PB-0.7 threat model; PB-1.10 privacy/leakage hardening; PB-2.1 through PB-2.9 COMPLETE.

## Exit criteria
PB-2 internal eligibility/authorization metadata is rejected from external/derived payloads; external authorization conclusion is boolean-only; denial reason is uniform across protected deny states; public eligibility/authorization probes are prohibited; existing PB-1.10 controls remain effective; retained PuffBuddies regressions pass; exact-head PB-2 fast qualification passes; durable Level-1 evidence is recorded.
