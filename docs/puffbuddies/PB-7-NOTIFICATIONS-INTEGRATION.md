# PB-7 — 420Notifications integration

## Purpose
Integrate private PuffBuddies operational notification intents with the canonical 420Notifications subscription/delivery boundary without making notification state authoritative for PuffBuddies relationships, messaging, safety, lifecycle or protocol truth.

420Notifications is contract-free and non-canonical. It owns subscriptions, mute state, operational/promotional consent, channels/delivery endpoints, feed/history, replay checkpoints, retry/backoff, deduplication, rate limiting, dead-letter state and provider operations. PuffBuddies owns only whether a current private application event is eligible to request an operational notification.

## Canonical repository dependency
PB-7 consumes the existing qualified Notifications V1 semantics:
- service ID `420/service/notifications/v1`;
- no Notifications-specific contract/canonical protocol state;
- private opt-in reversible subscriptions;
- independent operational/promotional consent;
- `active && !muted && operationalConsent` operational delivery rule;
- source/topic/event/minimum-severity/channel filters;
- provider-neutral in-app/web/push delivery;
- non-authoritative private feed/history;
- service/provider failure isolation.

## Canonical requirements
1. PuffBuddies notification intents are private, non-authoritative application intents.
2. PB-7 currently supports only already-implemented event classes: current MATCHED relationship presentation and MESSAGE_AVAILABLE metadata after a current PB-6 Messenger handoff.
3. PB-7 does not pre-empt PB-8 safety/moderation notification categories.
4. A notification intent recipient must be a participant in the current matched PuffBuddies pair.
5. Current PuffBuddies matched-user authorization and current MESSAGING_AUTH generations are rechecked before operational notification handoff.
6. MESSAGE_AVAILABLE requires an affirmative current PB-6 Messenger handoff result; conversation existence alone cannot create a notification.
7. Unmatch, PuffBuddies block, eligibility/lifecycle revocation or stale generation defeats notification handoff even if an earlier Messenger authorization or notification candidate existed.
8. 420Notifications must explicitly select the subscription; PuffBuddies does not implicitly choose a recipient subscription.
9. Subscription ID returned by Notifications must match the requested selected subscription.
10. Operational delivery requires active=true, muted=false and operationalConsent=true.
11. Promotional consent cannot substitute for operational consent and PB-7 emits only operational classifications.
12. Notifications-owned source/topic/event/minimum-severity filters can suppress delivery without changing PuffBuddies authority.
13. PB-7 uses source label `puffbuddies` only as a private Notifications filter value; it does not invent a PuffBuddies Registry service ID.
14. Supported current topics are relationships and messages, bound respectively to MATCHED and MESSAGE_AVAILABLE kinds.
15. Channel selection is Notifications-owned and limited to the existing in_app/web/push provider-neutral channels.
16. Delivery destinations are transient Notifications-owned handoff data and must not become PuffBuddies profile/account state.
17. PuffBuddies must not persist, publish or expose profile→subscription, profile→endpoint, profile→push token or profile→device mappings.
18. Notification handoffs are explicitly non-authoritative.
19. Minimum-disclosure payloads contain notification/event identity, app/kind/topic, opaque app action reference and authoritative=false only.
20. PB-7 payloads must not contain PuffBuddies profile IDs, match/relationship state, eligibility/lifecycle state, wallet/account identifiers, conversation IDs, message IDs/content, denial reasons, subscription preference state or delivery endpoint metadata.
21. 420Notifications remains owner of feed/history/read state, retry/backoff, dedup, provider health, rate limiting, dead letters and delivery acknowledgements.
22. Notification success/failure cannot create, restore, alter or block a PuffBuddies match or Messenger conversation.
23. 420Notifications outage/read failure fails closed for the handoff but must not block the underlying PuffBuddies or Messenger operation.
24. Alternative notification clients/providers remain allowed under Notifications authority.
25. No public relationship/message graph, Search/Explorer/Indexer publication or analytics identity correlation is introduced.
26. No Notifications contract, frozen address, deployment, service ID, provider credential or production endpoint is modified or invented by PB-7.
27. PB-8 remains owner of Safety and moderation.

## Qualification
PB-7 requires:
- **Level 1** exact-head PuffBuddies PB-7 qualification;
- **Level 2** retained app integration because PB-7 completes the current PB-5/PB-6/PB-7 relationship→Messenger→Notifications handoff chain;
- directly affected Notifications dependency tests for architecture/subscriptions/feed/security and the shared Genesis service-boundary verifier.

Level 2 remains app-focused. PB-7 does not trigger the canonical full Solidity inventory, Genesis full inventory, 420 Integrated/Geth/fault/soak or Level-3 phase closeout.

## Affected components
- `puffbuddies/domain/notifications_integration.py`
- PB-2.9 current messaging authorization
- PB-5 match authority
- PB-6 Messenger handoff conclusion
- existing 420Notifications subscription/service interfaces as read-only dependency
- `puffbuddies/tests/test_pb_7_notifications_integration.py`
- `puffbuddies/tests/test_pb_7_integration.py`
- `.github/workflows/puffbuddies-pb7.yml`
- canonical roadmap/master scope reconciliation
- durable evidence

## Dependencies
PB-0.3, PB-0.4, PB-0.5, PB-0.7, PB-0.8, PB-0.9, PB-0.11; PB-2.9; PB-5; **PB-6 — 420Messenger integration — COMPLETE**; canonical 420Notifications repository implementation.

## Exit criteria
- matched relationship event can hand off only through an explicit current Notifications subscription;
- message metadata notification additionally requires current PB-6 authorization;
- current PB authorization/generation is rechecked;
- muted/inactive/no-operational-consent/filter/severity state safely suppresses delivery;
- promotional consent cannot broaden operational delivery;
- Notifications outage fails closed without changing the underlying PuffBuddies/Messenger operation;
- payload is non-authoritative and minimum-disclosure;
- profile/subscription/destination linkage is not persisted by PuffBuddies;
- affected Notifications dependency tests and Genesis service-boundary verification pass unchanged;
- Level-1 PB-7 tests/retained regressions pass;
- Level-2 PB-5/PB-6/PB-7 integration passes on the same exact SHA;
- durable evidence records qualification.
