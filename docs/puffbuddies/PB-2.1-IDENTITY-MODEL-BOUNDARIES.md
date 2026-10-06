# PB-2.1 — Identity model & boundaries

## Purpose
Establish the PB-2 identity/adult-eligibility boundary without making PuffBuddies an identity-document authority or exposing membership. 420Identity remains authoritative for bounded identity evidence; PuffBuddies consumes only a minimum-disclosure adult assertion and owns the local participation decision.

## Canonical requirements
1. Keep raw identity evidence, DOB, legal name, biometrics, identity documents and wallet/profile linkage outside PuffBuddies canonical state.
2. Accept adult-eligibility assertions only from the bounded 420Identity authority.
3. Bind an assertion to the intended private PuffBuddies profile; cross-profile replay fails closed.
4. Require a nonempty source version and a valid issued/expiry window.
5. Future, expired, revoked, malformed and untrusted assertions fail closed for current adult participation.
6. Project only ELIGIBLE/INELIGIBLE/EXPIRED/REVOKED plus source version and expiry into PB private state.
7. PuffBuddies remains canonical owner of its eligibility decision and participation lifecycle; 420Identity cannot activate a PB account or manufacture relationship/consent authority.
8. Eligibility evidence and wallet/profile linkage remain NEVER_PUBLIC and membership remains non-enumerable.
9. Preserve PB-1 authorization so ordinary participation requires current ELIGIBLE + ACTIVE state.
10. Introduce no public-chain PB identity, fixed address, service ID, production identity adapter, registration API, profile editor, deployment or live dependency.

## Qualification
**Level 1 — ordinary roadmap-step fast qualification.**

PB-2.1 is not Level 2 milestone A. Milestone A remains the accumulated PB-1/PB-2 account/profile/private-state integration boundary.

## Dependencies
PB-1 private eligibility projection/schema, authority boundaries, authorization, privacy and revocation foundations; PB-0.19 PB-2 phase authority.

## Exit criteria
Identity authority separation is executable and tested; only minimum adult eligibility is consumed; cross-profile replay/untrusted/malformed/future/expired/revoked inputs fail closed; raw identity and wallet linkage remain absent/private; retained PuffBuddies tests pass; exact-head PB-2 fast qualification passes; durable Level-1 evidence is recorded.
