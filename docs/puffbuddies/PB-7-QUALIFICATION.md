# PB-7 qualification evidence

## Step
**PB-7 — 420Notifications integration — COMPLETE**

## Qualification
- **Level 1 — PB-7 ordinary roadmap-step qualification — COMPLETE**
- **Level 2 — PB-5/PB-6/PB-7 relationship → Messenger → Notifications integration milestone — COMPLETE**

## Qualified implementation SHA
`e7e539063701ce20f5445af10bf2d226a96017fa`

## Repository relationship
- branch: `puffbuddies-pb7-notifications-integration-20261006`
- PR: #544
- current `main` / PR base: `78284d67ddeb598025f93d26f8847ea891872444`
- PB-6 was merged before PB-7 branch creation
- PR was mergeable at final qualification inspection

## Canonical authority boundary
PB-7 preserves the repository-owned authority split:
- PuffBuddies owns whether a current private application event is eligible to request an operational notification.
- PB-5/PB-2 own current match/messaging authorization.
- PB-6 owns the bounded PuffBuddies→Messenger authorization handoff.
- 420Notifications owns private subscription state, mute state, operational/promotional consent, filters, channels, destinations, feed/history, read state, replay checkpoints, queue/retry/backoff, deduplication, rate limiting, dead-letter/provider state and delivery acknowledgements.
- Notification delivery is non-authoritative and cannot create, restore, mutate or block the underlying PuffBuddies relationship or Messenger authority.

## Implementation summary
PB-7 adds a bounded private integration adapter:
- operational MATCHED notification intent;
- operational MESSAGE_AVAILABLE notification intent downstream of current PB-6 authorization;
- exact current pair-recipient binding;
- current PuffBuddies matched-user authorization and MESSAGING_AUTH generation recheck;
- explicit Notifications-owned subscription selection;
- active/unmuted/operational-consent enforcement;
- source/topic/event/minimum-severity filter enforcement;
- independent promotional-consent treatment;
- existing in_app/web/push channel mapping;
- transient Notifications-owned destination handoff;
- minimum-disclosure non-authoritative payloads;
- fail-closed Notifications authority outage;
- explicit prohibition on persistent profile→subscription/endpoint/device/push-token linkage.

PB-7 does not create or own notification feed/history, retry/backoff, queueing, rate limiting, provider health, dead letters, delivery receipts or provider credentials.

