# Native 420Notifications delivery HTTP API (pre-testnet)

The Go `notifications/runtime` package now defines a private, native authenticated delivery API that can be mounted by `Service.ConfigureDeliveryAPI(api)` **before** starting the HTTP listener. It is deliberately not enabled by `cmd/notifications420` until the upstream trusted service-identity and recipient consent/ownership sources are configured. With no delivery API attached, the running service exposes only its existing `/healthz` and `/readyz` routes. With an API attached but Indexer qualification not ready, all delivery routes return 503.

## Routes

| Route | Method | Meaning |
| --- | --- | --- |
| `/v1/deliveries` | POST | Accept a verified, owner-authorized, consented, finalized private envelope and **durably queue** it. Returns 201 on creation, 200 on identical idempotent replay, 409 if the same key names different content. |
| `/v1/deliveries/{id}` | GET | Recheck authenticated tenant and recipient ownership, then return a privacy-minimized receipt. No subject/recipient/event content is returned. |
| `/v1/deliveries/{id}/cancel` | POST | Recheck authenticated tenant and ownership and durably cancel an existing **pending** receipt, even after opt-out. Terminal delivered/failed receipts cannot be silently undone. |

`POST /v1/deliveries` accepts a JSON body (no arbitrary payload fields):

```json
{
 "tenant":"420bet",
 "userId":"canonical-private-subject",
 "subscriptionId":"approved-subscription",
 "recipient":"private-opaque-destination",
 "idempotencyKey":"64 lowercase hexadecimal characters",
 "policyVersion":"approved-consent-policy",
 "event":{
  "schema":"420bet-notification-v1",
  "kind":"wager-settled",
  "game":"casino-dice",
  "chainId":"420",
  "blockNumber":"123",
  "eventId":"64 lowercase hexadecimal characters",
  "finality":"finalized"
 }
}
```

A receipt contains `deliveryId`, `idempotencyKey`, `status` (`pending`, `delivered`, `failed` or `cancelled`) and `version`. It never exposes email addresses, wallet addresses, balances, wager amounts or signing authority. Queued and pending are NOT evidence of real external delivery.

## Authentication and private consent

`NewDeliveryAPI(store, authenticate, consent, provenance)` requires three independently supplied functions: authenticated service identity, recipient ownership/consent, and canonical event provenance. An authenticated `DeliveryPrincipal` identifies the trusted service ID and tenant. `DeliveryConsent` must verify the requesting service's real authority over the recipient, subscription and canonical user and separately decide whether current consent is active. It returns `DeliveryDecision{Owner,Consent}`. New submissions require **both** flags and a fresh independently verified `DeliveryProvenance` check against canonical finalized Indexer/Registry evidence; receipt lookup and cancellation still require `Owner` even if consent has since been revoked. A tenant-wide token by itself does **not** establish ownership.

`BearerServiceAuthenticator` is a constant-time authenticated single-service helper for local/private staging. It must be supplied a secret of at least 32 characters and an authorized server-side principal. The default `cmd/notifications420` **does not** enable the delivery API without all required settings. When configured, it installs the server credential authenticator and a strict, independent HTTPS owner/consent/provenance service transport; it never invents a positive subscription or policy. Production needs approved key custody, authorization rotation, service-level rate limits and independent Identity/Notifications subscription binding before enabling the routes.

## Durable storage and provider boundaries

`OpenDeliveryStore(path)` uses a private absolute filesystem path, a `0600` atomic/fsynced JSON file, a single-writer directory lock, bounded record retention and fail-closed startup if the file or its permissions are corrupt/unsafe. Do not share this store between instances; it is intended for explicitly supervised single-instance operation. A stale lock requires operator investigation, not automatic forced takeover. A replicated deployment needs a transactional shared store.

The native API provides durable queueing, owner-scoped receipt reads, cancellation, internal `MarkDelivered`/`MarkFailed` status transitions and restart survival. It does **not** fabricate a Mail/push provider, send on behalf of a user or mark a receipt delivered from an HTTP request. A separately qualified private worker using the existing `notifications/providers` implementation must actually dispatch, obey revocation at send-time and call `MarkDelivered` only after verified provider acknowledgement. Live provider credentials, cross-service identity/consent authority and operational acceptance remain open under `TN-BET-7-NOTIFY-MAIL`.

## Qualification

`go test ./notifications/...`, `go test -race ./notifications/...`, `go vet ./notifications/...` and `go build ./notifications/cmd/notifications420` run in `.github/workflows/notifications-audit.yml`. `delivery_api_test.go` covers authentication, readiness gate, cross-tenant/owner rejection, strict JSON, idempotency conflicts, privacy, cancellation with revoked consent, stale terminal state and persistence on restart.

**Pre-testnet follow-on:** wire actual service-owned authenticated subscription/recipient authorization and a provider worker to the new API, add distributed store if multi-instance topology is chosen, complete the retry/dead-letter and reorg delivery recovery, and rerun multi-service integration tests. These are local engineering work, not claims of a live official network.

## Optional real Go service configuration (all-or-nothing)

The `notifications/cmd/notifications420` binary mounts native delivery routes only if **all five** environment variables are supplied; any partial configuration is a startup error:

- `NOTIFICATIONS_DELIVERY_STORE` — absolute private single-writer durable receipt file path
- `NOTIFICATIONS_DELIVERY_API_TOKEN` — at least 32-character internal 420Bet bearer secret, not browser-facing
- `NOTIFICATIONS_DELIVERY_TENANT=420bet` — exact tenant binding
- `NOTIFICATIONS_DELIVERY_AUTHORITY_URL` — independently approved HTTPS authority **root origin**
- `NOTIFICATIONS_DELIVERY_AUTHORITY_TOKEN` — distinct server-to-server authority credential

The authority is **not** yet deployed by this change. It must implement three POST checks, all authenticated with the authority token and all returning scoped JSON decisions: `/v1/notifications/owner`, `/v1/notifications/consent`, and `/v1/notifications/provenance`. Request JSON contains `principal:{ServiceID,Tenant}` (Go field names) and `delivery` (as above). Responses include `approved` plus exact `tenant,userId,subscriptionId,recipient,policyVersion,eventId,chainId,serviceId`. The Go client rejects transport failures, wrong chain/owner/tenant/subscription/version or scope, and unapproved responses. Ownership is independently rechecked for receipt lookup and cancellation. If consent is revoked, the owner may still cancel their already queued notice.

An authenticated POST returning `pending` means **accepted to the private durable queue**, not delivered. Dispatch and external provider settlement remain the separate pre-testnet worker workstream. Activation also requires actual approved upstream identity/consent provenance authority and legitimate provider custody; a local positive fixture alone is not release acceptance.
