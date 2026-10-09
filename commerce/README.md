# 420Commerce service (COM-3)

Node 24, SQLite WAL transactional persistence, public PNG media and AES-256-GCM
private delivery. A single service process owns a database file on a private
persistent volume. This is an executable service and SDK, not a deployment or
live settlement claim. No new Commerce service ID, Genesis address, chain indexer,
merchant financial identity, order ledger, signing key or funds custody.

## Build and targeted qualification

```
npm ci --prefix commerce --ignore-scripts
npm ci --prefix packages/420-sdk --ignore-scripts
npm ci --prefix 420-indexer --ignore-scripts
FOUNDRY_PROFILE=pr python scripts/commerce/qualify-service.py
```

The qualifier builds only eight consumed contract ABIs and their complete import
closure, checks production sizes, builds the SDK and shared Indexer, runs affected
Indexer regressions and all retained SDK/Commerce tests, including real HTTP and
file-backed SQLite restart/replay. It does not run full Foundry inventories.
Run `npm audit --prefix commerce --audit-level=moderate` and equivalent SDK/Indexer
audits. Local standalone `npm test --prefix commerce` requires the compiled shared
Indexer/SDK and `COMMERCE_ARTIFACT_DIR` from the qualifier; ABI qualification never
silently skips missing artifacts. CI performs every required gate on the exact
checked-out implementation SHA.

## Configuration and startup

Supply an externally approved deployment manifest, SHA-256 of its exact bytes,
private persistent database path and a 32-byte delivery encryption key through:

```
COMMERCE_MANIFEST_FILE
COMMERCE_MANIFEST_SHA256
COMMERCE_DB_FILE
COMMERCE_DELIVERY_KEY_HEX
PORT
```

The manifest has `environment`, positive decimal `chainId`, `origin`, `rpcUrl`,
`indexerUrl`, `startHeight`, `startParentHash`, `registry:{address,codeHash}` and
`contracts`. All eight keys in `src/authority.mjs:ABIS` are mandatory; each contains
`address`, runtime `codeHash`, `verified:true`, and exact raw ABI-encoded
`protocolVersion()` `versionResult`. The three Pay registries additionally require
their canonical `PayIds420` `componentId` and `[major,minor,patch]` `registryVersion`.
The three values are checked against live Registry component/active authority.
Market contracts are deployment-manifest bindings with approved policy/reporter
and immutable wiring checks; this does not add them to frozen Genesis membership.
`globalTaxonomy` optionally supplies reviewed presentation-only `{id,slug,parent?,order}`
records. Merchant menus cannot overwrite global taxonomy. No guessed deployment
addresses or placeholder manifest is shipped. A real approved COM-2 reporter
deployment is needed for sensitive runtime capabilities.

After builds, `npm start --prefix commerce` validates authority and initial shared
Indexer ingestion before listening on loopback. Put an approved TLS reverse proxy
in front. The API uses a single exact Origin allowlist, no credential cookies, no
implicit CORS, request/size/time/concurrency limits and per-peer rate limits; the
proxy must enforce per-client rate limits without trusting arbitrary forwarding
headers. Secrets remain on the server, never in SDK/frontend configuration.

Canonical reads pin `finalized` block hashes with EIP-1898 `requireCanonical` and
refuse stale (>120 seconds), wrong-chain, missing-code, version/Registry/wiring
mismatches or unsupported RPC. There is no fallback to `latest`. Protocol
availability, policy and reporter status are re-read for each checkout plan.
RPC transport requests time out after five seconds and a snapshot expires after
ten seconds, including its subsequent reads; delayed results cannot authorize writes.

## API v1

All JSON responses use `{schema:"420-commerce-api-v1",data}` or an error code.
No SQL text, signatures, delivery plaintext or internal exceptions are logged.

| Method/path | Purpose and authority |
| --- | --- |
| POST `/v1/auth/challenge` | Two-minute, one-use wallet nonce |
| GET `/v1/health` | Derived ready/stale/halted provenance |
| GET `/v1/categories` | Approved global presentation taxonomy |
| GET `/v1/storefronts`, `/v1/storefronts/{slug}` | Published metadata only |
| GET `/v1/search`, `/v1/products/{id}` | Bounded, tenant/category-filtered catalogue; derived provenance |
| GET `/v1/products/{id}/availability` | Fresh canonical Market inventory snapshot; reservation still required |
| GET `/v1/media/{id}` | Sanitized published/referenced public media only |
| POST `/v1/merchant/storefronts` | Canonical controller-bound tenant creation |
| GET/PATCH `/v1/merchant/storefronts/{store}` | Authorized draft read / versioned publication |
| POST merchant store `/branding`, `/categories`, `/products`, `/delegates`, `/media` | Versioned narrow-scope writes; public media upload takes raw bytes |
| GET merchant store `/branding`, `/categories`, `/products`, `/media`, `/media/{id}` | Narrow-scope reads and authenticated draft media preview |
| POST merchant store `/products/{product}/variants` | Distinct canonical listing bindings; no aliased finite stock |
| POST `/v1/carts` | Buyer-scoped expiring single-store cart; no stock reservation |
| POST `/v1/checkout/prepare` | Fresh listing checks; one explicit buyer `createOrder` intent per line |
| GET `/v1/checkout/{attempt}` | Canonical reservation/invoice/Pay/reporter correlation, never broadcast = paid |
| GET/PUT `/v1/checkout/{attempt}/delivery` | Buyer/current controller-only encrypted delivery, audited reads |

