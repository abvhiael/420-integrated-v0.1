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
