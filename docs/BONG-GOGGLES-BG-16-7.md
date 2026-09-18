# Bong Goggles BG-16.7 — notification centre application surfaces

BG-16.7 adds the Bong Goggles application-facing notification-centre model on top of the qualified 420Notifications boundary. It remains presentation-only and does not become authority for the source event, notification delivery state, Wallet execution or protocol truth.

## Implemented surfaces

- deterministic unread counts across the current centre history;
- reverse-chronological paged history with stable timestamp + notification-ID cursors;
- a bounded page size of 1–100 items and fail-closed unknown cursors;
- canonical Bong Goggles deep links that resolve notification kind, notification ID and opaque subject ID through the production HTTPS application surface;
- explicit `pending`, `finalized`, `retracted` and `superseded` presentation states;
- provenance retained on every centre item;
- degraded-notification fallback links to canonical Bong Goggles, 420Wallet and 420Explorer state.

## Authority boundary

Notification-centre items are always `authoritative: false`. The surface contains no signing, spending, transaction-approval, capability-grant or Wallet-bypass primitive. Read/unread state and notification canonicality presentation cannot rewrite the underlying canonical event.

The Wallet fallback is a navigation-only `wallet420://home` handoff. No transaction payload, signature request, spend request or capability request is carried through the notification centre.

## Canonicality presentation

BG-16.7 accepts only the append-only presentation states used by 420Notifications:

- `pending`
- `finalized`
- `retracted`
- `superseded`

An unknown canonicality state fails closed rather than silently rewriting history.

## Deep-link safety

Canonical Bong Goggles subject links must use HTTPS and target the production Bong Goggles origin by default. Opaque subject IDs are URL-encoded and the notification candidate is revalidated through the BG-16 catalog before a deep link is produced.

## Degraded mode

When notification delivery or history is degraded, the UI must tell the user that notifications may be delayed and route them back to canonical application/Wallet/Explorer state. Notification-service degradation never claims that canonical protocol state is unavailable or changed.

## Executable coverage

`services/bong-goggles-indexer-v1/test/notificationCentre.test.js` covers:

- non-authoritative centre item construction;
- canonical HTTPS deep links and subject encoding;
- allowed canonicality states and invalid-state rejection;
- deterministic history ordering, unread count and cursor pagination;
- unknown-cursor and oversized-page fail-closed behavior;
- degraded canonical fallbacks;
- absence of signing/spending/capability authority.
