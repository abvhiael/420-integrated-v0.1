# PB-5 — Likes and matching

## Purpose
Implement private one-sided LIKE/PASS intent and reciprocal PuffBuddies match formation over the current PB-4 discovery boundary while preserving PB-0.5 consent, PB-0.13 match-formation rules, block supremacy, current-state authority and stale-state rejection.

PB-5 is the current canonical owner of likes, passes, reciprocal match formation and stale-rematch protection. It does not implement messaging transport, notifications, premium products or public relationship graphs.

## Canonical requirements
1. A LIKE is an authenticated unilateral user intent from one canonical profile to another.
2. A one-sided LIKE never creates a match or ordinary messaging authority.
3. PASS is unilateral negative intent and cannot be treated as reciprocal consent.
4. Directional LIKE/PASS intent is private PuffBuddies state.
5. A match may form only from two independent current LIKE intents bound to opposite directions of the same canonical pair.
6. Matching must revalidate current PB-2/PB-4 hard authority at match time; stale discovery or historical likes are not sufficient.
7. The actor/target must remain current eligible ACTIVE ordinary participants, unblocked and otherwise currently matchable.
8. Administrative, moderator, service, algorithmic, payment, premium, token, staking, reputation or automation state cannot create a LIKE or MATCHED state on behalf of users.
9. Canonical pair identity is deterministic and order-independent; self-like/self-match is prohibited.
10. Directional intent and canonical pair relationship reuse the existing private `relationship` table without public relationship state.
11. The pair carries a monotonic consent epoch.
12. LIKE/PASS intents are valid only for the current pair consent epoch.
13. Unmatch is unilateral and immediate for either participant.
14. Unmatch transitions MATCHED→UNMATCHED and advances the consent epoch.
15. Advancing the epoch makes every pre-unmatch LIKE stale, preventing cached/stale reciprocal intent from silently recreating the match.
16. A later rematch, if allowed by current policy, requires fresh independent likes in the new consent epoch.
17. Current block/safety/lifecycle/eligibility/visibility authority remains supreme over any old or fresh intent.
18. Match formation uses the canonical PB-1 reciprocal-users relationship-transition authority after reciprocal intent has been independently established.
19. LIKE/PASS/relationship changes emit canonical derived-state invalidation; MATCH affects both participants.
20. Unmatch invalidates MATCHING, MESSAGING_AUTH and other canonical UNMATCH-derived surfaces for both participants.
21. Messaging eligibility is enabled only by the resulting current MATCHED pair state; LIKE/PASS alone cannot satisfy PB-2.9 messaging authorization.
22. Optimistic concurrency protects relationship/intent persistence from stale writers.
23. Relationship records expose no wallet, payment, public profile, safety-report, moderation, ranking-score or economic fields.
24. Relationship state remains private/off-chain and must not become Registry/Explorer/Search/public-chain/public-wallet enumerable.
25. PB-5 does not implement block/report moderation workflow; later safety work owns creation of safety state, while PB-5 consumes current block authority and cannot bypass it.
26. PB-5 introduces no contract, address/service ID, public API, production database, Messenger transport, notification transport or deployment.

## Persistence model
PB-5 reuses the existing canonical `relationship` table in two private record forms:
- directional intent key: `intent:<actor>><target>`, state `LIKED` or `PASSED`, logical `version` = consent epoch;
- canonical pair key: `pair:<sorted-left>|<sorted-right>`, state `NONE`, `MATCHED`, `UNMATCHED` or later safety-owned `BLOCKED`, logical `version` = consent epoch.

Repository record versioning remains the optimistic-concurrency mechanism and is distinct from the logical consent epoch.

## Affected components
- `puffbuddies/domain/matching.py`
- existing PB-1 relationship state machine and private relationship table
- existing PB-2 eligibility/messaging authorization and generation invalidation
- existing PB-4 discovery engine
- `puffbuddies/tests/test_pb_5_likes_matching.py`
- PB-4/PB-5 retained integration test
- `.github/workflows/puffbuddies-pb5.yml`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- PB-0.19 reconciliation
- durable qualification evidence

## Qualification
PB-5 requires:
- **Level 1** exact-head app-scoped qualification for PB-5 itself; and
- **Level 2** retained PuffBuddies integration at this documented accumulated discovery/matching boundary, because PB-4 explicitly deferred the meaningful discovery/matching milestone until PB-5 converged.

Level 2 remains app-focused and must not trigger repository-wide Level-3 inventories.

## Dependencies
PB-0.4 privacy; PB-0.5 consent; PB-0.7 threat model; PB-0.13 matching principles; PB-0.15 visibility; PB-1 relationship/invalidation/persistence foundations; PB-2 eligibility/messaging authorization; **PB-4 — Discovery engine — COMPLETE**.

## Exit criteria
- unilateral LIKE/PASS persistence works privately;
- one-sided LIKE cannot match/message;
- reciprocal current likes can form exactly one current match;
- PASS or absent reciprocal intent prevents match;
- current discovery/eligibility/lifecycle/block/generation authority is rechecked at match time;
- admin/service/payment/algorithmic fabrication fails;
- unmatch is unilateral, revokes messaging authority and advances consent epoch;
- stale pre-unmatch likes cannot rematch;
- fresh later reciprocal likes require the new epoch;
- relationship persistence and optimistic concurrency work;
- public-chain/public-wallet/public-relationship graph remains absent;
- PB-5 Level-1 targeted qualification passes;
- PB-4/PB-5 retained Level-2 integration suite passes on the same exact implementation SHA;
- durable evidence records both qualification levels.