Public browse works without Wallet. Protected requests bind their method, full
path/query, body SHA-256, Origin, chain, wallet, nonce and expiry in an explicit
signed message. EOA `personal_sign` and canonically verified EIP-1271 contract
wallet signatures are supported. Nonces are consumed atomically. The SDK requests
explicit message approval; it never signs chain transactions automatically. A
checkout plan additionally requires a verified canonical SDK host OrderRegistry
binding, checked before returning any transaction intent.

All mutable existing entities require their version; stale concurrent writers
receive 409. Delegates are short-lived, controller-bound and limited to branding,
catalogue, categories or media; no delegate financial/publish/PII/admin rights.
Products expose the deterministic metadata manifest/hash for explicit seller
listing publication. Publication checks that exact canonical hash and revision.
SQL never changes offered/reserved/sold quantities.

Media accepts only bounded PNG/JPEG/WebP with magic-byte validation before the
decoder, limits pixels/dimensions/time/output, refuses active/animated content and
re-encodes to PNG without EXIF/GPS/ICC. It never fetches uploader URLs. Objects use
at most two concurrent decoders,
unpredictable IDs, tenant quotas and no public listing API. Shipping data uses
AEAD bound to order+store, never enters public search, logs, event stream or media;
scheduled retention removes it after 30 days. Keep encryption keys separate from
encrypted volume snapshots; apply retention to backups too. Restore tests do not
claim external cloud backup validation.

## Checkout integration boundary

Each Market order binds one listing. A multi-line single-store cart produces
separate explicit order signatures; it does not invent an aggregate contract.
No payment intent is issued before a verified canonical reservation. A generic
Commerce server cannot create a merchant invoice or settle/authorize payments.
`MERCHANT_INVOICE_PENDING` resumes after the actual merchant creates the correlated
single-use, non-FAST 420Pay invoice. `PAYMENT_SIGNATURE_REQUIRED` reports invoice
readiness, not a Pay transaction submitted by this service. COM-5 integrates the
customer payment controls; COM-6 owns merchant operations. Native 420 and optional
Swap execution use owning Pay/Swap adapters. The existing Exchange quote engine
is a different transaction schema, not a substitute Pay quote engine; the Pay
settlement adapter `quote()` explicitly reverts. This service exposes no invented
swap route, quote, slippage bypass or recipient selection. Unsupported routes remain
unavailable until a compatible approved canonical Pay quote source is bound in the
checkout phase. No live chain/payment/testnet evidence is claimed.

## Recovery, monitoring and outbox

The worker consumes `IndexerEventStream420` through existing `/v1/protocols/events`
and verifies RPC headers, not logs. It atomically commits inbox, rebuildable
catalogue/order rows, checkpoint and outbox. Empty pages preserve tail cursors;
partial-page catch-up is stale. Restart replays duplicate events without duplicate
state. Nonfinal forks rewind the shared cursor, retain orphan provenance and
invalidate pending deliveries; attempted/delivered handoffs receive explicit
retractions and a new generation on reapplication. Consumers must implement
idempotency keys and retraction semantics; no external exactly-once claim is made.
`deliverOutbox(sink)` is the explicit app integration point for qualified Search/
Notifications adapters. Local search already uses the transactional catalogue.

Finalized mismatch/unknown ancestry halts sensitive writes and emits an audit
operation. `/v1/health` plus structured `commerce_projection_unavailable` events
support monitoring without private data. Investigate before recovery; use
`Projection.rebuild()` only after verifying every retained header against canonical
RPC. Never erase a finalized mismatch or substitute an empty green projection.
Stop the process, snapshot the private database+WAL coherently, restore in isolation,
revalidate manifest/chain, replay from the retained shared Indexer checkpoint, and
compare inbox hash/row counts/finality/lifecycle before enabling traffic. Corrupted
payload hashes fail rebuild. SIGTERM stops polling and drains HTTP before closing
SQLite. Horizontal writers, live deployment, cloud backup drills, soak/load and
independent security review belong to COM-7/8 qualification, not a claimed COM-3
production deployment.

## COM-4 builder handoff

The executable merchant client now lives in `commerce/web`; see its README for
approved-manifest build, same-origin proxy, Wallet review, accessibility and
qualification commands. New authenticated endpoints are:

- `GET /v1/merchant/identity/{merchantId}`: unregistered identity or verified
  controller's merchant/store reference; no cross-controller tenant lookup.
- `POST /v1/merchant/registration`: fresh canonical `register` transaction plan;
  caller explicitly reviews/signs in Wallet. No backend chain mutation.
- `GET /v1/merchant/storefronts/{storeId}/builder`: only the delegate's granted
  sections; controller also receives publication/delegation rights.
- `GET /v1/merchant/storefronts/{storeId}/listings/{listingId}`: seller-bound
  finalized listing and inventory read, including private draft inventory.
- `POST /v1/merchant/storefronts/{storeId}/products/{productId}/listing-plan`:
  product-version/hash-pinned create/revise plan with canonical ABI calldata,
  controller, verified target, policy/adapter validation and bounded expiry.

SQLite schema 2 adds immutable `store_releases`, backfilling already published
schema-1 stores atomically. Store branding and collection edits remain drafts;
explicit store publication releases them together. Public search uses released
descriptions, and public media reads require current released branding or a
published product reference. `designVersion` and `categoryVersions` on store
publication pin the reviewed saved design; mismatches fail with `design_conflict`.
Previously released branding may be restored to a new private draft. Products
keep their existing independent explicit publication gates and immutable canonical
listing bindings; no historical design operation restores economic/stock state.

Protected browser GET may omit Origin only with `Sec-Fetch-Site: same-origin` and
exact configured Host; all existing signature/nonce/tenant checks still apply.
SDK requests omit cookies. The proxy must preserve Host, enforce HTTPS, and never
substitute forwarding metadata for Wallet authorization. Same-origin deployments
are required by the builder's approved manifest and CSP.
