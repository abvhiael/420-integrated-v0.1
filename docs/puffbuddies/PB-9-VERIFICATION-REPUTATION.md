# PB-9 — Verification and reputation

## Purpose
Implement the later-scope verification/reputation boundary promised by PB-0.2 without violating PuffBuddies privacy, consent, safety, state-ownership or anti-public-score invariants.

PB-9 deliberately treats reputation as **non-scored user-controlled presentation of current positive verification indicators**, not a universal trust, desirability, safety or social-worth score.

## Repository-grounded scope
PB-0.2 deferred photo/liveness verification, advanced identity badges, optional reputation credentials, cross-app reputation aggregation and portable dating credentials. PB-9 implements only the subset for which canonical authority exists today:
- current account-control conclusion from 420Wallet/account authority;
- approved identity-credential conclusion from 420Identity;
- current .420 name-control conclusion from 420Names;
- private PuffBuddies photo/liveness verification conclusion.

Arbitrary cross-app reputation aggregation and portable external dating credentials remain deferred because the repository defines no canonical interpersonal reputation issuer/verification authority. 420Verify is explicitly not interpersonal identity/reputation authority under PB-0.8.

## Canonical requirements
1. Verification indicators remain private PuffBuddies application projections over their owning authority; they do not mutate Wallet, Identity or Names truth.
2. Indicator kinds are source-bound: account control→420Wallet, identity credential→420Identity, name control→420Names, photo/liveness→private PuffBuddies verification.
3. 420Verify cannot be reinterpreted as personal identity, adult eligibility, consent, match, reputation or safety authority.
4. Indicators default to non-public/non-discoverable presentation.
5. Only the profile owner may opt a current positive indicator into in-app presentation.
6. Presentation audiences are PRIVATE_SELF, DISCOVERABLE and MATCHED only; PUBLIC_EXPLICIT is rejected.
7. Presentation exposes bounded generic labels only, never raw credential/evidence identifiers or source payloads.
8. Revoked/expired/future-issued indicators fail closed and disappear from presentation/ranking inputs.
9. Only the owning verification source may revoke its indicator.
10. Indicator change/visibility change invalidates derived profile/discovery/visibility state.
11. Optional matching input is only a bounded set of current user-visible indicator kinds; PB-9 assigns no score/weight/order.
12. Verification must not create eligibility, lifecycle, match, messaging, visibility, safety or payment authority.
13. Verification status is not consent and cannot bypass block/safety/lifecycle/deletion rules.
14. Report counts, block counts, moderation history, internal risk signals and safety case outcomes are not reputation inputs.
15. Wallet balance, token holdings, staking, payments, premium status, popularity and engagement are not reputation inputs.
16. No universal trust/reputation/desirability/social-credit score exists.
17. Negative verification state is not presented as a public shame/reputation badge.
18. Indicators remain private/off-chain and non-enumerable through Registry/Search/Explorer/public chain/public wallet lookup.
19. Persistence stores minimum conclusion metadata only: profile, kind, source, source-version, state, issuance/expiry, owner visibility choice and version.
20. Persistence stores no raw proof, credential payload, government ID, DOB, biometric template, wallet address or source evidence.
21. Optimistic concurrency protects stale indicator writes.
22. Unknown/future source-kind combinations fail closed.
23. Cross-profile indicator mixing fails closed.
24. Cross-app reputation aggregation/portable dating credentials require a future explicit issuer/authority design and are not invented here.
25. No verification contract, fixed address, service ID, public registry, credential issuer, biometric store, external reputation API or deployment is introduced.

## Qualification
PB-9 is **Level 1 app-scoped qualification**. It uses existing dependency authority definitions but does not introduce a new shared service or lifecycle authority requiring a new Level-2 milestone.

Retained PuffBuddies regressions and a narrow PB-9 integration suite are still required at Level 1. Level 3 remains deferred.

## Affected components
- `puffbuddies/domain/verification_reputation.py`
- canonical private `verification` persistence schema
- PB-3/PB-4 presentation/discovery boundaries
- PB-0.8/PB-0.9/PB-0.13 authority constraints
- PB-9 targeted/integration tests/workflow
- current roadmap and PB-0.19 reconciliation
- durable qualification evidence

## Dependencies
PB-0.2, PB-0.3, PB-0.4, PB-0.5, PB-0.8, PB-0.9, PB-0.10, PB-0.13, PB-0.15, PB-0.16; PB-1 persistence/invalidation; PB-2 identity/eligibility separation; PB-3 profile presentation; PB-4 discovery; **PB-8 — Safety and moderation — COMPLETE**.

## Exit criteria
All four bounded indicator classes work with source authority binding; owner visibility and in-app presentation are fail-closed; expiry/revocation remove indicators; verification cannot create eligibility/consent/lifecycle/safety authority; no public/scored reputation exists; safety/economic data cannot become reputation input; private persistence/concurrency works without raw evidence; retained app regressions and exact-head PB-9 fast qualification pass; durable evidence is recorded.
