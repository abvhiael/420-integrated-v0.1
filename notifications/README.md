# 420Notifications

420Notifications is the opt-in alert and event-delivery service for 420 Integrated. It is a contract-free, non-canonical Genesis user application: it derives alerts from canonical or registered sources, preserves provenance/finality context, and never becomes authority for the event it describes or for Wallet execution.

## Architecture

The implementation is under `notifications/`:

- `architecture/` — Genesis authority/privacy boundary and NOTIFY invariants.
- `subscriptions/` — private opt-in subscription policy, mute/unmute and consent controls.
- `ingest/` — replayable 420Indexer event ingestion, chain binding and consumer checkpoints.
- `delivery/` — deterministic enqueue/dedup, retry/backoff, rate limits and dead-letter state.
- `providers/` — provider-neutral in-app/web/push delivery adapters.
- `security/` — provenance, origin/deep-link validation and Wallet-authority rejection.
- `feed/` and `api/` — private notification history/feed and service operations.
- `hardening/` — private-source exclusions, hostile metadata rejection and abuse controls.
- `runtime/` — configuration, dependency qualification, health/readiness and HTTP service.
- `web/` — embedded dependency-free Genesis notification centre.
- `cmd/notifications420/` — service entrypoint.
- `closeout/` — cross-phase Genesis qualification model.

The service requires no Notifications-specific smart contract or frozen contract address. The canonical service identifier is `420/service/notifications/v1`; service discovery does not grant protocol authority.

## Required configuration

- `NOTIFICATIONS_CHAIN_ID` — non-zero decimal target chain ID.
- `NOTIFICATIONS_INDEXER_URL` — qualified public 420Indexer endpoint.

Optional:

- `NOTIFICATIONS_LISTEN_ADDR` — defaults to `:8421`.
- `NOTIFICATIONS_REQUEST_TIMEOUT` — defaults to `5s`.

## Build and test

From a clean checkout with Go 1.23:

```sh
go test -count=1 ./notifications/...
go test -race -count=1 ./notifications/...
go vet ./notifications/...
go build ./notifications/cmd/notifications420
python3 scripts/verify-genesis-dapps.py
```

The dedicated `420Notifications Audit Qualification` workflow runs the app-local Go qualification against the exact pull-request head.

The service ID is also covered by `contracts/test/NotificationsGenesis420.t.sol` and the repository's normal Solidity qualification.

## Run locally

A reachable, matching-chain public 420Indexer endpoint is required for successful readiness:

```sh
export NOTIFICATIONS_CHAIN_ID=420
export NOTIFICATIONS_INDEXER_URL=https://indexer.example
go run ./notifications/cmd/notifications420
```

The runtime exposes liveness/readiness endpoints and the embedded notification centre/API surface. Wrong-chain or unavailable Indexer evidence fails closed.

## Authority and privacy

Notifications are presentation only. The service cannot sign transactions, transfer assets, approve spending, grant capabilities, mutate protocol state or bypass 420Wallet confirmation. Actionable notifications may only hand off to Wallet or the originating application, where normal authorization still applies.

Subscriptions, watchlists, notification history, replay checkpoints and provider endpoints are non-canonical and private by default. Private Messenger/Commons payloads, encrypted Resource payloads, private Identity fields and raw Attention telemetry are excluded from notification indexing.

## Replay, reorg and failure behavior

420Notifications consumes replayable public 420Indexer envelopes through the qualified Notifications adapter boundary. Consumer checkpoints are chain-bound and advance only after successful batch processing. Delivery uses deterministic deduplication plus bounded retry/backoff. Reorg/retraction/supersession is represented as append-only presentation updates; finalized canonical history is never rewritten.

A notification provider or the entire Notifications service may fail without blocking the underlying protocol operation. Users and operators must fall back to canonical Wallet, Explorer, RPC or originating-app state.

## Deployment order

A production-equivalent testnet sequence is:

1. freeze the target chain/genesis identity;
2. deploy and qualify the public 420Indexer;
3. deploy `notifications420` with the matching chain ID and Indexer URL;
4. configure real in-app/web/push providers and private endpoint storage;
5. exercise subscriptions, replay, deduplication, retry, rate limiting and provider failure isolation;
6. exercise reorg/retraction/supersession and restart recovery;
7. verify frontend/backend public URLs, TLS/security headers and service discovery;
8. retain exact-release deployment, configuration and live evidence.

The current repository readiness record intentionally remains pending until those live steps exist.

## Release states

Repository implementation can be code/build/test/documentation complete without being live-testnet, Genesis-operational or production ready. Live readiness requires real public endpoints, qualified 420Indexer binding, real provider operation, production-equivalent replay/reorg/restart/failure evidence and exact-release retained evidence.

Canonical roadmap: `docs/420NOTIFICATIONS-ROADMAP.md`.

Infrastructure authority model: `docs/architecture/infrastructure/observability-status-operator-services.md`.

Audit record: `docs/420NOTIFICATIONS-AUDIT.md`.


## BET-AUDIT-7 private subscription bridge (optional, not activated by default)

The existing `notifications420` process can host the new `notifications/betconsent` backend routes if `NOTIFICATIONS_BET_CONSENT_PATH`, `NOTIFICATIONS_BET_CONSENT_READ_TOKEN` and `NOTIFICATIONS_BET_CONSENT_WRITE_TOKEN` are configured. Reader and writer tokens must be different private service secrets; token possession does not prove end-user consent, so the write token belongs solely to an independently authorized consent-provisioning controller. Persistent single-writer JSON snapshots are mode 0600 with exclusive lock and permanent revocation tombstones. The authenticated `POST /v1/420bet/subscriptions/check` is consumed by 420Bet at enqueue and dispatch. `/apply` and `/revoke` require the separate writer token and monotonic revision. There is no public browser subscription API or multi-replica deployment capability. Test with `go test ./notifications/betconsent ./notifications/runtime` and the 420Bet Node consent tests; live and independent acceptance remains open.


The BET-AUDIT-7 revocation integration retains ordered withdrawal events at `POST /v1/420bet/subscriptions/revocations` behind the consent read token. The 420Bet service uses `BET_REVOCATION_POLL_MS` (default 1000, minimum 250, maximum 60000) for continuous background catch-up, plus synchronous checks at publish and drain, with a durable cursor/cancellation tombstone and remote cancellation retries. Production activation still requires independent operator authorization, deployed backend and observability; a delivery already accepted by a provider cannot be un-sent.
