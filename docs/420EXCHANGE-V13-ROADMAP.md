# 420Exchange Roadmap — V1 through V14

420Exchange is the Finance-layer trading surface for 420 Integrated. The protocol path through V13 establishes execution, routing, oracle, bridge, settlement, hardening, indexing and public read surfaces. V14 is the first complete user-facing Exchange Web UI and production presentation layer, targeted for `exchange.420integrated.org`.

## Completed protocol roadmap

### V1–V4 — Exchange foundation — COMPLETE
- core Exchange foundation phases
- market/execution primitives
- contract boundaries and protocol invariants
- progressive qualification of the Exchange base layer

Reference docs:
- `docs/420EXCHANGE-FOUNDATION-V1.md`
- `docs/420EXCHANGE-FOUNDATION-V2.md`
- `docs/420EXCHANGE-FOUNDATION-V3.md`
- `docs/420EXCHANGE-FOUNDATION-V4.md`

### V5 — Routing + oracle — COMPLETE
- routing/oracle integration
- deterministic route selection foundations
- oracle-backed execution inputs

Reference:
- `docs/420EXCHANGE-ROUTING-ORACLE-V5.md`

### V6 — Atomic routing/path execution — COMPLETE
- atomic route execution
- atomic multi-step path semantics
- path-level failure safety

References:
- `docs/420EXCHANGE-ATOMIC-ROUTING-V6.md`
- `docs/420EXCHANGE-ATOMIC-PATH-EXECUTION-V6.md`

### V7 — Normalized oracle execution — COMPLETE
- normalized oracle inputs
- deterministic execution normalization
- oracle/execution boundary qualification

Reference:
- `docs/420EXCHANGE-NORMALIZED-ORACLE-EXECUTION-V7.md`

### V8 — Native-value execution — COMPLETE
- native-value handling
- qualification of native-value execution paths

References:
- `docs/420EXCHANGE-NATIVE-VALUE-V8.md`
- `docs/420EXCHANGE-NATIVE-VALUE-V8-QUALIFICATION.md`

### V9 — Fee settlement — COMPLETE
- deterministic fee-routing/settlement semantics
- settlement accounting boundaries

Reference:
- `docs/420EXCHANGE-FEE-SETTLEMENT-V9.md`

### V10 — Signed limit orders — COMPLETE
- signed-order execution
- limit-order validation and lifecycle semantics

Reference:
- `docs/420EXCHANGE-SIGNED-LIMIT-ORDERS-V10.md`

### V11 — Bridge qualification — COMPLETE
- bridge execution/attestation qualification
- cross-domain settlement boundaries
- bridge safety invariants

Reference:
- `docs/420EXCHANGE-BRIDGE-QUALIFICATION-V11.md`

### V12 — Liquidity + execution hardening — COMPLETE
- adversarial regression coverage
- route/adapter hardening
- replay/collision hardening
- verifier rotation/authorization hardening
- pause/emergency controls
- malformed proof/recipient fuzz hardening
- domain/nonce/router bypass hardening
- governance/accounting/registry/recovery hardening

Reference:
- `docs/420EXCHANGE-HARDENING-V12.md`

### V13 — API, indexing + market data — COMPLETE, CLOSEOUT IN PROGRESS

#### V13.1 — Canonical market-data/event schema — QUALIFIED
- exact head `7246c8f03e4a3b31d3f6ac86f1a8c9c791202409`
- Solidity #2588
- Integrated #4093
- Docs #1803

#### V13.2 — Deterministic indexer core — QUALIFIED
- exact head `4dc287f42115d274e9e2bbf302b49cf2f77dd1bc`
- Solidity #2597
- Integrated #4114
- Docs #1824

#### V13.3 — Market snapshots — QUALIFIED
- exact head `3120c733c1859508d8b56cffc7ecbf2d9bc2dc82`
- Solidity #2607
- Integrated #4131
- Docs #1841

