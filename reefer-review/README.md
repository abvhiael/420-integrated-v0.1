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

Implemented and repository-qualified:
- deployment-supplied Wallet/420Identity verified-session boundary;
- Bearer session enforcement with ReeferReview audience, chain/network, expiry and revocation checks;
- scoped `reefer.author`, `reefer.publisher` and `reefer.moderator` capabilities;
- memory-only browser session handling through the deployment Wallet authentication gateway;
- typed Go client session-token provider with no `X-420-Actor` authentication.

Not implemented or not yet qualified:
- live deployed Wallet/420Identity verifier composition;
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
- `POST /v1/publications` — create draft; requires an author or publisher Bearer session.
- `GET /v1/publications` — public published feed; cursor pagination.
- `GET /v1/publications/{id}` — anonymous PUBLIC/UNLISTED read, or viewer-aware read when a verified Bearer session is supplied.
- `PUT /v1/publications/{id}` — author/publisher edit with ownership/capability checks.
- `POST /v1/publications/{id}/publish` — author/publisher publish after authorization and rights assertion.
- `POST /v1/publications/{id}/moderate` — moderator/publisher scoped HIDE/RESTORE.
- `POST /v1/publications/{id}/tombstone` — authorized tombstone.
- `GET /v1/editorial/publications` — scoped editorial listing.
- `GET /v1/publications/{id}/revisions` — authorized revision history.
- `GET /v1/publications/{id}/moderation` — authorized moderation history.
- `GET /readyz` — dependency/session-verifier construction readiness.

Protected routes derive identity only from a validated Wallet/420Identity Bearer session. `X-420-Actor` is not accepted as authentication authority.

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

RR-3 originally qualified against the repository-stage actor boundary. RR-4 has now replaced that browser/API boundary with verified Wallet/420Identity Bearer sessions and scoped capabilities while retaining the RR-3 editorial lifecycle.

New API surface:
- `GET /v1/editorial/publications`
- `PUT /v1/publications/{id}`
- `POST /v1/publications/{id}/tombstone`
- `GET /v1/publications/{id}/revisions`
- `GET /v1/publications/{id}/moderation`

`GET /v1/publications/{id}` is viewer-aware: anonymous readers receive only PUBLIC or UNLISTED published records; restricted, draft and hidden access requires a verified session accepted by the current authorization policy.


## RR-4 identity and permissions

ReeferReview protected editorial and moderation routes are authenticated with `Authorization: Bearer <session>`. The service never accepts `X-420-Actor` as identity authority. A deployment-supplied trusted Wallet/420Identity verifier must return claims bound to `420/service/reefer-review/v1`, the configured chain/network, current expiry/revocation state and scoped capabilities.

The browser requests credentials through `window.ReeferReviewWalletSession` and keeps the bearer token only in JavaScript memory. The typed Go client accepts a `SessionTokenProvider` and retrieves a token at request time. Neither layer mints or persists session credentials.

Live deployment wiring remains a later deployment/live-integration gate.
