# 420Grow — GROW-09 developer, operator and user documentation

**Scope:** the bounded GROW-01–08 implementation on the 420Grow audit branch. This document is a code/operations guide, **not** evidence of deployed, production, testnet, Genesis or Wallet readiness. Canonical requirements and milestones remain in `docs/audit/420GROW-INITIAL-AUDIT-AND-REMEDIATION-ROADMAP.md`.

## 1. Product and architecture

420Grow is an **anonymous, read-only, non-authoritative** public discovery experience for FARM and BUSINESS Places already made public by shared 420Location (GEN-SVC-2). It does not create, edit, claim, store or verify Places. No wallet is necessary to browse.

Data path A (currently wired): Browser (`grow/web/app.js`) → configured HTTPS `GET /v1/places` → GEN-SVC-2 public 420Location response → strict public-record filter → cards/details/map.

Data path B (optional separately hosted backend, **not currently wired into web**): client → `GET /v1/grow/places` → `grow/service.New` → `grow/location.Read` → `genesis/svc2/sdk.Client.Places` → GEN-SVC-2. Service adds bounded search, category filtering and offset pagination of the upstream limited public snapshot. Never assume path B is the browser's deployed data source.

Components: `grow/location/consumer.go` is privacy/provenance validation; `grow/service/handler.go` is a read-only HTTP projection; `grow/cmd/server/main.go` is its standalone HTTP server; `grow/web` is the static UI and build/test application; `.github/workflows/420grow-fast.yml` is the app-specific qualification gate. No Grow-owned DB, indexer, event worker or mutable cache exists.

## 2. Contracts, events, identities and roles

**Contract:** none. GROW-02 selected `CONSUMER_ONLY / NO_NEW_PROTOCOL_SERVICE_ID` and GROW-06 found no approved authority-bearing smart contract. There is no Grow ABI, deployment address, frozen namespace, token, fee, escrow, reward, custody, on-chain owner or Governance role. Do not alias Grow to Location's service ID.

**Events:** Grow produces no protocol/on-chain events and does not process reorgs or consume chain transactions directly. Event consistency and private/public visibility remain upstream responsibilities.

**Roles:** anonymous visitor can read public records; trusted GEN-SVC-2/420Location publisher determines whether a record is public before Grow receives it; Grow operator configures read-only HTTPS ingress/egress and incident response but cannot grant Place ownership or verification through Grow. Unsupported: Wallet launch, claiming, publishing, payment and editing.

**Registry/Verify:** `source` and optional `registryRecordId` are origin references only, never independent 420Verify attestation or business legitimacy. Where a future approved feature displays chain-specific state, network identity must be verified before display or action; current release does not represent any chain-derived verification.

## 3. API and SDK contracts

Shared source: `genesis/svc2/sdk.Client.Places(ctx)` fetches `GET /v1/places`; versioned payload `{ "version": "v1", "data": { "items": [...], "empty": false } }`. The canonical SDK/public adapter validates upstream category, kind, ID, source, pin latitude/longitude, and area-only coarse place data. It rejects malformed records and mixed responses in full; no silent partial rendering. Max upstream 500 items.

Grow service: `GET /v1/grow/places?category=FARM&query=Prairie&limit=50&offset=0`. Category `ALL`, `FARM`, `BUSINESS` or omitted; `query` max 120 bytes; `limit` 1–100 (default 50); `offset` 0–100000 (default zero). Unknown or repeated params yield HTTP 400; non-GET 405 with `Allow: GET`; unknown route 404; unavailable source 503; inconsistent provenance/projection 502. Errors are generic to avoid leaking upstream secrets. Success envelope `{"version":"v1","data":{"items":[],"empty":true,"total":0}}`; when a next page exists `nextOffset` is included. `total` counts filtered matches before pagination, not all 420Location records. `empty` indicates the **returned page**, so a beyond-end offset can yield empty with nonzero total.

Public card fields: `id`, `name`, `category`, `source`, optional `registryRecordId`, `kind` (`pin` or `area`), coarse `city`/`region`/`country`, and only when an upstream public `pin` exists, `latitude`/`longitude`. Omission is not authorization to geocode or infer exact coordinates.

**Limits:** the backend re-reads an upstream 500-item snapshot for each request, so offset pagination across source changes is not snapshot-stable; it is not cursor pagination for the entire global catalog. Browser currently reads shared `/v1/places`, not the Grow service's paginated contract.

## 4. Build, install and local testing

Go version is determined by repository `go.mod`; Node 22 is used in the Grow fast workflow. From a **clean repository checkout**:

```sh
go build ./grow/location ./grow/service ./grow/cmd/server
go test ./grow/... ./genesis/svc2/sdk/... ./location/...
go test -race -count=1 ./grow/... ./genesis/svc2/sdk/... ./location/...
go vet ./grow/... ./genesis/svc2/sdk/... ./location/...
test -z "$(gofmt -l grow/location/*.go grow/service/*.go grow/cmd/server/*.go)"
cd grow/web && npm run qualify
```

`grow/web/package.json` has no third-party npm dependencies or required npm install. `npm run qualify` runs JavaScript syntax, UI/security tests and the static `dist/` build. The fast CI additionally runs ten selected negative/failure-path repetitions, Python verification scripts GROW-01/02/06/07/08, and syntax checks. The narrow Level-1/2 app workflow is separate from future Level-3 full repository qualification. Do not assert skipped, queued, stale or cancelled checks as PASS.

## 5. Environment, startup and deployment boundaries