#### V13.4 — Historical query API — QUALIFIED
- exact head `17a782146c960d64568e1c43a22c198a57e29f63`
- Solidity #2610
- Integrated #4141
- Docs #1851

#### V13.5 — Live market-data stream — QUALIFIED
- exact head `a7ad5411c6f1d1f100cdfb6af3b0a57616076e73`
- Solidity #2618
- Integrated #4163
- Docs #1868

#### V13.6 — Public API hardening — QUALIFIED
- exact head `7a2e1a879ca1ff106dd842210bc7c9e84f760c4f`
- Solidity #2621
- Integrated #4166
- Docs #1871

#### V13.7 — V14 UI handoff qualification — QUALIFIED PRE-RECONCILIATION
- exact head `da9b89a402eb9e2a7754e7c930dc17b9f8d7157c`
- Solidity #2624
- Integrated #4183
- Docs #1881
- V14 client schema v14.0
- max 3-block canonical lag SLO
- max 30-second live-stream freshness SLO
- explicit reorg/replacement parity rules
- UI prohibited from inventing protocol state outside V13 read surfaces

### V13 closeout — COMPLETE
- PR #333 reconciled with `main` at `0612b39f017ad26092378e4292b61ec13adc172f`
- reconciliation commit: `cde09b9a0319953a222a9ba5fedf0181e200fdc3`
- reconciled roadmap head: `6a8bf40982b3d86ab4a89e29e6277747c25643e8`
- PR #333 merged to `main`
- V13 merge SHA: `78c35c79f5acb87973e4c5df064de42b63ead9a2`
- V13 is closed; V14 Exchange Web UI is now the active roadmap phase

---

# V14 — 420Exchange Web UI

## Objective

Build the production Exchange frontend that exposes the qualified V13 read surfaces and the previously qualified Exchange execution paths through one coherent web application at:

`https://exchange.420integrated.org`

The UI is a presentation and transaction-construction layer. It must not create its own protocol truth. Market state, order history, bridge state, route health, freshness, reorg status and settlement state must come from qualified Exchange/V13 surfaces.

## V14.1 — Frontend foundation + application shell — QUALIFIED

Deliverables:
- [x] create `exchange/web` application package in the monorepo
- [x] align with the repo-standard dependency-light Node 22 / ES module web pattern
- [x] establish application entrypoint and stable route reservations
- [x] add runtime configuration loading and validation
- [x] lock production origin to `https://exchange.420integrated.org`
- [x] reserve Markets, Market, Swap, Orders, Bridge and Portfolio routes
- [x] add global Exchange navigation, status chrome and feature gating
- [x] add responsive desktop/tablet/mobile shell
- [x] add fail-closed degraded configuration state
- [x] keep post-V14.1 transaction/wallet features disabled by runtime flags
- [x] add static qualification and Node unit tests
- [x] add dedicated `420Exchange Web Verification` CI workflow

Implementation:
- `exchange/web/index.html`
- `exchange/web/app.js`
- `exchange/web/styles.css`
- `exchange/web/core/config.js`
- `exchange/web/core/router.js`
- `exchange/web/runtime-config.json`
- `exchange/web/runtime-config.example.json`
- `exchange/web/test/config.test.js`
- `exchange/web/test/router.test.js`
- `exchange/web/scripts/check.mjs`
- `.github/workflows/exchange-web.yml`

Qualification:
- exact head `fac05f27aa6208fefd7fc3d946dc256d79152737`
- 420Exchange Web Verification #6
- 420 Integrated Qualification #4204
- 420Docs Qualification #1896

Acceptance:
- production-origin/runtime contract fails closed on invalid configuration
- application boots as a read-only shell before API endpoints are configured
- no secrets or production endpoint credentials are embedded in source
- future feature routes are stable but remain explicitly gated until their roadmap phases qualify
- responsive shell works without adding protocol authority

