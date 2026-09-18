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

## V14.1 — Frontend foundation + application shell — IN QUALIFICATION

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

Acceptance:
- production-origin/runtime contract fails closed on invalid configuration
- application boots as a read-only shell before API endpoints are configured
- no secrets or production endpoint credentials are embedded in source
- future feature routes are stable but remain explicitly gated until their roadmap phases qualify
- responsive shell works without adding protocol authority

## V14.2 — Design system + Exchange visual language

Deliverables:
- typography, spacing, grids, cards, tables, tabs, forms, badges and dialogs
- market-status, route-health, settlement-health and freshness indicators
- semantic states for canonical/finalized/stale/reorg/replacement/degraded
- reusable price, amount, token, address, hash and timestamp components
- skeleton/loading/empty/error states
- keyboard/focus foundations
- dark/light behavior only if consistent with the wider 420 Integrated frontend system

Acceptance:
- component primitives are reusable across every Exchange screen
- protocol status is communicated semantically, not by color alone
- no screen invents one-off status terminology

## V14.3 — V13 client SDK + data access layer

Deliverables:
- typed client generated/implemented against the V14 client schema
- snapshot client for V13.3
- historical-query client for V13.4
- live-stream client for V13.5
- public API/version/error/freshness policy for V13.6
- reconnect/resume cursor persistence
- canonical subject/record ID preservation
- query caching keyed by schema version + subject + cursor/filter
- explicit stale/reorg/replacement state propagation into UI stores

Acceptance:
- SDK parity tests against V13 reference fixtures
- WebSocket and SSE produce equivalent client state
- unsupported API versions fail closed
- client cannot silently convert stale or orphaned data into canonical state

## V14.4 — Markets overview

Deliverables:
- searchable/sortable market list
- market status
- last price
- 24h/rolling change where derivable from qualified snapshots
- volume and liquidity summaries
- best bid/ask where available
- route/settlement-health badges
- freshness indicator
- watchlist/favorites stored locally without protocol authority

Acceptance:
- every displayed value maps to a V13 source field
- stale data is visibly marked
- market list remains usable on narrow screens

## V14.5 — Market detail + charting

Deliverables:
- market header with pair, status, route and settlement health
- live price and best bid/ask
- OHLCV chart
- selectable qualified aggregation windows
- volume/liquidity presentation
- trade tape
- historical activity view
- explicit reorg/replacement UI behavior
- source/freshness diagnostics panel for advanced users

Acceptance:
- chart values reproduce V13 snapshot/history inputs
- reconnect does not duplicate trade tape entries
- replacement events visibly reconcile without losing historical traceability

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

**Current step:** V14.1 — frontend foundation + application shell — in qualification.

**V14 completion target:** a production-qualified Exchange UI at `exchange.420integrated.org`, backed by V13 read surfaces and the qualified V1–V12 Exchange execution stack.
