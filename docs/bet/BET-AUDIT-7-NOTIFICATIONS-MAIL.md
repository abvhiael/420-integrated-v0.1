# BET-AUDIT-7 — 420Notifications / 420Mail delivery integration

**Implementation:** `clients/420bet-lobby/server/notifications-mail-adapters.mjs`, `notifications-mail-outbox.mjs`, `notifications-mail-source.mjs`, `notifications-mail-runtime.mjs`.

**Disposition:** repository-side event, consent, Mail HTTP delivery, durable retry/revocation and Notifications adapter boundary implemented. **Not live**: no real qualified 420Notifications delivery ingress or externally certified private-owner/consent service, real 420Mail account/token broker or production provider endpoints are asserted. Testnet/operational acceptance is separately tracked as `TN-BET-7-NOTIFY-MAIL` in the canonical roadmap. No mail or push delivery is enabled by importing these modules.

## Canonical integration boundaries

- **420Indexer / 420Registry:** `notifications-mail-source.mjs` requires the read-only Indexer event reader's verified finalized event logs and receipts, a fresh `qualified:true` signed Registry manifest, and exact emitting-contract ID/role/address/deployment-height matching. A detected canonical reorganization freezes the private outbox before any new recipient delivery. It does not invent recipient ownership from an event ID, poker hand ID, fantasy pool or sportsbook ticket.
- **420Identity / private consent:** `resolveAudience` is a required independent trusted service boundary. It must establish subject/wallet/game-version ownership and tenant-scoped subscriptions; an event with a canonical account topic must match the resolved account. `checkConsent` is a separate required private subscription authority; it must verify exact tenant, subject, subscription, recipient, channel, current policy version, opt-in, no mute and no revocation at **enqueue and dispatch**. No browser-supplied recipient lists, raw email addresses, financial telemetry or message contents are trusted.
- **420Mail:** `create420MailProvider` calls the **existing** `POST /v1/outbox`, `POST /v1/outbox/{id}/process`, `GET /v1/outbox/{id}` and `POST /v1/outbox/{id}/cancel` APIs on `mail/http.go`. The source must be the actual frozen `420/service/mail/v1` and sender must be the independently authenticated Mail identity. The message is a harmless fixed phrase (no player address, event hashes, financial amount or bet details). The sender-scoped idempotency key is deterministic. Mail delivery is not marked delivered until the actual owner-bound Mail outbox receipt says `DELIVERED`.
- **420Notifications:** the existing Go service has private subscription, queue, delivery adapter and feed primitives but its current runtime HTTP surface exposes `/healthz` and `/readyz` only; **it has no qualified external per-user deliver/cancel/receipt transport yet**. `create420NotificationsProvider` therefore requires explicit authenticated `deliverAuthenticated`, `readReceipt`, `cancelDelivery` callbacks supplied by a separately approved integration layer. The adapter verifies tenant/subscription/idempotency and provider receipts and rejects unknown/forged statuses. **It does not claim to call a nonexistent HTTP endpoint.** Establishing the service-native endpoint/provider integration and its production acceptance is still required before any live Notifications messages can be sent.

## Durable delivery state and lifecycle

`openBetDeliveryOutbox` creates a private filesystem-backed, atomic (fsync + rename), single-writer `0600` outbox, rejects group/world-writable parent directories, and refuses an existing writer lock. It bounds state and delivery batch sizes and allows only one writer. Operator recovery of an orphaned lock must be explicit, not an automatic second-writer takeover. Multi-replica operation requires a transactional shared outbox backend and cannot simply share a JSON file across instances.

State: `pending` → `dispatching` → `delivered`, `pending_receipt`, `retry` or `dead_letter`. An ambiguous remote status is **pending**, never a delivery success. Restarted in-flight items are requeued with the **same downstream idempotency key**. Failed deliveries retry with bounded exponential backoff and ultimately move to dead-letter. Provider diagnostic error bodies, credentials and private payloads are not retained.

`cancel(key)`, `revokeSubscription({tenant,userId,subscriptionId})` and `retractEvent(eventId)` preserve durable cancellation tombstones, call remote cancellation when a receipt exists and report remote cancellation as **unconfirmed** unless actually acknowledged. Already-delivered messages cannot be unsent: the original receipt is preserved and flagged `retracted:true`. A canonical reorg persists an outbox halt; `resumeAfterCanonicalReplay(verifyCanonicalRebuild)` requires a fresh trusted full replay decision. If a message has already arrived before an orphan was discovered, an additional compensating notice is necessary; source-only cancellation is not retroactive.

There are no funds, balances, stake amounts, payout verdicts, player wallet addresses, personal email addresses, private Messenger content, signing keys or Wallet transaction capabilities in an approved delivery envelope. Exact transaction and block identities are used only inside independent event-verification boundaries; the recipient-facing envelope contains a pseudonymous event digest, game label, chain and finalized block height.

## Operation / dependency injection

`createBetNotificationsMailRuntime` requires the already-approved `BET_REGISTRY_*` settings plus:

| Input | Purpose |
| --- | --- |
| `BET_INDEXER_EVENT_MANIFEST` | Real Indexer v1 finalized source mapping, checked against signed Registry |
| `BET_INDEXER_EVENT_CHECKPOINT` | Canonical private Indexer checkpoint with verified receipt/block history |
| `BET_DELIVERY_OUTBOX_PATH` | Private durable, writable, single-writer outbox file path |
| `BET_MAIL_URL` | Qualified authenticated HTTPS 420Mail root origin |
| `resolveAudience` | Independently authenticated canonical ownership/recipient lookup |
| `checkConsent` | Tenant/subject/private subscription authority, freshly evaluated |
| `authorizeMailActor` | Qualified Mail identity broker returning sender and server-only Authorization header |
| `notifications.deliverAuthenticated/readReceipt/cancelDelivery` | Qualified 420Notifications actual delivery, receipt and revocation adapter |

No default Mail credentials, consent, test user, provider link, email address or 420Notifications endpoint are fabricated; missing one fails startup. A trusted worker calls `runtime.publish()` to verify new finalized Indexer records and queue verified owner-specific deliveries, and `runtime.drain()` to reconcile actual provider receipts, followed by `runtime.stop()` for lock release. Run as a backend only; never expose the outbox or remote service credentials to browser routes.

## Local qualification and remaining release work

`tests/notifications-mail-integration.test.mjs`, `tests/notifications-mail-source.test.mjs` and `tests/notifications-mail-runtime.test.mjs` test redaction, exact tenant/recipient scope, opt-in/mute/revoke rejection, replay and duplicate suppression, permissions/restart, bounded failure/dead-letter, delayed delivery receipts, Mail outbox transport and cancellation, sourced Indexer and Registry checks, ownership mismatch, reorg halt and unconfigured-provider refusal.

Real deployment must preserve the canonical Registry+Indexer source trust chain and independently qualified Identity consent/ownership and Mail actor authority. The **Notifications service HTTP delivery bridge**, real qualified provider credentials, external cancellation behavior, multi-instance persistence, live reorg/supersession drills, and final signed operational acceptance remain prerequisites. Local defects and tests are not relabeled as testnet-only.