## V14.2 — Design system + Exchange visual language — QUALIFIED

Deliverables:
- [x] establish spacing, radius, surface, text and semantic status tokens
- [x] add reusable card, table, form-control, button, badge, empty/error and skeleton primitives
- [x] centralize canonical/finalized/stale/reorg/replacement/degraded semantics
- [x] model route-health independently from settlement-health
- [x] require status text + symbol so meaning never relies on color alone
- [x] add compact hash and timestamp formatters
- [x] add visible keyboard focus treatment across interactive controls
- [x] honor reduced-motion preference for loading skeletons
- [x] add responsive component gallery in the Markets shell
- [x] add executable tests for semantic state completeness and fail-closed unknown states

Implementation:
- `exchange/web/core/design-system.js`
- `exchange/web/styles.css`
- `exchange/web/index.html`
- `exchange/web/app.js`
- `exchange/web/test/design-system.test.js`
- `exchange/web/v14.2-qualification.json`

Acceptance:
- component primitives are reusable across every Exchange screen
- protocol status is communicated semantically by text and symbol, not by color alone
- reorg and replacement remain distinct visible states
- route health and settlement health remain independently representable
- unknown protocol states fail closed
- no screen invents one-off status terminology

Qualification:
- exact head `1cd92059562a7df0e053151042a9c6832a5404de`
- 420Exchange Web Verification #21
- 420 Integrated Qualification #4228
- 420Docs Qualification #1913

## V14.3 — V13 client SDK + data access layer — QUALIFIED

Deliverables:
- [x] implement V14 read client against the qualified V13 public surfaces
- [x] add V13.3 market snapshot reads with canonical subject/snapshot ID preservation
- [x] add V13.4 bounded historical queries and cursor-aware cache identity
- [x] add V13.5 WebSocket/SSE-neutral stream decoding and resume cursor support
- [x] enforce V13.6 API version negotiation and stable public error handling
- [x] enforce the 100-record historical page bound
- [x] enforce the 30-second live freshness bound
- [x] preserve inactive/orphaned history as addressable reorg state
- [x] propagate REORG and REPLACEMENT states explicitly into the client store
- [x] fail closed on stream sequence gaps
- [x] add deterministic query cache keyed by schema/surface/subject/cursor/full filters
- [x] add one ExchangeDataLayer orchestration entry point for snapshot/history/stream/freshness
- [x] add executable parity, cache, freshness, reorg, replacement and resume tests

Implementation:
- `exchange/web/core/exchange-client.js`
- `exchange/web/core/exchange-store.js`
- `exchange/web/core/exchange-stream.js`
- `exchange/web/core/exchange-cache.js`
- `exchange/web/core/exchange-data.js`
- `exchange/web/test/exchange-client.test.js`
- `exchange/web/test/exchange-store.test.js`
- `exchange/web/test/exchange-stream.test.js`
- `exchange/web/test/exchange-cache.test.js`
- `exchange/web/test/exchange-data.test.js`
- `exchange/web/v14.3-qualification.json`

Acceptance:
- SDK parity tests preserve V13 identities rather than re-keying client state
- WebSocket and SSE decode into identical stream event semantics
- unsupported API versions fail closed
- client cannot silently convert stale or orphaned data into canonical state
- reconnect resumes from the last delivered stream sequence
- no V14.3 read surface adds execution, custody, mint, burn or settlement authority

Qualification:
- exact head `df828c9edc825543719af0faa798f08d5bed165b`
- 420Exchange Web Verification #41
- 420 Integrated Qualification #4242
- 420Docs Qualification #1923

## V14.4 — Markets overview — QUALIFIED

