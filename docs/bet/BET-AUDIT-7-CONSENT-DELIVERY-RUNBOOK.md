# 420Bet ⇄ 420Notifications / 420Mail — private consent and provider deployment runbook

**2026-11-10 · Implementation/predeployment only · official testnet and production gates OPEN**

## Roles and service boundary

1. **Cloudflare 420Bet Worker**: same-origin `POST /api/420bet/consent/challenge` and `/confirm`, disabled unless `BET_CONSENT_ENABLED=true`. Proxy sends the edge secret to a private HTTPS enrollment backend, never to the browser.
2. **420Bet consent enrollment broker**: `npm run serve:consent`; local loopback Node API at `/v1/420bet/consent/challenge` and `/confirm`. Rejects bad Origin, untrusted edge token, oversized requests, cross-account wallets, unsupported chain and challenge/recipient/policy tampering. User must explicitly request a wallet signature; a page load cannot enroll them. The wallet message expressly excludes wagering or transfer powers.
3. **420Identity**: wallet signature is checked using the approved EOA/EIP-1271 signature verifier and a separately approved chain RPC. The broker resolves the wallet to an independent 420Identity subject, not a browser-reported user ID.
4. **420Notifications**: the private Go `/v1/420bet/enrollments/commit` API checks a separate broker bearer token, domain-separated HMAC, exact signed assertion, expiry and a durably consumed nonce. Consent is one-shot and revocation creates an ordered durable cancellation event. The older operator `/subscriptions/apply` endpoint **cannot create, reactivate, unmute or upgrade consent**, even if the operator has its write token.
5. **420Mail**: message sender identity is still verified against the actual Go Mail actor boundary. Mail's local `DELIVERED` status denotes service mailbox delivery, **not external SMTP inbox arrival**.
6. **420Notifications provider**: regular `/deliveries/send` persists pending work only. A separately authorized downstream provider uses `POST /v1/420bet/provider-receipts/claim` (body `{"limit":1..50}`, independent provider bearer token) to lease consent-eligible deliveries. It must check active consent *again immediately before external transmission*, honor `idempotencyKey`, and maintain its own external delivery receipts. It sends `POST /v1/420bet/provider-receipts/confirm` using the independently held token and a signed, scoped acknowledgement. A callback is accepted only for a pending exact delivery and cannot revive a cancelled record. Signed receipt transitions can be `delivered` or `failed`. The provider's 30-second claim lease is durable across restarts. No provider is selected or deployed by this repository change.

## Sensitive environment variables (never check actual values into Git)

| Service | Required settings |
| --- | --- |
| Cloudflare Worker | `BET_CONSENT_ENABLED`, `BET_CONSENT_BACKEND_URL` (approved HTTPS), `BET_CONSENT_BACKEND_TOKEN` (edge-only) |
| Node consent broker | `BET_CONSENT_CHAIN_ID`, `BET_CONSENT_RPC_URL`, `BET_CONSENT_ENROLL_ORIGIN` (public Worker origin), `BET_CONSENT_EDGE_TOKEN` (must match Worker backend token), `BET_CONSENT_CHALLENGE_KEY`, `BET_CONSENT_BROKER_KEY`, `BET_CONSENT_BROKER_TOKEN`, `BET_IDENTITY_AUTHORITY_URL`, `BET_IDENTITY_AUTHORITY_TOKEN`, `BET_NOTIFICATIONS_CONSENT_URL`, `BET_NOTIFICATIONS_CONSENT_TOKEN`, optional `BET_CONSENT_BIND_PORT` (default 8451) |
| Go 420Notifications | Existing `NOTIFICATIONS_CHAIN_ID`, `NOTIFICATIONS_INDEXER_URL`, `NOTIFICATIONS_BET_CONSENT_PATH`, `NOTIFICATIONS_BET_CONSENT_READ_TOKEN`, `NOTIFICATIONS_BET_CONSENT_WRITE_TOKEN`, `NOTIFICATIONS_BET_DELIVERY_PATH`, `NOTIFICATIONS_BET_DELIVERY_TOKEN`, plus `NOTIFICATIONS_BET_ENROLL_TOKEN`, `NOTIFICATIONS_BET_ENROLL_KEY`, `NOTIFICATIONS_BET_PROVIDER_TOKEN`, `NOTIFICATIONS_BET_PROVIDER_KEY`. Default listener is loopback `127.0.0.1:8421` |
| Node delivery worker | Existing Registry/Indexer/ownership/consent/Mail settings, durable outbox and worker state, and approved provider module. Keep all paths distinct and privately writable |

