# COM-1.4 — Data storage and event-indexing architecture

**Roadmap:** COM-1.4 — Data storage and event-indexing architecture. **PR:** #588. **Status:** architecture documented; Level 1 CI qualification unverified. **Reconciliation base:** `ffc6a4028676907c266714b5c1ae8ba3af9a7137` (main comparison ahead 8 / behind 0 before this change). No new executable services or migrations are claimed.

## Sources and architectural boundary

**Implementation reconciliation:** this remains the original COM-1.4 architecture
record. COM-2 subsequently implemented/qualified reporter source; COM-3 implements
the schema/service/replay/privacy/API handoff in `COM-3-SERVICE-AND-API.md` and
`commerce/README.md`. Exact-SHA service evidence is recorded separately, and no
live deployment is inferred from source implementation.

- `docs/420-MARKET-V1-MODEL.md`: canonical listing/revision, finite-inventory reservation, orders, fulfilment and dispute state; payment finality belongs to 420Pay. No private delivery content on-chain.
- `indexer/README.md`: shared indexer is a **rebuildable, non-authoritative read layer**; `indexer/model`, `indexer/core` and named RPC/store/reorg/decoder/API capabilities must be verified for actual implementation before committing a deployment design. A README's *planned packages* are not evidence that every service runs.
- `indexer/ingest/engine.go`: sequential RPC ingestion, `PutBundle` before checkpoint advancement, restart-safe idempotent replay, ancestry checking, reorg repair and finality promotion.
- `420-indexer/src/event-stream.ts`: versioned event envelopes include chain ID, block number/hash, tx hash/index, log index and contract address; `authoritative: false`; stable event ID binds the block hash, preventing canonical fork collisions.
- `docs/architecture/protocols/protocol-integration-model.md`: canonical / derived / external state separation, recovery from chain outward, no wallet/settlement rights for indexers.

## Data ownership and storage table

| Dataset | Storage/owner | Source-of-truth and access |
| --- | --- | --- |
| Listing ID, revision, seller, asset, price, quantity, state | Canonical 420 Market | On-chain; re-read authoritative contract and finalized state for security-sensitive actions |
| Order ID, buyer/seller, amount, revision, status, fulfillment/dispute commitments | Canonical 420 Market | On-chain; sensitive details excluded from commitment payload |
| Payment/invoice/refund/settlement lifecycle | Canonical 420Pay | Pay contract finality and approved reporter; web API never declares finality |
| Merchant financial controller and payout | Canonical 420Pay merchant registry | Must prove authorization for each write; store slug/avatar must not redirect settlement |
| Store slug, display name, logo, banner, theme, merchant categories | Commerce transactional database | Versioned tenant-scoped records linked to canonical seller/merchant identifiers |
| Rich product description, media, SKU, options and collections | Commerce DB + private/object media store | Versioned by listing ID + metadata commitment/revision; never silently override economic truth |
| Shopping cart, checkout session, delivery options | Commerce transactional DB | Per customer or pseudonymous session; expiring, noncanonical, validated against Market at checkout |
| Private shipping/contact/fulfilment information | Encrypted private Commerce store | Tenant isolation, authorization, retention/redaction; never on chain or public projections |
| Event history, checkpoint, projection state | Existing indexer + Commerce read database | Rebuildable projection keyed to canonical event provenance, not a second ledger |
| Product search, recommendations, analytics | Replaceable Search/Analytics projections | Derived; do not imply confirmed stock, purchase, verified merchant, or payment |
| Notifications | 420Notifications/outbox adapter | Idempotent delivery only; cannot create state transitions |

## Minimum proposed application schema (to implement in COM-3, not in this architecture-only step)

