# 420Notifications

420Notifications is the opt-in alert and event-delivery layer for 420 Integrated. It helps users follow activity that matters to them without making the notification system authoritative for the underlying event.

## What it can notify about

- wallet and account transactions
- 420Pay invoices, payments and refunds
- 420Bridge and 420Swap state changes
- validator, stake and reward events
- 420 Civic proposals, votes and deadlines
- 420Verify verification changes
- 420AppStore releases, deprecations and security warnings
- 420Status incidents and recoveries
- registered dApp events and user-configured watch conditions

## Source of truth

Notifications are presentation messages derived from canonical or registered sources. A notification must preserve source provenance, network identity and, for on-chain events, relevant chain references such as transaction/log/block context. The notification itself never overrides chain or protocol state.

420Indexer exposes replayable, fork-sensitive event envelopes through its public projection API. 420Notifications consumes that public boundary through `NotificationsConsumerAdapter420`; it does not read index database rows directly and does not become protocol authority.

A reorged, reverted, expired or superseded event may cause an alert to be updated or marked superseded. IDX-8 canonicality signals are append-only `finalized`, `retracted` or `superseded` delivery updates. Finalized history is immutable and is not rewritten by the notification service.

## Replay and restart safety

420Notifications maintains a consumer-owned replay checkpoint per chain. The checkpoint stores only the opaque indexer cursor and is explicitly non-authoritative. It may be persisted by the notification provider or client and restored after restart without coupling to the 420Indexer database schema.

A replay batch advances its notification checkpoint only after the batch has been processed successfully. A malformed batch, including a chain mismatch, fails closed before checkpoint advancement. Replaying the same source event remains safe because delivery enqueue uses deterministic deduplication keys across subscription, event, provider and destination.

## Subscription model

Subscriptions are opt-in and reversible. Users can mute individual sources or topics, set severity thresholds and choose delivery channels. Promotional notifications require separate consent from operational/security notifications.

Subscription state, watchlists, notification history and delivery endpoints should remain private by default and may remain entirely client-local. IDX-8 subscription matching treats this state as consumer delivery policy and does not store it in canonical index projections.

## Security boundary

420Notifications cannot sign transactions, transfer assets, approve spending, grant Smart Account capabilities or bypass 420Wallet confirmation. An action button in a notification is only a deep link or handoff to 420Wallet or the originating application, where normal authorization applies.

## Privacy

Private Messenger or Commons messages, encrypted Resource Protocol payloads, private Identity fields and raw Attention telemetry are not notification index inputs. Delivery infrastructure should minimize correlation between wallet addresses and external push endpoints.

## Reliability

Providers must implement deduplication, retry safety, rate limiting, priority/severity handling and source attribution. IDX-8 provides deterministic enqueue/deduplication, bounded exponential retry, dead-letter state, rate-limit decisions and provider-neutral delivery handoffs.

A failure to enqueue or deliver one matching notification is isolated to that subscription/delivery target. It is surfaced as non-authoritative delivery failure metadata and does not block other matching subscriptions, indexer replay, or the underlying protocol operation. Users can always inspect canonical state directly through Wallet, Explorer, RPC or the originating dApp.

Alternative notification providers and clients are explicitly allowed. 420Notifications is a common Genesis service interface and user experience, not a monopoly on event delivery.