Deliverables:
- [x] build searchable market list over V13-compatible snapshot data
- [x] add deterministic sorting by market, last price, rolling change, quote volume and liquidity
- [x] derive rolling change only from snapshot open + last-trade values
- [x] display last price, best bid/ask, quote volume and liquidity
- [x] display route health and settlement health independently
- [x] display canonical/stale/degraded freshness state explicitly
- [x] add local-only watchlist/favorites with no protocol authority
- [x] add watchlist-only filter
- [x] add explicit demo-data mode when no live V13 API is configured
- [x] ensure demo fixtures are never presented as live/canonical production state
- [x] preserve responsive market identity, price and health visibility on narrow screens
- [x] add executable search/sort/freshness/watchlist qualification tests

Implementation:
- `exchange/web/core/markets.js`
- `exchange/web/app.js`
- `exchange/web/index.html`
- `exchange/web/styles.css`
- `exchange/web/fixtures/markets.json`
- `exchange/web/test/markets.test.js`
- `exchange/web/v14.4-qualification.json`

Acceptance:
- every displayed value maps to a V13-compatible snapshot field or deterministic derivation
- stale/degraded data is visibly marked and never silently canonicalized
- route and settlement health remain independent
- local watchlists do not mutate protocol state
- market search does not steal input focus by rebuilding the full view
- untrusted market labels are rendered as text rather than executable HTML
- market list remains usable on narrow screens

Qualification:
- exact head `74de80709e1f2ea94fa711fb60316bc6387236f6`
- 420Exchange Web Verification #64
- 420 Integrated Qualification #4264
- 420Docs Qualification #1939

## V14.5 — Market detail + charting — IN QUALIFICATION

Deliverables:
- [x] market header with pair, canonical/freshness status, route health and settlement health
- [x] live/snapshot last price and best bid/ask
- [x] deterministic SVG OHLCV chart
- [x] selectable 1h/4h/1d/7d aggregation windows
- [x] derive live OHLCV from canonical V13 trade history rather than treating unrelated records as candles
- [x] volume/liquidity presentation
- [x] de-duplicated trade tape by record ID
- [x] historical activity table retaining reorged/orphaned records
- [x] explicit replacement linkage preserving old/new IDs
- [x] source diagnostics and clearly labeled demo-history mode
- [x] responsive detail/chart layout

Implementation:
- `exchange/web/core/market-detail.js`
- `exchange/web/app.js`
- `exchange/web/index.html`
- `exchange/web/styles.css`
- `exchange/web/fixtures/market-detail.json`
- `exchange/web/test/market-detail.test.js`
- `exchange/web/v14.5-qualification.json`

Acceptance:
- chart values are deterministic derivations from V13-compatible trade/history inputs
- inactive/orphaned records cannot affect the canonical chart domain
- trade tape de-duplicates by canonical record ID
- replacement events visibly reconcile without losing historical traceability
- demo history remains explicitly non-live
- no chart/detail component creates execution authority

## V14.6 — Swap / market execution UI

Deliverables:
- token/asset selectors
- amount in/out
- route quote display
- price impact/slippage controls
- fee breakdown
- route-health and settlement-health checks
- transaction review screen
- wallet signing handoff
- pending/submitted/confirmed/failed lifecycle
- canonical post-trade refresh

Acceptance:
- execution parameters come from qualified Exchange execution/route interfaces
- user sees fees, route and minimum received before signing
- UI never reports success before chain confirmation
- stale quote invalidation is enforced

## V14.7 — Limit-order UI

Deliverables:
- buy/sell limit-order form
- price/amount/total calculations
- signing review
- open orders
- partial-fill state
- filled/cancelled/expired history
- cancellation action
- order provenance/transaction links

Acceptance:
- signed-order payload exactly matches V10 semantics
- partial fills remain deterministic
- cancellation state reconciles from canonical history

## V14.8 — Bridge + cross-chain settlement UI

Deliverables:
- source/destination network selection
- route/adapter display
- deposit/withdrawal flow
- attestation/proof status
- bridge fee presentation
- settlement progress timeline
- pause/degraded route handling
- failed/retry-safe user guidance without inventing settlement authority