`BET_CONSENT_BROKER_TOKEN` is **identical to** `NOTIFICATIONS_BET_ENROLL_TOKEN`; `BET_CONSENT_BROKER_KEY` matches `NOTIFICATIONS_BET_ENROLL_KEY`. Keep the challenge signing key, HMAC broker key, edge token, consent read/write credentials, provider token, provider signing key, 420Mail sender token, and delivery-worker token **distinct**. Use independent vault-issued high-entropy secrets and role-scoped access. Never use real keys in tests or docs.

Provider evidence uses ASCII UTF-8 with newline separators:

```text
420BET-NOTIFICATION-PROVIDER-V1
tenant
userId
deliveryId
idempotencyKey
providerReceiptId
status
occurredAt
```

Sign the exact string using HMAC-SHA256 with `NOTIFICATIONS_BET_PROVIDER_KEY` and submit lowercase hexadecimal signature plus the authenticated provider token. `occurredAt` is an integer Unix epoch in **milliseconds** within the service's permitted clock skew. Only the designated provider should possess this key. A bare 420Bet app or delivery-worker token cannot confirm receipt status.

## Preconditions and deployment order

1. Finish independent security/privacy approval of the wallet-consent wording, approved Identity policy, encryption and retention, provider identity/key custody, service TLS/mTLS private routing, service-to-service rate limiting, anti-abuse controls, and verified unsubscribe/cancellation behavior.
2. Build Go services and Node dependencies from the exact reviewed SHA; install binaries/assets into protected `/opt/420integrated`. Provision separate service accounts `420notify` and `420bet`; use root-owned `/etc/420integrated/*.env` with restrictive permissions. Create durable single-writer storage `/var/lib/420integrated/notifications` and `/var/lib/420integrated/bet` before starting services.
3. Apply the reviewed templates `deploy/420bet/notifications420.service`, `consent-enrollment.service`, and `delivery-worker.service`; keep their listener and monitor sockets on private loopback or approved network paths. Do not publish internal Go or Node service endpoints.
4. Start and qualify Indexer and Registry, then Go Notifications, then private enrollment and delivery services. Confirm `/healthz` and `/readyz` behind the approved monitoring channel and verify the chain ID/source identity.
5. Test a real user authorization with the explicit wallet signature UI, verify a durable Go consent record and second-signature denial/replay denial, then revoke and check cancellation feed, queued-provider cancellation, and retained historical audit. Verify Mail actor credentials do not grant consent permissions.
6. Connect an independently operated notification provider with external send idempotency and signed receipt authority. Exercise `claim` / external send / signed `confirm` / `receipt`, crash during pending claim, revoked or muted consent, redelivery deduplication, credential rotation, downstream outage, dead letter, monitoring alarm and service restart.
7. Only after independent operational acceptance and official testnet evidence, promote the Cloudflare `BET_CONSENT_ENABLED` gate. The casino remains practice-only until all separate betting authorization and jurisdictional gates are independently approved.

## Recovery and monitoring

- An existing `.lock` denotes a potentially active writer: **never remove it automatically**. Confirm the process is dead, back up private state and audit orphaned ownership before manual recovery. One writer per state file.
- Monitor: Go `GET /healthz`, `GET /readyz`; Node worker `/healthz`, `/readyz`, `/metrics`; provider pending age and duplicate claims; delivery dead letters; revocation cursor lag; unreadable state files and readiness failures. External alert routing is an operator duty and not implemented by a systemd template.
- A provider's receipt cannot retroactively unsend a message. A disputed late delivery after cancellation requires independent incident review; the Go ledger refuses silently turning a cancelled entry into delivered.
- Protect state backups from being used to roll back consumed consent nonces, revocation tombstones or provider receipts. Recovery must reconcile forward from an authoritative retained journal; naive restoration of an older snapshot could replay user consent.
- Retention, keyed credential rotation, user-facing policy revision notices, independent privacy signoff, external provider provisioning and official network acceptance remain tracked in the canonical testnet roadmap.

**Qualification boundary:** the local tests exercise real Go subscription/delivery stores and Node request paths with controlled identity/provider fixtures. They do not prove a real push message reached a phone, a real email reached an external mailbox, or any funded on-chain lifecycle was activated.
