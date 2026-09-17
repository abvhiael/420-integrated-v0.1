# 420Notifications Genesis Roadmap

420Notifications is the opt-in alert and event-delivery layer for 420 Integrated. It is a contract-free Genesis user application/service that derives alerts from canonical or registered sources without becoming authority for the underlying event and without inheriting 420Wallet execution rights.

## GEN-10.7 status

- **NOTIFY-0 — Genesis boundary + executable invariant baseline — COMPLETE**
- **NOTIFY-1 — runtime/service scaffold — COMPLETE**
- **NOTIFY-2 — subscription engine — COMPLETE**
- **NOTIFY-3 — indexer ingestion + replay — COMPLETE**
- NOTIFY-4 — delivery queue + retry/dedup — pending
- NOTIFY-5 — provider-neutral delivery adapters — pending
- NOTIFY-6 — provenance + security — pending
- NOTIFY-7 — API + feed/history — pending
- NOTIFY-8 — privacy + abuse hardening — pending
- NOTIFY-9 — Genesis frontend — pending
- NOTIFY-10 — qualification, reconciliation + closeout — pending

## NOTIFY-0 — Genesis boundary + executable invariant baseline

Freeze the service identity `420/service/notifications/v1`, require no Notifications-specific Genesis contract, and encode the authority, replay, privacy and Wallet boundaries in executable Go tests and the Genesis configuration.

### Genesis invariants

- **NOTIFY-INV-001** — 420Notifications owns no canonical protocol state and requires no Notifications-specific Genesis contract.
- **NOTIFY-INV-002** — a notification never becomes authority for the event it describes; chain/protocol state remains canonical.
- **NOTIFY-INV-003** — actionable notifications preserve source provenance and a path back to the canonical or registered origin.
- **NOTIFY-INV-004** — 420Notifications cannot sign transactions, approve spending, transfer assets, grant Smart Account capabilities or bypass Wallet confirmation.
- **NOTIFY-INV-005** — subscriptions are opt-in and reversible; source/topic/severity controls are user-controlled and promotional consent is separate.
- **NOTIFY-INV-006** — retry, fan-out and provider failover cannot create canonical events or mutate underlying protocol state.
- **NOTIFY-INV-007** — private Messenger/Commons payloads, encrypted Resource payloads, private Identity fields and raw Attention telemetry are excluded from notification indexing.
- **NOTIFY-INV-008** — subscriptions, watchlists, notification history and delivery endpoints are private by default and are not protocol state.
- **NOTIFY-INV-009** — on-chain alerts preserve chain/network identity and relevant block/transaction/log provenance plus finality context where available.
- **NOTIFY-INV-010** — reorged/reverted/superseded presentation may be updated through append-only `finalized`, `retracted` or `superseded` signals; finalized canonical history is never rewritten.
- **NOTIFY-INV-011** — rate limiting, deduplication and abuse controls cannot redefine or suppress canonical protocol truth; users retain direct Wallet/Explorer/RPC access.
- **NOTIFY-INV-012** — notification service failure cannot block payments, swaps, bridges, governance, staking, contract interaction or any protocol operation.
- **NOTIFY-INV-013** — alternative clients and notification providers are explicitly allowed and may independently derive alerts from the same canonical sources.
- **NOTIFY-INV-014** — replay checkpoints are consumer-owned, chain-bound, opaque and non-authoritative; a batch advances its checkpoint only after successful processing.

## NOTIFY-1 — runtime/service scaffold

Implemented configuration validation, service lifecycle, `/healthz` and `/readyz`, chain/indexer identity validation, HTTP indexer probing and fail-closed startup. The service remains noncanonical, starts unready, rejects wrong-chain or unavailable indexer dependencies, and only becomes ready after the configured public indexer boundary qualifies.

Runtime entrypoint: `notifications/cmd/notifications420`.

Required environment:

- `NOTIFICATIONS_CHAIN_ID`
- `NOTIFICATIONS_INDEXER_URL`

Optional environment:

- `NOTIFICATIONS_LISTEN_ADDR` (default `:8421`)
- `NOTIFICATIONS_REQUEST_TIMEOUT` (default `5s`)

## NOTIFY-2 — subscription engine

Implemented an in-memory private subscription model/store with explicit opt-in activation; source/topic/event filters; minimum severity; in-app/web/push channel preferences; deterministic normalization; reversible mute/unmute; unsubscribe; operational consent; and promotional consent that is independent and off unless explicitly granted. The store clones mutable slices on read/write so callers cannot mutate private subscription state by retaining references. Subscription data remains noncanonical and is not published as chain or protocol state.

## NOTIFY-3 — indexer ingestion + replay

Implemented a public-indexer replay processor modeled on the qualified `NotificationsConsumerAdapter420` contract. Event batches must use stream version `v1`, remain explicitly non-authoritative, identify `protocol` as their source and preserve valid event/provenance identity. Chain mismatch, malformed envelopes or invalid provenance fail before checkpoint advancement.

Replay checkpoints are consumer-owned, chain-bound and non-authoritative. Restart resumes from the persisted opaque cursor, and the next cursor is saved only after every event in the batch is processed successfully. Canonicality updates accept only append-only `finalized`, `retracted` and `superseded` signals and reject authoritative, cross-chain or malformed signals.

Tests cover successful resume, failed-batch checkpoint immutability, wrong-chain rejection and canonicality-signal validation.

## NOTIFY-4 — delivery queue + retry/dedup

Implement deterministic enqueue keys across subscription/event/provider/destination, bounded retry/backoff, dead-letter state, severity/priority handling, rate limits and isolation so one failing destination cannot block other subscriptions or indexer replay.

## NOTIFY-5 — provider-neutral delivery adapters

Define provider interfaces and Genesis adapters for in-app/web/mobile-push delivery. Keep future email/SMS/Messenger transports pluggable. No provider becomes canonical or receives protocol authority.

## NOTIFY-6 — provenance + security

Require source attribution, network identity, canonical links, anti-spoofing metadata, hostile-link validation and safe action handoffs. Actions are deep links/handoffs only; Wallet or the originating app performs authorization.

## NOTIFY-7 — API + feed/history

Expose subscription CRUD, notification feed/history, read/unread state, delivery status, source/provenance details and replay-safe pagination. API state is presentation/delivery state only.

## NOTIFY-8 — privacy + abuse hardening

Minimize wallet-address-to-provider-endpoint correlation, enforce private-source exclusions, validate hostile metadata, add abuse/rate controls, degraded-mode semantics and failure isolation.

## NOTIFY-9 — Genesis frontend

Build a notification centre with unread badge, feed filters, severity/source indicators, finality/retraction/superseded states, provenance links, subscription/preferences controls and safe Wallet/origin-app handoff.

## NOTIFY-10 — qualification, reconciliation + closeout

Run the full NOTIFY invariant suite, deterministic replay/dedup tests, restart and failure-injection tests, provider failure isolation and privacy/security checks. Produce testnet readiness evidence, reconcile the long-lived branch with latest `main`, requalify the exact final head and merge once at phase end.
