# Reefer Review Publishing

Reefer Review is the repository baseline for the GEN-SVC consumer-service entry `420/service/reefer-review/v1`: editorial news plus Medium-style publishing.

## Authority boundary

Reefer Review is a replaceable application. Article bodies remain off-chain. It does not create identity, rights, storage, search, notification or mail authority and it has no dedicated smart contract requirement in the canonical Genesis architecture. Authority-bearing rights assertions are delegated to 420 Rights; content storage is delegated to 420 Storage; Search is a rebuildable projection.

The frozen Genesis application catalog does **not** contain Reefer Review. Repository completion therefore cannot by itself authorize Genesis release.

## Repository MVP

Implemented:
- draft creation with stable opaque IDs and sender-scoped idempotency;
- off-chain body reference plus SHA-256 digest;
- explicit visibility and publication state;
- rights assertion gate before publication;
- public Search projection hook;
- notification and internal 420Mail publication hooks;
- scoped HIDE/RESTORE moderation;
- cursor-based public list API;
- typed Go HTTP client;
- development-only thin web page;
- production fail-closed executable.

Not implemented or not yet qualified:
- live Identity/Wallet session adapter;
- encrypted/durable 420 Storage adapter;
- live 420 Rights adapter and chain provenance verification;
- deployed 420 Search/Notifications/420Mail integrations;
- production ingress/rate limiting/observability/backups;
- browser accessibility/mobile E2E;
- production/testnet deployment;
- independent security review;
- frozen-catalog Genesis promotion;
- paid external newsletters (explicitly disabled).

## API

All routes are under `/v1`.
- `POST /v1/publications` — create draft; requires `X-420-Actor` in the repository harness.
- `GET /v1/publications` — public published feed; cursor pagination.
- `GET /v1/publications/{id}` — repository harness article read.
- `POST /v1/publications/{id}/publish` — publish after authorization and rights assertion.
- `POST /v1/publications/{id}/moderate` — scoped HIDE/RESTORE.
- `GET /readyz` — dependency-construction readiness only.

`X-420-Actor` is a test/development injection boundary, not production authentication. Production must bind a validated Wallet/Identity session and reject spoofed headers at ingress.

## Build and test

```bash
go test ./reefer-review/... ./cmd/reefer-review/...
python3 scripts/verify-reefer-review-audit.py
```

Development server:
```bash
REEFER_REVIEW_DEPLOYMENT_MODE=development go run ./cmd/reefer-review
```

Any staging/production mode intentionally fails closed until live adapters are implemented and qualified.


## Persistent cannabis newsfeed (RR-1)

The repository now contains the RR-1 persistent external cannabis-news foundation.

- External stories use a distinct `ExternalNewsItem` model; they are not rewritten as ReeferReview-authored Publications.
- RSS 2.0 and Atom feeds are normalized into title/link/source/byline/summary/topic/provenance metadata.
- Full third-party article bodies are not ingested. The canonical article URL remains the reader handoff.
- `config/reefer-review-news-sources.json` is the reviewed source registry.
- `FileNewsStore` persists normalized items across process restarts and uses atomic file replacement.
- Canonical URL normalization, stable IDs, feed-GUID continuity and content fingerprints provide deduplication/replay resistance.
- Deterministic cannabis relevance filtering rejects unrelated feed entries from the public news API.
- Public news routes:
  - `GET /v1/news`
  - `GET /v1/news/{id}`
  - `GET /v1/news/sources`
  - `GET /v1/news/topics`
- One-shot ingestion is performed by `go run ./cmd/reefer-news-sync`. Background scheduling remains RR-8 and is intentionally not claimed by RR-1.

Development data defaults to `.reefer-review/news.json`. Override with `REEFER_REVIEW_NEWS_DB`.
Override the source registry path with `REEFER_REVIEW_NEWS_SOURCES`.


## Editorial publishing completion (RR-3)

RR-3 completes the repository-stage editorial lifecycle:

- browser article reader;
- editorial workspace for draft creation, revision editing and publication;
- immutable revision history;
- fresh rights assertions for published revisions;
- viewer-aware restricted reads;
- explicit TOMBSTONED lifecycle;
- moderation reasons and durable history;
- moderation dashboard;
- expanded Go client/API parity.

The browser stores only the current repository-stage actor string in session storage and sends it through the existing `X-420-Actor` development boundary. This is not production authentication. RR-4 replaces it with qualified 420Identity/Wallet sessions and capabilities.

New API surface:
- `GET /v1/editorial/publications`
- `PUT /v1/publications/{id}`
- `POST /v1/publications/{id}/tombstone`
- `GET /v1/publications/{id}/revisions`
- `GET /v1/publications/{id}/moderation`

`GET /v1/publications/{id}` is viewer-aware: anonymous readers receive only PUBLIC or UNLISTED published records; restricted, draft and hidden access requires the current repository-stage actor and authorization policy.