## Files changed
- `puffbuddies/domain/notifications_integration.py`
- `puffbuddies/tests/test_pb_7_notifications_integration.py`
- `puffbuddies/tests/test_pb_7_integration.py`
- `docs/puffbuddies/PB-7-NOTIFICATIONS-INTEGRATION.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `.github/workflows/puffbuddies-pb7.yml`

## Requirements satisfied
- current matched authorization is required for notification handoff;
- current MESSAGING_AUTH generation is required;
- MESSAGE_AVAILABLE requires current affirmative PB-6 Messenger handoff;
- conversation existence alone cannot manufacture a message notification;
- recipient must be a current pair participant;
- selected subscription identity must match exactly;
- inactive, muted or no-operational-consent subscriptions suppress delivery;
- promotional consent cannot substitute for operational consent;
- source/topic/event/minimum-severity filters are Notifications-owned deny controls;
- `puffbuddies` is used only as a private Notifications source-filter value, not a Registry service ID;
- channel selection/destinations remain Notifications-owned transient state;
- PuffBuddies persists no profile→subscription, endpoint, push-token or device binding;
- payloads are explicitly non-authoritative and minimum-disclosure;
- payloads contain no profile IDs, relationship/eligibility/lifecycle state, wallet/account linkage, conversation/message identifiers, denial reasons or subscription preference state;
- notification outage fails closed for the handoff but does not alter the underlying operation;
- Notifications success/failure does not create or restore a PuffBuddies match or Messenger authority;
- public relationship/message graph and Search/Explorer/Indexer publication remain absent;
- no Notifications contract, frozen address, provider credential, production endpoint, deployment or service-ID change is introduced;
- PB-8 remains canonical owner of Safety and moderation.

## Exact-SHA Level 1 and Level 2 CI evidence

### PuffBuddies PB-7 Qualification
- workflow: **PuffBuddies PB-7 Qualification**
- run: `37531397664` — **SUCCESS**
- run number: `6`
- job: `112501382289` (`pb7`) — **SUCCESS**
- exact qualification head — PASS
- PuffBuddies compile — PASS
- **PB-7 Level 1 targeted Notifications integration** — PASS
- complete retained PuffBuddies regression inventory — PASS
- **PB-7 Level 2 PB-5/PB-6/PB-7 integration milestone** — PASS
- affected Notifications packages:
  - `notifications/architecture` — PASS
  - `notifications/subscriptions` — PASS
  - `notifications/feed` — PASS
  - `notifications/security` — PASS
- Notifications Genesis service-boundary verifier — PASS
- Notifications privacy/authority negative gate — PASS

## Direct Notifications dependency verification
The exact qualified SHA ran:
- `go test ./notifications/architecture ./notifications/subscriptions ./notifications/feed ./notifications/security`
- `python3 scripts/verify-genesis-dapps.py`

PASS confirms:
- service ID `420/service/notifications/v1`;
- no Notifications-specific contract/canonical state requirement;
- subscription/consent/privacy boundary remains valid;
- notification/feed/security packages retain existing behavior;
- Genesis Notifications profile/service boundary remains valid.

The full 420Notifications app audit was not duplicated because PB-7 modifies no Notifications implementation package.

## PB-0 authority/invariant evidence
The PB-0 workflow passed the semantic code/docs SHA immediately before the final workflow-only guard repair:
- semantic SHA: `b663e21d816ab040286814dc5674c0c89b16839d`
- run: `37531294006` — **SUCCESS**
- job: `112501045269` (`pb0-fast`) — **SUCCESS**

The later change from `b663e21d816ab040286814dc5674c0c89b16839d` to `e7e539063701ce20f5445af10bf2d226a96017fa` modifies only the PB-7 CI negative-grep expression and changes no PB-0 executable/domain/document semantics. Final PB-7 qualification on `e7e539063701ce20f5445af10bf2d226a96017fa` is authoritative for the implementation/workflow state.

## Diagnosed qualification defects
Two failures were diagnosed and corrected without weakening protocol semantics:

1. Initial targeted test failure:
   - cause: **test-harness defect**;
   - the minimum-disclosure test prohibited substring `relationship`, which incorrectly rejected the canonical notification topic `relationships`;
   - repaired by checking actual protected state/linkage identifiers rather than forbidding the canonical topic.

2. Initial privacy-gate failure:
   - cause: **CI/workflow defect**;
   - a grep for `retry` matched explanatory docstring text describing Notifications-owned state;
   - repaired by restricting the negative gate to actual field/assignment syntax.
   
Both fixes created new implementation SHAs; stale failed runs were not counted as PASS. Exact final qualification is tied to `e7e539063701ce20f5445af10bf2d226a96017fa`.

## Broad Docs workflow status
A repository-wide 420Docs run auto-triggered on the immediately preceding semantic SHA but was cancelled after superseding commits. It is **not counted as passing evidence** and is **not a PB-7 blocker**:
- PB-7 changes only app-local canonical definition/roadmap documentation;
- no shared Docs tooling or cross-repository documentation dependency was changed;
- the policy does not require repository-wide Docs qualification for every ordinary app step;
- PB-7 exact-head app qualification and PB-0 authority checks provide the directly applicable coverage.

## Level-2 integration results
The accumulated PB-5/PB-6/PB-7 milestone proves:
1. a current PB relationship/messaging authority is required before Notifications handoff;
2. a current PB-6 message handoff can produce only non-authoritative message-availability notification metadata;
3. PB unmatch revokes notification eligibility even if a prior Messenger authorization existed;
4. Notifications mute/preferences can suppress delivery without mutating the PB match or Messenger authority;
5. operational delivery remains separately consented and downstream.

## Security / adversarial / invariant results
PASS for:
- unmatched/stale-generation notification attempt;
- message notification without PB-6 authorization;
- muted/inactive/no-operational-consent subscription;
- promotional-consent substitution attempt;
- source/topic/severity mismatch;
- Notifications service outage;
- recipient outside the matched pair;
- kind/topic mismatch;
- persistent profile/subscription linkage attempt;
- minimum-disclosure payload shape;
- Notifications-owned retry/feed/provider state exclusion.

## Milestone status
**PB-5/PB-6/PB-7 cross-app integration milestone COMPLETE at Level 2.**

## Intentionally deferred Level 3
Deferred to the applicable app-phase closeout:
- canonical full Solidity inventory;
- Genesis/address-authority full qualification;
- 420 Integrated/global qualification;
- Geth/fault/soak;
- repository-wide Docs/global reconciliation;
- deployment/config/live-provider qualification;
- final current-main reconciliation.

PB-7 changes no contract/address/deployment state requiring Level 3 now.

## Limitations / external gates
PB-7 intentionally does not claim:
- live 420Notifications backend/frontend endpoints;
- real provider credentials or provider delivery qualification;
- live 420Indexer binding;
- production retry/replay/reorg/failure evidence;
- testnet/mainnet readiness.

Those remain Notifications live/testnet/release gates and later PuffBuddies release-phase work.

## Blockers
**None for repository PB-7 qualification.**

## Completion state
**PB-7 COMPLETE** against exact implementation SHA `e7e539063701ce20f5445af10bf2d226a96017fa`.

## Evidence inheritance
This qualification document and roadmap COMPLETE marker are evidence-only bookkeeping after the exact implementation SHA passed all required PB-7 Level-1 and Level-2 qualification. They change no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements and therefore do not require recursive qualification.

## Next canonical roadmap step
**PB-8 — Safety and moderation**
