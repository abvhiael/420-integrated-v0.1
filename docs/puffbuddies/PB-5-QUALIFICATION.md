# PB-5 qualification evidence

## Step
**PB-5 — Likes and matching — COMPLETE**

## Qualification
- **Level 1 — PB-5 ordinary step qualification — COMPLETE**
- **Level 2 — accumulated PB-4/PB-5 discovery/matching integration milestone — COMPLETE**

## Qualified implementation SHA
`771ff07b5c662299c8dba7003a3b9357b4fd49b6`

## Repository relationship
- branch: `puffbuddies-pb5-likes-matching-20261006`
- PR: #542
- current `main` / PR base: `d1e6dae8cf6cc8ea513ffaf26d1dbad6d3c7f0b4`
- PB-4 was merged before PB-5 branch creation, so PB-5 is not stacked on an unmerged prior phase
- PR was mergeable when qualification was inspected

## Canonical scope
PB-5 is the current canonical owner of private LIKE/PASS intent, reciprocal match formation, unilateral unmatch, consent-epoch replay protection and current matched relationship authority.

PB-4 remains discovery/ranking only. PB-6 remains 420Messenger integration. PB-8 later owns the safety/moderation workflow that creates block/report/restriction state; PB-5 consumes current block authority and cannot bypass it.

## Implementation summary
PB-5 adds:
- private directional LIKE/PASS intent;
- deterministic canonical pair identity;
- a monotonic pair consent epoch;
- current-authority-gated LIKE;
- unilateral PASS as negative intent;
- independent reciprocal-current-LIKE proof before MATCHED;
- revalidation of current PB-2/PB-4 discovery/eligibility/lifecycle/block/generation authority at match time;
- canonical reciprocal-users relationship transition validation;
- current MATCHED pair binding into PB-2.9 messaging eligibility;
- unilateral MATCHED→UNMATCHED;
- consent-epoch advancement on unmatch;
- stale pre-unmatch LIKE rejection;
- fresh post-unmatch reciprocal consent only in the new epoch;
- canonical relationship/unmatch derived-state invalidation;
- private relationship-table persistence with optimistic concurrency.

No payment, premium, token, staking, reputation, admin, moderator, service, ranking, model or automation field can create consent.

## Persistence model
The existing private `relationship` table is reused without a new public surface:
- directional intent: `intent:<actor>><target>`, state LIKED/PASSED, logical `version` = consent epoch;
- canonical pair: `pair:<sorted-left>|<sorted-right>`, state NONE/MATCHED/UNMATCHED/(later safety-owned BLOCKED), logical `version` = consent epoch.

Repository row versioning remains separate and continues to provide optimistic concurrency.