- `stores(store_id, merchant_id, controller_reference, slug_unique, status, created_at, updated_at, version)`; secure ownership/capability check; slug uniqueness and canonical merchant binding.
- `store_branding(store_id, avatar_object_id, banner_object_id, theme_id, public_description, version)`; whitelist image types, sanitize text and bound resources.
- `store_categories(category_id, store_id_nullable, parent_id_nullable, global_taxonomy_id_nullable, slug, sort_order, visibility, version)`; global taxonomy is separate from merchant-defined menu.
- `products(product_id, store_id, canonical_listing_id, listing_revision, metadata_hash, sku, description, media_manifest_id, publish_state, version)`; listing economic terms displayed from Market projection only.
- `product_variants(variant_id, product_id, option_json, canonical_listing_id_nullable, variant_sku, version)`; variants must not promise one shared finite chain quantity without a defensible inventory mapping.
- `cart_sessions(cart_id, customer_scope, store_id, expires_at, version)` and `cart_lines(cart_id, listing_id, requested_revision, quantity)`; cart is not a reserved order.
- `checkout_attempts(attempt_id, cart_id, network_id, order_id, payment_id_nullable, quote_id_nullable, idempotency_key, state, expires_at)`; unique keys scoped to customer/merchant/network; pending not paid.
- `customer_delivery(order_id, encrypted_payload_ref, access_policy_id, purge_after)`; no public address indexing.
- `event_inbox(event_id, chain_id, block_hash, tx_hash, log_index, source_contract, topic, payload_hash, finality, applied_at, canonical)`; unique provenance keys.
- `projection_checkpoints(chain_id, stream_version, cursor, canonical_block_hash, height, finalized_height, schema_version)`.
- `projection_outbox(id, event_id, operation, payload_ref, delivered_at, attempts)` for idempotent notification/search delivery.

These are **logical schema contracts**, not assertions that migrations/tables already exist. Choose actual database/media implementations after checking repository service conventions and operational requirements. Validate data classification before applying migrations.

## Event processing and reorganization contract

1. Resolve chain ID, contract address/version and canonical 420Registry discovery; reject unknown emitter or incompatible ABI. Consume the existing versioned indexer event stream; do not create a competing chain indexer.
2. Ingest event provenance `chainId, blockNumber, blockHash, txHash, transactionIndex, logIndex, contractAddress`, with an idempotent unique event key. Track topic, exact decoded schema version and finality.
3. Transactionally persist inbox event + Commerce projection state + checkpoint/outbox progress, or make replay idempotently recoverable if upstream checkpoints and Commerce DB cannot share a transaction.
4. On duplicate event: no duplicate order, settlement, stock decrement, notification or payout representation.
5. On nonfinal fork replacement: identify orphaned `blockHash` lineage, invalidate/reverse only derived rows and emitted pending notifications, replay replacement canonical events; preserve immutable audit provenance for diagnosis without falsely retaining orphan state as current.
6. On finalized mismatch or unknown ancestry: **halt affected writes and checkout finality claims**; emit operational alert. Never roll back finalized canonical history through an application database.
7. On restart/restore: establish RPC authority and Registry binding, synchronize authoritative chain, rebuild indexer and Commerce projections from replayable checkpoints, then expose only reconciled statuses.
8. Rebuild acceptance: projection counts, order-state membership, amount/asset/merchant/revision correlations, finality tags and health/freshness must match canonical source. Paginated public APIs must expose staleness/degraded signals rather than fabricated current stock.
9. Event schema upgrades must use explicit decoder versioning and additive migrations; preserve historical interpretation. Rebuild indexes/caches, not on-chain authority.

## Transactional security and privacy requirements

- Market `InventoryReservation420` alone controls economic reservations; cart quantities and SQL counters are estimates, not an independent stock authority.
- Market `recordPayment` requires approved settlement reporter; the pending Pay→Market adapter described in COM-1.3/COM-1.5 is mandatory to claim purchase finality.
- Store writes require fresh canonical controller authorization and least-privilege scoped delegation; enforce row-level/tenant checks independently of UI.
- Customer data must be encrypted and access-controlled; separate public media from private shipping attachments, disable public object listing, prevent SSRF and malicious SVG/HTML uploads, define purge/retention policy.
- Consentful geolocation only, with exact public locations not inferred from customer delivery addresses.
- API cursors, search caches, event clients and notifications do not authorize money movement or seller mutation.

## Acceptance and next phase

- [x] Reconciled existing indexer source, event schema, reorg/finality and Market/Pay ownership.
- [x] Defined Commerce logical entities, keys, privacy boundaries and concurrency semantics.
- [x] Defined idempotent event ingest, deduplication, outbox/checkpoint, reorg repair, outage/fail-closed and disaster recovery.
- [x] Distinguished source-backed existing capabilities from planned COM-3 persistence implementation.
- [ ] Exact-SHA CI job PASS: to be verified separately.
- [ ] Actual COM-3 schema migrations, integration and adversarial replay tests: future implementation, not falsely claimed done.

**Qualification:** Level 1 targeted architectural/source checks; Level 2 app integration at a meaningful milestone; Level 3 one exact accumulated COM-1.8 closeout. **COM-8/COM-9** remain live testnet/mainnet authorization handoffs.

**Next canonical step: COM-1.5 — 420Pay/Wallet/Registry/Identity/Swap integration design.**
