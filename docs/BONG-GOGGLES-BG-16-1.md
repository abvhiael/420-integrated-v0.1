# Bong Goggles BG-16.1 — Notification Taxonomy + 420Notifications Boundary

BG-16.1 turns the BG-12.6 notification candidate pipeline into the production integration contract for the Bong Goggles application while preserving the existing 420Notifications authority boundary.

## Scope

- freeze the Bong Goggles notification vocabulary and topic taxonomy;
- validate all application candidates before handoff to `420/service/notifications/v1`;
- reserve production classes needed by the remaining BG-16 increments: relationship requests, comments, mentions, tags, group/event activity, game invitations/turns/results, message metadata, moderation/appeals and rewards;
- attach presentation severity/actionability as catalog metadata rather than protocol truth;
- keep subscription state, delivery endpoints, provider retry state and promotional consent owned by 420Notifications;
- keep notification state explicitly non-authoritative.

## Security and privacy boundary

Bong Goggles notifications cannot sign transactions, approve spending, mutate canonical state or bypass Wallet confirmation. Messenger notifications are metadata-only and explicitly forbid private/encrypted payload carriage. Private Messenger content, private Identity fields and raw Attention telemetry remain outside notification indexing.

## BG-16.1 implementation

- `services/bong-goggles-indexer-v1/src/notificationCatalog.js`
  - closed notification-kind catalog;
  - stable topic mapping;
  - presentation severity/actionability metadata;
  - candidate validation against service/app/authority/provenance/topic requirements;
  - explicit private-message payload exclusion.
- `services/bong-goggles-indexer-v1/test/notificationCatalog.test.js`
  - current BG-12.6 pipeline compatibility;
  - reserved production topic coverage;
  - private-message metadata-only enforcement;
  - authority/topic drift rejection;
  - unknown-kind fail-closed behavior.

## Production taxonomy

Topics: `relationships`, `interactions`, `groups`, `events`, `games`, `messages`, `moderation`, `rewards`, `discovery`, `safety`.

The catalog intentionally defines presentation classes only. Later BG-16 increments connect each class to qualified Bong Goggles application events and 420Notifications delivery/preferences without moving authority into the notification layer.

## Exit criteria

BG-16.1 is complete when the catalog and tests are committed on the BG-16 phase branch and the exact PR head passes the Bong Goggles/Integrated qualification workflows required by the repository.
