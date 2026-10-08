# GROW-05 — Service layer specification and qualification

**Canonical roadmap:** GROW-05 — Service layer. Preserve the ordered GROW-01..GROW-10 roadmap. **Qualification:** Level 1 app/service-scoped; no new authority-bearing contracts or consensus integrations.

## Required service responsibilities

GROW-01/02 define 420Grow as a non-authoritative, read-only public consumer. GROW-03 implements strict filtering/visibility/coordinate validation over the existing GEN-SVC-2 public `sdk.Client.Places`. GROW-04 provides browser presentation. GROW-05 creates a separate runnable HTTP discovery service WITHOUT an independent canonical place database, worker/indexer, custody, or permission model.

- `grow/service/handler.go`: versioned `GET /v1/grow/places` endpoint; allowed `category=ALL|FARM|BUSINESS`, `query`, `limit=1..100` default 50 and `offset=0..100000` default zero. JSON `{version:"v1",data:{items,empty,total,nextOffset?}}`.
- `grow/service.New`: wraps only the public 420Location Places reader through `grow/location.Read` so private/unlisted Place objects cannot be queried as part of normal production wiring. Any other test stub implements an explicit read-only view and must not be published as a canonical source.
- `grow/cmd/server/main.go`: runnable server. Requires a clean HTTPS `GROW_LOCATION_BASE_URL`; `GROW_LISTEN_ADDR` defaults to loopback `127.0.0.1:8080`. Explicitly configure an externally reachable listener only behind the approved gateway, TLS termination, health/operations/security policy and network controls. Controlled client timeout and redirect refusal prevent redirecting the reader to an unexpected host; HTTP handler has read/write/header/idle timeouts and graceful shutdown.
- Browser/static `grow/web` remains disabled until a trusted public endpoint is configured. It is **not** magically rewired to this service or declared deployed by adding the backend handler.

## Trust / security controls

1. **No writes:** only GET route is implemented. Unknown routes, methods, query keys, duplicate parameters, invalid category, invalid offset/limit or overlong search terms are rejected.
2. **No private records:** normal deployment only depends on the existing public `420Location` SDK with GROW-03 canonical projection/precision rules. It must not fetch direct canonical records, mutate a Registry record, claim business ownership, publish credentials or invent Verify status.
3. **No raw infrastructure errors:** upstream failures become a stable generic 503, invalid projected feed becomes generic 502. Disable caching (`Cache-Control: no-store`) and content sniffing. No secret-bearing exception strings in responses.
4. **Bounded reads:** the upstream location view currently caps public places at 500; endpoint supports pagination of that bounded view, not global provider-side cursor pagination. `offset` and `limit` are bounded. Arbitrary deep offsets and uncontrolled search strings are forbidden.
5. **No accounting/idempotency/replay/reorg side effects:** this service issues only GET reads of a replaceable public projection, contains no transaction, mutation, event subscription, escrow, payment or write retry. Its only retry/failure policy is client-driven retry after errors. Reorg-sensitive authoritative state remains upstream; do not manufacture finality.
6. **No new app DB, worker or indexer:** duplicating shared Place storage/search indexes would create a stale parallel authority; if future scope requires advanced indexing, add it through GROW-07 under explicit provenance/retention/privacy and testnet qualification.

## Acceptance / Level 1

- App-scoped `go test ./grow/service ./grow/location ./grow/cmd/server`; `go vet ./grow/service ./grow/cmd/server`; deterministic Go formatting; retained GEN-SVC-2 and Location tests.
- Negative/failure-path tests cover method/query validation, stale/missing/upstream failure, pagination/filter/query semantics, information disclosure, and malformed projection.
- Syntax, UX and security regression workflows from GROW-01..04 remain intact.
- A PASS claim requires a completed exact-implementation-SHA fast workflow with successful job steps, plus an evidence-only follow-on commit referencing it. Do not treat queued, cancelled, skipped or unrelated failed jobs as green.

## Deferred/limitations

This endpoint paginates a **single capped upstream snapshot per request**, not an unlimited, persistent, cursor-stable global catalog; a changing upstream response between pages can produce duplicate/omitted entries. Durable/consistent global pagination, cache invalidation, independent Verify credentials, browser-service/gateway integration, authentication for optional future mutation APIs, and live source deployment are not claimed here. Those larger scopes are GROW-07/GROW-10 or an explicit approved product expansion; GROW-05 remains a narrow read-only service.

Level 2 app integration: at GROW-03–07 convergence. Level 3: complete app-phase closeout, with one Solidity full-inventory owner and distinct Genesis address-authority checks.

**Next canonical roadmap step:** **GROW-06 — Contracts**.
