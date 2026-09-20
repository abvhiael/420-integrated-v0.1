# 420Exchange — pre-testnet engineering completion roadmap

**Updated:** 2026-09-19. **Scope:** engineering work possible before an operational 420 testnet. **Working PR:** [#352](https://github.com/abvhiael/420-integrated-v0.1/pull/352). Overall status: [`420EXCHANGE-STATUS-ROADMAP.md`](420EXCHANGE-STATUS-ROADMAP.md). **PRE-01 source/integration-boundary audit: DONE**; its evidence is [`420EXCHANGE-PRE-01-CLOSEOUT.md`](420EXCHANGE-PRE-01-CLOSEOUT.md), [`420EXCHANGE-PRE-01-SOURCE-AND-TRUST-INVENTORY.md`](420EXCHANGE-PRE-01-SOURCE-AND-TRUST-INVENTORY.md) and [`420EXCHANGE-PRE-01-API-INDEXER-INTERFACE-RECONCILIATION.md`](420EXCHANGE-PRE-01-API-INDEXER-INTERFACE-RECONCILIATION.md). PRE-01 completion means **inventory/reconciliation is finished**, not that the missing API adapters, quote producer, application integration or live systems were built. Subsequent milestones own those gaps.

## Baseline and rules

V14 offers fixture/read-only catalog, swap, order and bridge views. V15 supplies deployment-aware guards, raw-unit canonical builders, preflight and wallet primitives, explicit provider selection and generation invalidation, quote intake and read-only swap review. Earlier Exchange Web Verification passed on code head `50ca04c0e5ecd5b702806aa30546485276db64a8`, run [35469241756](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35469241756); later documentation commits do not automatically receive code CI. Existing modules are not a fully integrated execution app. Checked-in chain/RPC/API/quote runtime fields remain unresolved. HTTPS, caller-supplied `sourceAuthenticated`, token `verified` and `marketSource:'api'` flags do not establish execution authority. All browser swap/order/cancel/bridge wallet prompts remain OFF.

**DONE** = scoped, source-linked deliverable with its claimed type of evidence (a documentation audit need not have code CI); **PARTIAL** = incomplete integration/tests; **TODO** = no accepted deliverable yet; **LIVE GATE** = independently verified deployed infrastructure/real-network evidence required. Do not treat mock tests as live qualification.

## PRE-01 — Source inventory, release and API/indexer boundary (DONE)

Inspected and linked Exchange Solidity router/settlement/bridge/fee/policy sources, browser read/execution/quote-review clients, runtime/build, 420Indexer ingestion/projection, public API and actual HTTP transport. General indexer `routeIndexerHttp420` and `createIndexerHttpServer420` implement GET `/v1` and health/readiness using `{apiVersion:'v1',data}`; `420-indexer/package.json` defines build/test but no production start command; index.ts exports modules instead of bootstrapping a running service. Exchange browser `ExchangeClient` instead expects GET `/v13/markets/{subjectId}/snapshot` and `/v13/history`, V13 headers and a different response envelope; V15 quote intake expects a separately configured POST `/executable-swap-quote`. The V13 Solidity public API policy is not an HTTP handler. No executable quote producer, authenticated source or Exchange-specific HTTP adapter was established within the inspected code; this is **not an assertion of absence in unrelated/external repositories**. PRE-04/PRE-10 own the implementation/integration and PRE-11 the operational bootstrap/tests.

Trust stages are distinct: `DISPLAY_SNAPSHOT` -> untrusted `REVIEW_CANDIDATE_ONLY` -> future authenticated `TRUSTED_EXECUTION_QUOTE` -> future wallet/session-bound `REVIEWED_TRANSACTION` -> future `SUBMITTED_TRANSACTION` -> separately confirmed/finalized/settled/reconciled chain state. Pin chain/account/provider generation, verified manifest/router/token metadata, market/route/path, integer raw amounts, net minimum, fees, recipient/spender, calldata/value/fingerprint, observed/expiry/replay IDs. Neither a response flag nor a transaction hash advances trust or proves payout. Preserve V14 fixture isolation and fail-closed controls. **Exit evidence:** [PRE-01 closeout](420EXCHANGE-PRE-01-CLOSEOUT.md).

## PRE-02 — Consolidate wallet identity and invalidation (PARTIAL; NEXT)

Use the V15 selected provider/session as the sole future execution identity, without breaking V14 read-only browsing. Invalidate requests, quote candidates, preflight and proposed confirmations on edited input, route/page, account/chain/provider/runtime replacement, disconnect/reconnect or late responses even if abort is ignored. Add deterministic DOM/browser race, navigation and cleanup tests. **Exit:** one documented wallet source with no resurrected stale review; real signing remains OFF.

## PRE-03 — Accessible read-only swap form and review (PARTIAL)

Replace temporary raw-address developer entry with a non-executable, source-verified metadata-driven UI, preserving exact integer raw units beneath presentation. Display asset addresses, chain, spender/router, exact input, minimum net output, fees, route, recipient, quote ID/expiry and fingerprint, with full untruncated inspection. Label unqualified/fixture snapshots as display-only. Cover loading, stale/error/empty states, safe rendering, keyboard and screen-reader UX, rounding/decimals, malformed amounts, mismatched chain/recipient, duplicate assets, oversized routes and invalidation races. **Exit:** display/canonical parity in DOM tests; execution OFF.

## PRE-04 — Build executable quote service contract and backend (TODO; critical dependency)

Build a versioned POST request/response/error producer **separate from the indexer's read API**. Specify chain, manifest, authenticated asset metadata, exact-in/out/net minimum/fees, route and path hash, recipient, source identity, quote ID, time/replay and correct transaction builder parity. Reject stale/unsupported/wrong-chain/malformed inputs, enforce bounded resource use, redacted logs and explicit outage errors. Provide trusted signer/key-rotation and quote-authentication design with offline test vectors and mock chain adapters; do not fabricate production keys, routes or deployment. **Exit:** tested backend + schema/trust contract; live chain-sourced quote remains a LIVE GATE.

## PRE-05 — Verifiable client provenance (TODO)

Pin approved producer identity/keys, signed quote payload when implemented, deployment/router/token provenance, route/fee/account/recipient/amount and expiration to the actual reviewed transaction. Forbid caller-injected trust flags and mismatched/extra critical fields; test forgery, replay, wrong chain, endpoint substitution, signer rotation, wallet changes and expiry. **Exit:** offline-proven origin and intent binding, not proof of current chain state.

## PRE-06 — Guarded swap orchestration and lifecycle (PARTIAL)

Compose authenticated quote, raw-unit transaction, full review, explicit user confirmation, fresh-session preflight, guarded wallet call and chain-versus-indexer lifecycle through **one** V15 orchestrator, behind a hard-OFF independent execution gate. Approval/permit is a separate reviewed decision; expire and rebuild review after changes. Model pending/confirmed/reverted/replaced/dropped/reorged/indexer-delay/conflict; never call a submitted hash a success. Add mock RPC and browser end-to-end failure tests; V14 never becomes an execution input. **Exit:** mock-tested architecture, real sends disabled.

## PRE-07 — Limit-order creation/publication (PARTIAL)

Connect canonical sell/min-buy raw units, market/maker/recipient, EIP-712 domain, nonce/expiry, fill constraints and fee review to the V15 provider. Implement publication/validation/idempotency/status service and separate signed/published/accepted/partially-filled/settled states. Negative tests for wrong signer/domain, duplicate, expiry, chain/provider switch and conflicting fill. **Exit:** mock service-backed order lifecycle; no live signing/publication.

## PRE-08 — Maker-only cancellation (PARTIAL)

Separate off-chain removal from on-chain nonce/hash cancellation, enforce maker and remaining amount, fresh state and explicit reviewed authorization. Render pending/reverted/replaced/reorged/racing-fill outcomes; test cross-account and duplicate cancels. **Exit:** mock-tested canonical cancellation, sends OFF.

## PRE-09 — Bridge proof/destination architecture (PARTIAL)

Separate route/adapter/verifier/manifest, source submission/finality, proof availability/verification, destination claim/finality and beneficiary payout. Build proof-provider interface, replay/expiry, wrong-beneficiary, pause/retry/refund/reorg and indexed recovery with offline two-chain E2E tests. Source hash/proof registration never equals final payout. **Exit:** mock-testable cross-chain lifecycle; real sends OFF.

## PRE-10 — Exchange market API, catalog and indexer consistency (PARTIAL)

**PRE-01 handoff:** 420Indexer has typed GET `/v1` HTTP transport; the Exchange browser expects incompatible GET `/v13` market/history endpoints. Implement or positively locate an Exchange-specific versioned adapter/HTTP service with snapshot/history schemas, source attribution, freshness, pagination, event canonicality and stream recovery; provide explicit configuration/startup composition for indexer RPC+SQL+API and contract tests for both sides. Do not confuse indexer non-authoritative projections with chain settlement. BOB, ARRR and other visual catalog entries stay discoverable/display-only until qualified. Fault-inject rollback, duplicates, delayed events and fee/beneficiary conflicts. **Exit:** source-labeled, mock-tested Exchange read and reconciliation path.

## PRE-11 — CI/security/packaging/operations (PARTIAL)

Add separate backend/contract/DOM/integration tests with exact-head provenance and docs qualification; verify reproducible bundles/imports/config, hard-off execution defaults, CSP/secret/log hygiene, forged quote/replay/approval/provider threat model. Implement/test service bootstrap/degradation and runbooks for key rotation, outages, pause, rollback, backfill and reconciliation. **Exit:** applicable offline checks green on exact integration head, reviewable operational procedures.

## PRE-12 — Pre-testnet release candidate/handoff (TODO)

Reconcile PR #352 with main; review diffs and safely mergeable read-only code; retain trading OFF. Update evidence and qualification records, record exact revisions and independently reviewed LIVE GATES with owners, planned scripts/accounts/assets/expected receipts/proofs and rollback. Merge/release decisions require reviews; neither mock CI nor a PR merge is Genesis authorization. **Exit:** offline-tested pre-testnet codebase ready to **start testnet qualification**, not public trading.

## Deferred LIVE GATES (outside this roadmap)

Real network/genesis/RPC/contract code-hash and configured route/asset/bridge verification; authenticated live quotes; actual balance/allowance/gas/nonce preflight and real wallet/device matrix; swap/order/cancel execution and settlement receipts; bridge verified source-to-destination beneficiary payout; indexer, fees and treasury reconciliation; security/operator approval and `qualify:genesis` on the final release candidate. **Execution rule:** advance PRE-02 next, preserve all hard-off controls, and claim DONE for future phases only with appropriately scoped source/test evidence.