Acceptance:
- only qualified/authorized bridge routes are selectable
- paused routes cannot be submitted
- state reflects V11/V12/V13 bridge surfaces

## V14.9 — Portfolio, balances + activity

Deliverables:
- wallet-connected balances
- Exchange-relevant asset positions
- open orders
- recent trades/fills
- bridge activity
- fee history where user-relevant
- unified transaction/activity timeline
- deterministic links to Explorer records

Acceptance:
- portfolio state is read from canonical wallet/chain/indexed sources
- history pagination uses V13.4 cursor rules
- orphaned/replaced events remain inspectable

## V14.10 — Wallet/session integration

Deliverables:
- connect 420Wallet/web wallet
- supported external EVM provider path if part of Genesis policy
- network validation/switching
- account-change/session lifecycle
- signing review integration
- rejected-signature and disconnected-session recovery
- chain mismatch protection

Acceptance:
- no implicit signing
- account/network changes invalidate stale transaction drafts
- signing payload is reviewable before approval

## V14.11 — Reliability, accessibility + responsive hardening

Deliverables:
- WCAG-oriented keyboard navigation and focus management
- screen-reader labels for trading controls and status
- desktop/tablet/mobile regression matrix
- slow-network/loading tests
- disconnect/reconnect tests
- API 429/503/version mismatch handling
- stale-data and degraded-mode tests
- empty-market and no-liquidity states
- browser compatibility qualification

Acceptance:
- critical trading paths are keyboard operable
- no destructive transaction action is hidden behind hover-only UI
- degraded API states fail safe and remain understandable

## V14.12 — Frontend security hardening

Deliverables:
- CSP and security-header policy
- strict runtime config validation
- no private keys/secrets in frontend
- dependency and supply-chain audit gates
- DOM/XSS injection regression
- URL/query parameter sanitization
- wallet-provider spoofing/chain-mismatch tests
- clickjacking/frame policy
- transaction intent review protections
- hostile/stale API payload tests

Acceptance:
- malformed/untrusted public API payloads fail closed
- transaction review cannot be bypassed by UI state mutation
- no user-controlled HTML execution surface
- production build passes security qualification

## V14.13 — Production deployment for exchange.420integrated.org

Deliverables:
- production build target
- deployment workflow
- DNS/custom-domain configuration for `exchange.420integrated.org`
- HTTPS/TLS enforcement
- production API/WebSocket/SSE endpoint configuration
- cache/CDN policy consistent with V13.6
- SPA routing/fallback configuration if required
- environment-specific runtime config
- health/version endpoint or build metadata surface
- deployment rollback procedure

Acceptance:
- `exchange.420integrated.org` serves the qualified production artifact over HTTPS
- browser connects only to approved production endpoints
- version/build metadata is visible for operations
- rollback can restore the last qualified artifact without changing protocol state

## V14.14 — End-to-end Genesis qualification + release

Deliverables:
- live/testnet end-to-end market browse
- swap execution drill
- limit-order create/fill/cancel drill
- bridge lifecycle drill
- reconnect/resume drill
- stale API/freshness drill
- reorg/replacement drill
- wallet/network-change drill
- mobile/browser qualification evidence
- performance budgets
- final exact-head CI qualification
- reconcile with latest `main`
- merge V14
- production deployment qualification for `exchange.420integrated.org`

Release gate:
- all required V14 CI green on exact head
- no unresolved critical/high security defects
- V13 client/API parity intact
- production domain serves the exact qualified build
- Exchange UI is ready for Genesis/testnet use

---

# Current position

**Now:** V14 — Exchange Web UI. V13 is merged and closed.

**Current step:** V14.5 — market detail + charting — in qualification.

**V14 completion target:** a production-qualified Exchange UI at `exchange.420integrated.org`, backed by V13 read surfaces and the qualified V1–V12 Exchange execution stack.
