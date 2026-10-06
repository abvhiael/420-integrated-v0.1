# PB-4 — Discovery engine

## Canonical status
The current canonical phase sequence reserves **PB-4 — Discovery** and **PB-5 — Likes and matching**. The older PB-0.19 planning map combined discovery and matching under its legacy PB-3. PB-4 carries forward only the discovery/recommendation portion of that legacy scope; likes, passes, reciprocal consent and match formation remain PB-5.

## Purpose
Implement a private PuffBuddies discovery engine that composes current eligibility, lifecycle, block/safety, profile completeness, field visibility, explicit discovery preferences, Dating/Buddy/Both compatibility, coarse proximity and cannabis compatibility. Hard exclusions execute before any ranking. Ranking is derived/non-canonical and cannot manufacture relationship state or consent.

## Canonical requirements
1. PB-4 consumes current PB-2 eligibility/generation authority and PB-3 profile/visibility authority rather than duplicating them.
2. Viewer and candidate must both pass the current PB-2 discovery hard gate.
3. Self-discovery is prohibited.
4. Profile completeness is a hard discovery prerequisite for both viewer and candidate.
5. Dating/Buddy/Both compatibility is mutual and based only on current explicit modes/preferences.
6. Discovery preferences remain private PuffBuddies state and use the existing private `preferences` table.
7. Coarse proximity may be used only as a bounded distance band. Exact coordinates, address, raw GPS history and repeated precise-distance output are not discovery/ranking inputs or results.
8. Unknown proximity fails closed.
9. Cannabis compatibility may use current private user-declared values/preferences. Non-use remains valid and cannabis compatibility cannot coerce use.
10. Block, non-ACTIVE lifecycle, eligibility failure/unknown/expiry/revocation, deletion, applicable restriction, stale derived generation and visibility denial are hard exclusions before ranking.
11. Missing/stale/non-DISCOVERABLE PB-3 field visibility fails closed; discovery returns only currently authorized presentation fields.
12. Ranking executes only after hard exclusions.
13. Ranking is deterministic, derived and non-canonical. It cannot alter eligibility, lifecycle, safety, visibility, relationship, consent or messaging authority.
14. Ordinary ranking inputs are limited to explicitly allowed discovery signals. Wallet balance, token value, staking, payments, premium status, report/block counts, moderation outcomes, raw identity evidence, precise location and hidden inferred sensitive traits are excluded.
15. Internal rank behavior/scores must not become public reputation/desirability output.
16. Ranking/model unavailability degrades to a simple deterministic order **after** the same hard exclusions; failure cannot broaden discovery.
17. A result limit is bounded to prevent unbounded enumeration.
18. Discovery results are private application views, not Search/Explorer/public-chain/public-wallet surfaces.
19. Discovery cannot create a like, pass, match, reciprocal intent, message permission or notification.
20. Stale cached discovery authority after profile, visibility, lifecycle, eligibility, block/safety, deletion or other canonical revocation is rejected through the existing generation boundary.
21. PB-4 introduces no public profile registry, Search/Indexer authority, recommendation service deployment, ML model, feature store, contract, fixed address/service ID, external API or production database.
22. PB-5 remains canonical owner of likes, passes, reciprocal match formation and stale-rematch semantics beyond discovery exclusion.

## Affected components
- `puffbuddies/domain/discovery.py`
- existing PB-2 discovery eligibility/generation gate
- existing PB-3 profile/visibility implementation
- existing private `preferences` persistence
- `puffbuddies/tests/test_pb_4_discovery.py`
- `.github/workflows/puffbuddies-pb4.yml`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- PB-0.19 phase-number reconciliation note
- this canonical definition/evidence

## Qualification
**Level 1 — ordinary app-scoped roadmap-step fast qualification.**

Required direct qualification: exact-head compile, PB-4 targeted discovery suite, complete retained PuffBuddies regressions, discovery privacy/public-chain negative gate, and directly affected roadmap/invariant documentation checks.

## Milestone relationship
PB-4 alone is not the accumulated discovery/matching integration milestone. The natural Level-2 boundary occurs only after the later PB-5 likes/matching work has converged with discovery; Level 2 is therefore deferred.

## Dependencies
PB-0.4 privacy; PB-0.5 consent; PB-0.7 threat/trust; PB-0.13 matching principles; PB-0.14 cannabis taxonomy; PB-0.15 visibility; PB-2 eligibility/generation; PB-3 Profiles COMPLETE.

## Exit criteria
- hard exclusions run before ranking;
- current eligibility/lifecycle/block/generation and profile/visibility authority are enforced;
- mutual mode/private preference/coarse-proximity/cannabis compatibility work without sensitive inference or precise-location disclosure;
- stale/unknown authority fails closed;
- ranking is deterministic/non-canonical and safe-degrades without bypass;
- results contain only authorized discovery presentation and create no relationship/messaging consent;
- preferences persist privately with optimistic concurrency;
- no public-chain/Search/Explorer/wallet enumeration surface exists;
- retained PuffBuddies regressions and exact-head PB-4 fast qualification pass;
- durable Level-1 evidence is recorded.
