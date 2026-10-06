# PB-2.4 qualification evidence

## Step
**PB-2.4 — Privacy-preserving eligibility proofs — COMPLETE**

## Qualification level
**Level 1 — ordinary roadmap-step fast qualification**

## Qualified implementation SHA
`243f87f667d3e395dfa22864523d0da016bc3ee2`

## Repository relationship
- branch: `puffbuddies-pb2-eligibility-20261006`
- PR: #538
- current main / PR base: `23ebff000a471bfbc4439894f797f3b17a530867`
- PR was mergeable when qualification was inspected

## Implementation summary
PB-2.4 implements the PuffBuddies-side privacy-preserving eligibility proof boundary. The app issues a domain-separated challenge bound to private profile, current policy, nonce, audience, predicate and request time, then consumes only a verifier-produced minimum-disclosure result. Raw identity evidence, wallet linkage, claim hashes, exact location/address, credential payloads and raw cryptographic proof bytes remain outside the PuffBuddies domain. The implementation remains proof-scheme-neutral and does not invent a production Identity420 RPC, ZK circuit, verifier contract or deployment.

## Files changed
- `puffbuddies/domain/eligibility_proofs.py`
- `puffbuddies/tests/test_pb_2_4_privacy_preserving_eligibility_proofs.py`
- `docs/puffbuddies/PB-2.4-PRIVACY-PRESERVING-ELIGIBILITY-PROOFS.md`
- `.github/workflows/puffbuddies-pb2.yml`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`

## Requirements satisfied
- challenge is domain-separated to PuffBuddies adult eligibility;
- profile, policy, nonce, audience, predicate and request time are bound;
- only canonical 420Identity verifier authority is accepted;
- verifier/source version and proof-scheme identifier are required;
- subject/policy/nonce/audience/predicate/verifier mismatches fail closed;
- future, pre-challenge and stale proof results fail closed;
- bounded expiry is required for ELIGIBLE/INELIGIBLE;
- UNKNOWN remains fail-closed without fabricated expiry;
- revocation and expiry override positive proof conclusions;
- raw identity and raw proof material are excluded from the PB interface;
- accepted results feed the existing PB-2 eligibility projection/state authority rather than bypassing it;
- no lifecycle, relationship, consent, visibility, messaging, payment, moderation or safety authority is granted;
- no public PuffBuddies eligibility/membership registry or live proof-system claim is introduced.

## Exact-SHA Level 1 CI evidence
**PuffBuddies PB-2 Qualification**
- run: `37507382808` — **SUCCESS**
- job: `112419373524` (`pb2-fast`) — **SUCCESS**
- exact qualification head — PASS
- PuffBuddies compile — PASS
- PB-2.1 retained identity/eligibility boundaries — PASS
- PB-2.2 retained adult eligibility state model — PASS
- PB-2.3 retained age-verification interface — PASS
- PB-2.4 targeted privacy-preserving eligibility proofs — PASS
- retained PuffBuddies regression inventory — PASS
- identity privacy/public-chain negative gate — PASS

## Security / adversarial / boundary results
PASS for subject confusion, policy confusion, nonce/replay mismatch, audience/domain confusion, predicate confusion, untrusted verifier, missing verifier version/scheme, pre-challenge result, future result, stale result, invalid expiry, revocation precedence, expiry precedence, UNKNOWN fail-closed behavior, raw-evidence interface exclusion and authority non-escalation.

## Milestone status
PB-2.4 is **not** Level 2. **PB-2.13 — PB-2 Integration Milestone** remains the Level-2 boundary. **PB-2.14 — PB-2 Phase Closeout** remains Level 3.

## Intentionally deferred Level 3 checks
Canonical full Solidity inventory, Genesis/address-authority qualification, 420 Integrated/global qualification, Geth/fault/soak, repository-wide Docs/global closeout, unrelated app suites, deployment/configuration qualification and live/testnet proof-provider qualification remain deferred to the documented Level-3 closeout boundary.

## Limitations / blockers
No blocker for PB-2.4. The repository does not currently define a canonical production selective-disclosure/ZK proof wire format for PuffBuddies. Concrete proof schemes, proving/verifying infrastructure, live 420Identity integration and deployment remain later dependency/testnet work; PB-2.4 deliberately remains scheme-neutral.

## Evidence inheritance
This evidence file and the roadmap COMPLETE marker are evidence-only bookkeeping after exact-head Level-1 qualification passed. They change no executable source, tests, workflows, dependencies, configuration, interfaces, deployment state or substantive requirements, and therefore inherit the qualified implementation SHA without recursive qualification.

## Completion state
**COMPLETE** against exact Level-1 implementation SHA `243f87f667d3e395dfa22864523d0da016bc3ee2`.

## Next canonical roadmap step
**PB-2.5 — Eligibility persistence & lifecycle**
