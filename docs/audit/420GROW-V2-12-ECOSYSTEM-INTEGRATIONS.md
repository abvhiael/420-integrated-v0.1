# GROW-V2-12 — Ecosystem integrations and notifications

**Canonical step:** GROW-V2-12 — Ecosystem integrations and notifications; app-scoped Level 1 audit. Integration is *provider-neutral* pending separately qualified service deployments. This does not certify any live external 420Notifications/420AI/420Registry/Wallet/Indexer/Search/RPC endpoint or delivery to an end user.

## Verified repository foundation and ownership

The existing 420Notifications service owns recipient consent, subscriptions, delivery, durable idempotency and externally observed receipts. Grow must not independently invent recipients or publish tenant-private plant data to public 420Location, Registry or Search. Existing 420Grow V2-11 AI service supplies a trusted opt-in recommendation boundary; its external live AI compute/provider integration remains separately testnet/operationally gated. GROW-V2-12 supplies a durable tenant-private event projection and notifier sink **interface** rather than pretending that unrelated services are deployed together.

Implementation: `grow/integrations/{service,postgres,service_test}.go`, `grow/integrations/qualify.sql`, ordered checksummed migration `0011_ecosystem_outbox.up.sql`, and app-specific `420grow-v2-fast.yml`. No Genesis smart contracts, frozen addresses, public map interfaces or production endpoint configurations are modified.

### Event and permission contract

- Explicit tenant/facility/zone/subject opt-in is mandatory for private event queueing. Only verified active PlantWrite grants may opt in/out or enqueue. Revocation removes queued/in-flight delivery eligibility; cannot retroactively recall a request already accepted by a provider.
- The queue accepts only narrow typed source references: `HARVEST_RECORDED` (observed harvest), `EQUIPMENT_ALERT` (registered equipment), and `AI_REVIEW_READY` (review audit entry). PostgreSQL checks the corresponding source exists within the identical tenant/facility/zone and opt-in scope. There is no generic body, photo, location, credential, medical data or prompt field.
- Durable outbox records are forced RLS tenant-private, keyed by tenant/event UUID; replays are rejected. The notifier receives only a stable tenant/facility/zone, type and source/event reference; a downstream subscription service must independently verify user-recipient authority and consent. The producer does **not** choose a recipient.
- Worker execution requires an explicit WorkerVerifier. A claimed item is leased, concurrency-selected via `SKIP LOCKED`, and acknowledged only by its worker token while the lease is valid. Attempts are capped at four, failures use quadratic retry backoff, and expired claims may be reprocessed. Idempotent stable event IDs are required downstream: exactly-once *user delivery* cannot be inferred from a local outbox.
- A successful adapter response records `ACCEPTED`, **not** recipient delivery. A provider timeout/failure stays retryable or becomes `DEAD`; no success is fabricated. A missing worker verifier, missing notifier, revoked consent, invalid source or unauthorized caller fails closed.
- All messages are advisory/notification-only and cannot actuate equipment, sign transactions, debit tokens, trigger nutrition/irrigation changes or publicize private grow activity.

### Targeted qualification and external gates

Level 1 uses the same exact-SHA Grow V2 and retained Grow workflows. The V2 step runs Go unit/race/vet/strict formatting and PostgreSQL migration/replay/RLS/source/opt-out checks. Negative cases include cross-tenant attempts, untrusted workers, nonconsensual queueing, idempotency replay, bad event kinds, missing providers and provider failure.

No new Level 2 milestone was scheduled at V2-12; the existing V2-10 cumulative Level 2 remains valid. Actual recipient-level 420Notifications transport delivery, identity subscription binding, live authenticated RPC/SSE/webhook operation, 420AI inference hosting, Wallet/Registry/Verify/Search integration, Cloudflare/frontend consumer end-to-end tests, replay under multi-worker production crashes and operational secret custody require named adapters and production-equivalent testnet evidence before claims of live readiness. Never claim these are deployed from an in-process contract.

Level 3 remains GROW-V2-15; V2-16 is the production-equivalent deployment/acceptance gate. The next canonical roadmap step is **GROW-V2-13 — Full cultivation dashboard and mobile UX**.
