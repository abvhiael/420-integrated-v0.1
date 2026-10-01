# 420Exchange PRE-04 — Exchange executable quote backend and schema qualification

**Canonical roadmap:** `docs/420EXCHANGE-PRE-TESTNET-COMPLETION-ROADMAP.md`  
**Step:** PRE-04 — Exchange executable quote backend and schema  
**Completion state:** COMPLETE  
**Qualification level:** Level 1 step-specific + Level 2 Exchange integration milestone  
**Audit branch / PR:** `audit/exchange-pretestnet-phase-20260930` / PR #430  
**Audit base SHA:** `4d0ede3692efe55f04a50c7bf5b749afe579eccb`  
**Qualified implementation SHA:** `ce40f17b7ee5e15d5920b64b923171bba29826df`  
**Current repository `main` observed at closeout:** `6715d9fd3747953f298e79527fb9e86588db8d35`

## Canonical requirements and disposition

| Requirement | Disposition |
| --- | --- |
| Versioned POST `/executable-swap-quote` request/response/error schemas | SATISFIED — checked-in JSON Schema contracts define exact request fields, the complete nested response envelope and deterministic public error codes. |
| Bind chain, deployment/manifest, account, token metadata, market/route/path, raw input/output, fee components, net minimum, recipient, router/spender, builder inputs, quote ID, issue/expiry and replay domain | SATISFIED — the quote engine emits all fields explicitly and derives deterministic `quoteId`, route commitment and replay domain from canonical inputs. |
| Derive quotes from explicit route/market source, not browser display snapshots | SATISFIED — `RouteSource` and `ChainStateAdapter` are explicit provider-neutral boundaries; `createStaticRouteSource` / `createStaticChainAdapter` are offline qualification implementations only. Browser V14/V15 display snapshots are not a source. |
| Reject wrong chain, unsupported route, stale inputs, invalid token metadata, malformed raw units, unavailable dependencies and resource abuse | SATISFIED — dedicated tests cover chain mismatch, stale chain state, stale route source, deployment mismatch, route mismatch/absence, route-hop and route-data bounds, token eligibility, raw-unit validation, minimum-output failure, dependency failures, request/response size limits and rate limiting. |
| Bounded request/response sizes, rate-limit hooks, redacted logs and deterministic error classes | SATISFIED — HTTP layer enforces body/response caps, pluggable fixed-window rate limiting, stable error envelopes/statuses and recursive credential/secret redaction. |
| Provider-neutral route/chain adapters | SATISFIED — interfaces are separated from HTTP/browser logic and can be replaced by later PRE-10/live adapters without changing quote semantics. |
| Key/signer rotation design without production keys | SATISFIED — `signer-rotation-v1.json` and `SIGNER_ROTATION_MODEL` define PRE-05 handoff, overlap/revocation rules and prohibit private key material. PRE-04 producer metadata is explicitly `UNSIGNED_PRE05` / `DEFERRED_TO_PRE05`. |
| Offline deterministic vectors and mock-chain fixtures | SATISFIED — `pre04-vector-v1.json` freezes deterministic request, asset state, route state, fee policy and expected path/replay/quote hashes; unit and HTTP tests consume it. |
| Existing browser intake can consume backend output without trust elevation | SATISFIED — cross-package integration test feeds the backend response through `validateExecutableSwapQuote()`; it remains `REVIEW_CANDIDATE_ONLY` with no `sourceAuthenticated` authority. |

## Implementation

New repository-owned service:

- `exchange/quote-service/package.json`
- `exchange/quote-service/src/index.js`
- `exchange/quote-service/src/errors.js`
- `exchange/quote-service/src/validation.js`
- `exchange/quote-service/src/canonical.js`
- `exchange/quote-service/src/adapters.js`
- `exchange/quote-service/src/quote-engine.js`
- `exchange/quote-service/src/http.js`
- `exchange/quote-service/src/rate-limit.js`
- `exchange/quote-service/src/redaction.js`

Versioned schemas/config:

- `exchange/quote-service/schemas/executable-swap-quote-request-v1.json`
- `exchange/quote-service/schemas/executable-swap-quote-response-v1.json`
- `exchange/quote-service/schemas/error-v1.json`
- `exchange/quote-service/config/signer-rotation-v1.json`

Deterministic qualification material:

- `exchange/quote-service/fixtures/pre04-vector-v1.json`
- `exchange/quote-service/test/quote-engine.test.js`
- `exchange/quote-service/test/validation.test.js`
- `exchange/quote-service/test/http.test.js`
- `exchange/quote-service/test/redaction.test.js`
- `exchange/quote-service/test/browser-intake-compat.test.js`
- `exchange/quote-service/scripts/check-pre04.mjs`

CI:

- `.github/workflows/exchange-web.yml` now triggers for `exchange/quote-service/**` and runs PRE-04 static checks, backend unit/HTTP integration tests and backend secret scan before the retained Exchange web/browser suite.