## Files changed
- `puffbuddies/domain/matching.py`
- `puffbuddies/tests/test_pb_5_likes_matching.py`
- `puffbuddies/tests/test_pb_5_integration.py`
- `docs/puffbuddies/PB-5-LIKES-MATCHING.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `.github/workflows/puffbuddies-pb5.yml`

## Requirements satisfied
- one-sided LIKE remains unilateral private intent;
- one-sided LIKE does not create MATCHED state;
- one-sided LIKE does not authorize ordinary messaging;
- PASS is unilateral negative intent and prevents match while current;
- reciprocal match requires two independent current LIKE intents in opposite directions;
- intent subjects/targets must bind the canonical pair;
- self-like/self-match is rejected;
- current discovery eligibility/lifecycle/block/generation authority is rechecked;
- current block defeats old reciprocal likes;
- stale derived generation cannot authorize LIKE/match;
- service/admin-style principal cannot create user LIKE consent;
- pair identity is deterministic/order-independent;
- unmatch is participant-owned, unilateral and immediate;
- unmatch advances consent epoch;
- unmatch invalidates messaging/matching derived authority for both participants;
- old pre-unmatch likes cannot rematch;
- fresh rematch requires two new LIKE actions in the new epoch;
- current MATCHED pair can feed PB-2.9 messaging authorization;
- relationship/intents persist privately in the canonical relationship table;
- optimistic concurrency rejects stale relationship writes;
- no wallet/payment/public-graph/economic fields are present in PB-5 relationship records;
- no contract, public API, Messenger transport, notification transport, address/service ID, production database or deployment is introduced.

## Exact-SHA Level 1 and Level 2 CI evidence

### PuffBuddies PB-5 Qualification
- workflow: **PuffBuddies PB-5 Qualification**
- run: `37526695455` — **SUCCESS**
- run number: `2`
- job: `112485401079` (`pb5`) — **SUCCESS**
- exact qualification head — PASS
- PuffBuddies compile — PASS
- **PB-5 Level 1 targeted likes and matching** — PASS
- complete retained PuffBuddies regression inventory — PASS
- **PB-5 Level 2 PB-4/PB-5 integration milestone** — PASS
- consent/public-relationship negative gate — PASS

## Level-2 integration results
The retained PB-4/PB-5 milestone proves on one exact SHA:
1. a candidate must first remain currently discoverable under PB-4;
2. one user's LIKE remains non-messaging unilateral intent;
3. a second current independent reciprocal LIKE forms MATCHED;
4. current MATCHED state enables only the already-qualified PB-2.9 messaging-eligibility boundary;
5. unilateral unmatch revokes matched messaging authority;
6. stale old-epoch reciprocal LIKEs cannot recreate the match;
7. later rematch requires fresh reciprocal actions in the new consent epoch;
8. a current block defeats previously valid reciprocal LIKEs.

## Security / adversarial / invariant results
PASS for:
- one-sided consent isolation;
- PASS-vs-LIKE conflict;
- self pair rejection;
- actor/target binding;
- current block supremacy;
- stale generation rejection;
- stale consent-epoch replay;
- administrative/service-principal fabrication attempt;
- messaging-before-match denial;
- messaging-after-unmatch denial;
- stale optimistic-concurrency write;
- public relationship/economic-field negative checks.

## Other auto-triggered workflows
Repository path policies also automatically triggered PB-0/PB-1/PB-2/PB-3/PB-4, Docs and unrelated Oracle workflows. They are **not required PB-5 qualification evidence**:
- PB-5's workflow already runs the complete retained PuffBuddies regression inventory;
- no PB-0 invariant authority or shared cross-app dependency was modified;
- this Level-2 milestone is explicitly app-focused;
- repository-wide Docs/global and other Level-3 inventories are not ceremonial requirements for this step.

No skipped, cancelled, missing or untriggered PB-5-required check is counted as PASS.

## Milestone status
**Level 2 discovery/matching milestone COMPLETE.**

This is the meaningful accumulated PB-4/PB-5 boundary documented during PB-4 and PB-5 planning.

## Intentionally deferred Level 3
Deferred to the applicable app-phase closeout:
- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/Geth/fault/soak;
- repository-wide Docs/global reconciliation;
- deployment/config qualification;
- unrelated app audits;
- final current-main reconciliation.

PB-5 changes no contract/address/deployment state requiring Level 3 now.

## Limitations
PB-5 intentionally does not implement:
- 420Messenger transport/conversation creation;
- 420Notifications transport;
- safety/report/moderation workflow;
- premium/payment features;
- public relationship graph;
- Search/Explorer/Indexer relationship publication;
- production API/database topology;
- web/mobile UI;
- testnet/mainnet deployment.

## Blockers
**None for PB-5.**

## Completion state
**PB-5 COMPLETE** against exact implementation SHA `771ff07b5c662299c8dba7003a3b9357b4fd49b6`.

## Evidence inheritance
This qualification document and roadmap COMPLETE marker are evidence-only bookkeeping after the exact implementation SHA passed the required PB-5 Level-1 and accumulated PB-4/PB-5 Level-2 qualification. They change no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements and therefore do not require recursive qualification.

## Next canonical roadmap step
**PB-6 — 420Messenger integration**
