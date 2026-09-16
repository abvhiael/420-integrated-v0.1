# Bong Goggles BG-12.6 — Notification/Event Pipeline

BG-12.6 converts selected canonical Bong Goggles activity into deterministic notification candidates for 420Notifications while preserving the core authority boundary: notifications are presentation messages, never protocol state.

## Guarantees

- candidates preserve chain/block/transaction/log/event provenance
- notification IDs are deterministic digests of the non-authoritative delivery envelope
- replay of the same source event is deduplicated
- self-notifications are suppressed
- events that omit recipient context require canonical state hydration
- consumer checkpoint state is explicitly non-authoritative and restart-safe
- canonicality updates are append-only `finalized`, `retracted` or `superseded` presentation metadata
- unmapped events emit no notification rather than guessing intent

## Initial Bong Goggles notification classes

- relationship activity: follow and accepted friend request
- safety activity: block events
- group activity: join requests, member activation and removal
- event activity: RSVP changes
- discovery activity: reviews, corrections and verification attestations

The pipeline intentionally does not read private Messenger payloads, encrypted content, private identity fields or raw Attention telemetry.

## 420Notifications integration

The output envelope uses `420/service/notifications/v1` and is designed to feed the existing 420Notifications consumer/delivery layer. Delivery endpoints, user subscription preferences, rate limits and provider retry state remain consumer-owned and outside canonical Bong Goggles projections.

BG-12.6 remains part of the monolithic Phase-12 PR and is not merged independently.