**Backend:** `GROW_LOCATION_BASE_URL` is mandatory and must be a clean HTTPS origin serving GEN-SVC-2 public `/v1/places`. Do not embed credentials in it. `GROW_LISTEN_ADDR` defaults to loopback `127.0.0.1:8080`. Start with `GROW_LOCATION_BASE_URL=https://YOUR_APPROVED_PUBLIC_420LOCATION_ORIGIN go run ./grow/cmd/server` (placeholder is not a live URL). Use an approved ingress or reverse proxy with TLS, host firewall, access logs, rate limits and public-only source policy before any external binding; no port publication is implied by a passing build. Service requires graceful SIGINT/SIGTERM, has bounded HTTP timeouts and refuses upstream redirects.

**Browser:** `grow/web/runtime-config.js` is intentionally `enabled:false` and `locationBaseUrl:""`; unconfigured or unavailable sources display an unavailable state, never sample Places. Only explicitly approved public HTTPS source origins should be enabled; cross-origin use needs upstream CORS and explicit approval. Source API version and JSON MIME type must match. `grow/web/scripts/build.mjs` produces static `dist/` including `_headers`; the host must actually honor those security headers. A production same-origin proxy can expose `/v1/places`; do not change the browser to `/v1/grow/places` without implementing and qualifying its different pagination envelope.

**No deployed provenance exists under GROW-09.** Testnet/production DNS, TLS certificate, approved public endpoint, environment-specific config, binary digests, chain/Registry mapping where applicable, Cloudflare project settings, live monitoring and rollback exercises are GROW-10 gates, not presumed complete here.

## 6. Operations and incident response

Monitor public endpoint availability, GET response status rates, request latency/timeouts, unexpected empty counts, projection rejection counts, HTTPS/CORS failures and frontend console errors. Ensure logs record request timing/status only, **not** raw upstream credentials, detailed private Place payloads, full IP-sensitive analytics or user-supplied personal data. Do not surface upstream exception strings to clients.

If upstream fails: expect sanitized 503 and UI unavailable notice, verify public source connectivity, URL origin/TLS, source schema/version and upstream data visibility without disabling the validation gates. If malformed records cause 502/503, fix the source or adapter and requalify exact SHA; never switch to private DB fallback or silently remove invalid records. If source leakage is suspected: disable the public endpoint/feature, investigate upstream visibility and privacy controls, preserve redacted evidence, notify operators, deploy only after corrective qualification.

Rollback: preserve the last approved static build digest and backend image/binary SHA; disable browser `enabled` or withdraw ingress if necessary; restore prior known-good immutable artifact; re-run public privacy and source integration tests before re-enabling. Actual rollback procedure rehearsal and specific monitoring destinations are GROW-10 deliverables.

## 7. Threat model and invariants

| Threat | Required defensive boundary |
|---|---|
| Private location disclosed via approximate record | Area cards must carry no lat/lon; invalid shared feed fails entirely |
| Record spoofing / source forgery | Validate ID/category/source and retain opaque source; never claim endorsement |
| Duplicate, malformed or unknown upstream type | Fail closed; no guessed types or sample data |
| Malicious source HTML / script injection | Browser uses textContent and a restrictive CSP; no innerHTML |
| Unauthorized server-side redirects / credentials | HTTPS clean source origin, no redirect following and no embedded secrets |
| Denial of service from queries/responses | bounded filter/limit/offset, upstream item limit, timeouts; gateway rate limiting for deployment |
| Wrong-network, wallet privilege or chain write | no wallet action, chain claim, Grow service ID or contract; fail closed until a separately approved protocol decision |
| Replay/duplicate payments, reorg, accounting | not applicable: no writes, events, balances or settlement on Grow |
| Stale pagination and forged verification | snapshot-local only; Registry reference explicitly not a Verify proof |

App tests and code guards establish repository-level invariants, **not** deployed security, external penetration testing or accessibility certification.

## 8. User guide

Open the Grow website. If no approved source is connected, the directory explains that public Places are unavailable; a visitor should retry later instead of assuming no businesses exist. When a real source is configured, search names or regions, filter Farms or Businesses, choose list or schematic map, and select a card for location precision, stable ID and provenance. **Only exact public pins** offer an external map link. Approximate regional records are text-only. Place listing is not an endorsement or independent verification. No account or wallet is required, and editing, ownership claims, payment and publishing are not supported.

Accessibility design includes labelled search/filter controls, keyboard operability, skip link, focus-visible indicators, aria-live state and mobile CSS. Real screen reader/browser/device testing is still a GROW-10 gate.

## 9. Known limitations and release gates

- No live public endpoint, deployment URL, environment-specific CORS, monitoring, rollback rehearsal, production attestation or external system acceptance demonstrated.
- Browser cannot automatically use the paginated Grow service without a separately tested adapter/proxy.
- Only source-public Places within a single 500-item upstream snapshot; offset pagination is not stable across updates.
- No ownership, Grow wallet launch, independent 420Verify proof, claims, editing, subscriptions or financial operations.
- Level-2 app integration checkpoint was GROW-03–07; GROW-08 clean checkout/race/security app suite has separate exact-SHA evidence.
- GROW-10 retains deployment/stage gating; comprehensive Level-3 main reconciliation, canonical Solidity inventory and separate Genesis address authority occur only at final app-phase closeout.

**Related specs:** GROW-01 product; GROW-02 identity; GROW-03 public Location; GROW-04 UX; GROW-05 service; GROW-06 contract decision; GROW-07 integration matrix; GROW-08 CI and audit roadmap. **Next step:** GROW-10 — Deployment and stage qualification.