## Trust and schema boundary

PRE-04 deliberately does **not** authenticate producer identity. The response carries:

- producer/service identity metadata;
- a key version placeholder;
- `algorithm: UNSIGNED_PRE05`;
- `authentication: DEFERRED_TO_PRE05`.

This is intentional. PRE-05 owns signed/authenticated quote provenance and replay authentication. PRE-04 does not use caller-supplied `sourceAuthenticated` or any equivalent trust flag.

The backend nevertheless binds execution meaning deterministically:

- canonical chain ID;
- deployment ID + manifest hash;
- router and spender;
- account and recipient;
- verified/trade-eligible token metadata;
- explicit route hops and route data;
- raw input;
- gross output, fee and net output;
- user minimum net output;
- route commitment;
- builder inputs;
- quote ID;
- observed/expiry timestamps;
- replay domain.

## Level 1 qualification

Exact implementation SHA: `ce40f17b7ee5e15d5920b64b923171bba29826df`

Required app-specific workflow:

- **420Exchange Web Verification** — run `36786390614` / run number 512 — **SUCCESS**

PRE-04-specific steps:

- **PRE-04 quote backend static checks — SUCCESS**
- **PRE-04 quote backend unit and HTTP integration tests — SUCCESS**
- **PRE-04 quote backend secret scan — SUCCESS**

Retained affected Exchange steps on the same exact head:

- Static Exchange checks — SUCCESS
- Exchange web unit tests — SUCCESS
- PRE-02 deployable artifact verification — SUCCESS
- PRE-02 simulated Chromium acceptance — SUCCESS
- PRE-03 metadata-driven Chromium acceptance — SUCCESS
- frontend secret scan — SUCCESS

An earlier implementation run `36786252090` failed because the HTTP test fixture did not pass the chain identity newly required by the hardened quote engine. The fixture was corrected; no production fail-open behavior was introduced.

## Level 2 milestone qualification

**COMPLETE for the PRE-04 backend-introduction milestone.**

PRE-04 introduces a material shared Exchange dependency consumed by later PRE-05/PRE-06 work. The exact-head `420Exchange Web Verification` run is also the retained app-specific integration suite for this boundary: it qualified the quote backend, browser intake compatibility, all Exchange web unit/static checks, deployable artifact construction and PRE-02/PRE-03 browser acceptance together on the same SHA.

No repository-wide/global qualification was substituted for this milestone.

## Exit criterion

> a tested backend service can emit a complete, deterministic execution quote under mock/offline dependencies; live chain qualification remains deferred.

**SATISFIED.**

The deterministic vector freezes:

- path commitment: `0x09b69b9c59e5e0c58570029417b25ff5a74241a018fb28f4c9aaf86622649f30`
- replay domain: `0x473f370ede8ab76d27610c0c00ba530fbc938b274f7589fa99211e72758a97ea`
- quote ID: `0xc1cd1a0c511b01e93916317fef14bca9e1bef5a4975614cd3855edbecfb78fb6`

and proves repeatable output for identical request/source state/clock.

## Security invariants

- Browser display snapshots cannot produce executable quotes.
- Unverified or non-trade-eligible token metadata fails closed.
- Wrong-chain/deployment state fails closed.
- Stale chain or route observations fail closed.
- Oversized route data, request bodies and responses fail closed.
- Quote endpoint is POST-only at the canonical path.
- Service responses are non-cacheable.
- Rate-limit policy is injectable/tested.
- Credentials/secrets are redacted from structured logs.
- No production signing key or mnemonic exists in PRE-04 artifacts.
- Backend output does not upgrade browser trust; PRE-05 authentication is still mandatory.

## Current-main divergence review

At closeout, current `main` was `6715d9fd3747953f298e79527fb9e86588db8d35`. Changes since the audit base are Compute Market contracts/config/docs/scripts and shared non-Exchange qualification workflows. They do not modify `exchange/web/**`, `exchange/quote-service/**` or `.github/workflows/exchange-web.yml`.

Under the active phase model, unrelated divergence does not invalidate this exact-head PRE-04 qualification. Full reconciliation remains intentionally deferred to PRE-12 before monolithic merge.

## Level 3 app-phase status

**Deferred to PRE-12.**

Repository-wide Solidity/Genesis, Geth, global fault/soak, Docs/global reconciliation and final monolithic 420 Integrated qualification are not PRE-04 completion gates. They will be run once on the reconciled accumulated Exchange merge candidate.

## Limitations / deferred work

- PRE-04 uses offline/static adapters for deterministic qualification; PRE-10 owns the production Exchange read/Indexer adapter and startup composition.
- PRE-05 must authenticate producer identity, key version and exact quote content cryptographically.
- Real route providers, chain state, deployed addresses/code hashes and live RPC remain testnet gates.
- PRE-04 does not enable wallet signing or transaction submission.

## Next canonical roadmap step

**PRE-05 — quote authenticity, provenance and replay protection.**
