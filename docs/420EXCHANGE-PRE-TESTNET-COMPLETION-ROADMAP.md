# 420Exchange — pre-testnet engineering completion roadmap

**Prepared:** 2026-09-19. **Scope:** work implementable and verifiable *without an operational 420 testnet*. **Working PR:** [#352](https://github.com/abvhiael/420-integrated-v0.1/pull/352), branch `feature/420exchange-v15.1-testnet-binding`. Pair with [`420EXCHANGE-STATUS-ROADMAP.md`](420EXCHANGE-STATUS-ROADMAP.md) for the overall implementation/Genesis status. This roadmap is a work plan, not evidence that a milestone is complete.

## Baseline and boundaries

Repository-implemented components include the V14 read-only market, swap, order and bridge display surfaces; V15 deployment-aware guards; canonical raw-unit transaction/order builders; preflight and wallet-execution primitives; provider selection and session invalidation; bounded swap quote intake; a read-only quote review session; and a separate V15 swap-review panel mounted in the web build. The Exchange Web Verification workflow passed on the prior code baseline `50ca04c0e5ecd5b702806aa30546485276db64a8`. Later documentation changes alone do not establish a new code-test result. These primitives are **not a functioning end-to-end trading application**. The V14 display inputs must never be promoted into executable authority.

The checked-in runtime has no qualified deployment/quote endpoint; an HTTPS URL, `marketSource:'api'`, `verified:true` token flags, or a caller-provided `sourceAuthenticated` boolean cannot establish source authenticity. Existing V15 browser controls keep swap submit, order sign, bridge submit and cancellation disabled. Preserve that fail-closed default throughout pre-testnet development. Unit/integration testing may use explicit, isolated mock providers/contracts, but never represent mock evidence as live trading or deploy a publicly usable trading toggle.

**Status vocabulary:** DONE = source/tests/CI evidence on a named commit; PARTIAL = code exists but acceptance tests or integration missing; TODO = no verified completed deliverable in the audited Exchange branch; LIVE GATE = cannot be cleared without operational, verified testnet infrastructure. Existing V15.1–V15.10 code is foundational and repository-tested in parts, not categorically release-complete.

## Implementation sequence (all possible before testnet launch)

### PRE-01 — Reconcile the application inventory, configuration and release boundaries (TODO)

- Inventory the actual swap, limit-order, cancellation, bridge, market-data, quote-service, indexer, wallet-controller and deployment entrypoints on the current PR branch and the relevant contract/service repositories. Link code and tests; mark absent, stubbed, demo-only, duplicated or unreferenced components. Reconcile stale V15.11 qualification and runbook language with the currently mounted read-only UI.
- Define one authoritative V15 domain model for token/market IDs, decimal metadata, chain/contract manifest, exact raw units, route commitments, fee/recipient fields, timestamps, error codes and lifecycle transitions. Explicitly label *display snapshot*, *review candidate*, *trusted execution quote*, *reviewed transaction* and *submitted transaction* as different trust states.
- Document feature flags and mandatory disabled defaults. Do not enable trading based on a configured URL, a deployment-status string or unit-test success alone.

**Exit:** a traceable source-tree checklist and documented trust/state boundaries; no ambiguous claim that a component is live-qualified.

### PRE-02 — Consolidate browser wallet identity and route-state invalidation (PARTIAL)

- Make the V15 selected provider/session the **sole** wallet identity used by future V15 trade flows; remove competing legacy wallet state from execution paths without breaking V14 read-only browsing.
- Invalidate pending quote fetches, visible reviews, preflight results and confirmations on account/chain/provider change, disconnect, reconnect, runtime replacement, route change, edited inputs and page navigation. Discard late responses even when abort is ignored.
- Add explicit deterministic browser-DOM tests for connection/disconnection, provider competition, navigation, background/foreground transitions and cleanup. Ensure lifecycle observers cannot resurrect stale reviews or leak listeners.

**Exit:** one documented browser session source with race tests; no stale quote can survive user edits or wallet/network changes. No wallet signing or sending enabled.

### PRE-03 — Finish accessible V15 read-only trade entry and review (PARTIAL)

- Replace the temporary raw-address developer panel with a non-executable, product-quality V15 form driven by a **verified metadata boundary**, while retaining explicit raw-unit canonicalization beneath the UI. Show token addresses, chain, spender/router, exact input, minimum net output, estimated fees, route steps, recipient, quote ID, expiry and exact transaction fingerprint. Never infer token decimals or trusted liquidity from the V14 catalog.
- Show the source and trust state prominently; label snapshots and unqualified quotes as display-only. Ensure long addresses/data are inspectable and never truncated in the full review. Use safe text rendering, keyboard focus and screen-reader announcements. Show loading/empty/error/stale/unavailable states.
- Test malformed values, decimals/rounding, zero/nonfinite values, duplicate assets, chain/recipient mismatches, oversized routes, expiry while displayed, input edits and slow/aborted responses. Address review field-name mismatches and DOM-refresh races before enabling any future confirmation control.

**Exit:** tested, keyboard-accessible read-only swap preview with exact displayed/canonical value parity; all transaction buttons remain disabled.

### PRE-04 — Build the executable quote service contract and provider-neutral backend (TODO; highest-priority backend dependency)

- Define versioned request/response/error schemas and an executable quote producer separated from display snapshots. Specify supported swap modes, routing policy, market/route IDs, integer input/output and fee amounts, `minFinalAmountOutRaw`, recipient, expected path hash, token identities/decimals provenance, quote ID, observed/expiry times and source/deployment identity.
- Implement deterministic route construction/validation and a canonical response assembled from the same transaction-building rules as the client. Reject unsupported routes, stale market/state inputs, wrong chain/account, malformed calldata, unsafe decimals and unresolved contracts. Provide rate limits, bounded timeouts, request-size limits, structured redacted audit logs and explicit degraded/unavailable responses.
- Define server-identity and quote authenticity (for example, operator-approved authenticated service plus a cryptographically verifiable quote envelope and signer rotation, replay controls and trust-anchor distribution). Distinguish source authentication from *on-chain route qualification*; neither can be inferred from TLS alone. Do not claim deployment identity or production signing keys before operational provisioning.
- Supply offline server-contract tests with simulated chain adapters, adversarial fixtures and deterministic test vectors. Expose the configured endpoint only in a disabled/non-public integration environment until operator approval.

**Exit:** a tested executable-quote backend and published schema, trust model and operator configuration contract. Actual chain-sourced quotes remain a LIVE GATE.

### PRE-05 — Replace caller trust flags with verifiable client quote provenance (TODO)

- Validate origin, service identity, quote signature/attestation when specified by the agreed protocol, approved key set and key rotation; pin the network, manifest, router and token metadata to the reviewed transaction. Require bounded freshness at receipt **and** before any subsequent action. Enforce quote/request/route/fee/recipient agreement and explicit replay/nonce policy.
- Review projected human-readable values and exact calldata from a single canonical object; reject extra/missing execution-critical fields, altered quotes, mismatched spender and order of hops. Do not allow `sourceAuthenticated:true` or `tokens.*.verified:true` to be independently asserted by untrusted browser callers.
- Add negative tests for forged signatures, wrong environment/contract, endpoint substitution, replay, quote reuse after edits, chain/account changes and expiration.

**Exit:** verifiable quote-origin boundary and deterministic reviewed-intent binding pass offline tests. No claim of current-chain state without a real deployed source.

### PRE-06 — Complete guarded swap orchestration and lifecycle UI behind a hard-off flag (PARTIAL)

- Connect authenticated quote → canonical transaction → full user review → explicit confirmation → fresh session/quote check → simulated preflight → wallet call via **one** guarded orchestrator. Introduce a separate compile-time/operational approval gate that defaults to OFF and cannot be flipped by merely editing runtime JSON. Never route legacy V14 review buttons directly to wallet methods.
- Build allowance/permit or approval prompts only when actually needed; show spender, token, maximum authorization, cost and confirmation as separate user decisions. Handle quote expiry during approval, cancellation, wrong chain, unsupported methods and nonce/fee changes by rebuilding review.
- Implement transaction status for pending, confirmed, reverted, replaced, dropped, reorged, indexer-delayed and conflicting views. Retain user-visible transaction hashes and authoritative chain-vs-indexer distinctions; never mark success upon submission alone.
- Exercise mock RPC/contract/browser E2E tests for success and rejection paths. Keep the real-send gate OFF after tests pass.

**Exit:** end-to-end **mock-tested** swap architecture with no accidental wallet prompt in production/fixture/unresolved runtime. Real swap qualification is a LIVE GATE.

### PRE-07 — Finish limit-order creation, signing and publication flow (PARTIAL)

- Wire exact integer sell/min-buy quantities, maker/recipient, market and domain-specific EIP-712 payloads, nonce, expiry, partial-fill constraints, fees and price floor to the chosen V15 wallet. Separate signing, orderbook publication, acceptance, fill and final chain settlement states.
- Implement order submission service contract, idempotency, signature verification, order-hash matching, explicit rejection codes, status/history and recovery after disconnect/reload. Ensure maker owns the order and replay/duplicate attempts fail closed.
- Test wrong signer/domain/chain, malformed decimals, expired orders, conflicting fill state, partial fills, duplicate publication, abandoned prompts and provider changes. Keep real sign/publish disabled until qualification.

**Exit:** mock-service-backed, reviewed order lifecycle with no assertion that a wallet signature equals a published or filled order.

### PRE-08 — Complete maker-only order cancellation (PARTIAL)

- Separate off-chain removal from on-chain nonce/hash cancellation and reconcile both. Verify maker, exact order hash, remaining fillable amount, nonce/expiry, allowance/authorization and current cancellation status before showing a proposed action.
- Wire canonical cancellation builder, user review, preflight, status rendering and pending/reverted/replaced/reorged recovery. Remove any demo-derived cancel authorization. Test cross-account and already-filled/racing cancel cases.

**Exit:** mock-tested maker-only cancel flow with explicit chain-versus-orderbook status; disabled for real sends until live qualification.

### PRE-09 — Complete bridge route, proof and destination settlement architecture (PARTIAL)

- Define independently sourced route/adaptor/verifier/chain manifests, supported assets, fee/slippage and canonical destination beneficiary. Distinguish source transaction, source finality, proof availability/verification, destination claim, destination finality and beneficiary payout.
- Connect canonical source transaction and review builders to a proof-provider interface; provide verifier status, expiry/replay policy, retry/refund/manual intervention and reorg/conflict handling. Prohibit interpreting proof registration or outbound submission as completed bridging.
- Build source/destination status UI, indexed lifecycle, idempotent recovery and mock cross-chain E2E tests including invalid proofs, wrong beneficiary, replay, paused route and destination failure. Keep real bridge submission disabled.

**Exit:** offline-testable bridge state machine, UI and proof-adapter contract. Real proof/settlement and beneficiary accounting remain LIVE GATES.

### PRE-10 — Reconcile market data, catalog, indexer and event consistency (PARTIAL)

- Verify actual existence and contracts of market discovery, read APIs, snapshot freshness, source attribution, history, pagination, subscriptions/resume, event canonicality, reorg and replacement handling. Connect confirmed order/swap/bridge activities to a single typed presentation model, not fixture-specific assumptions.
- Ensure BOB, ARRR and other visual catalog entries are clearly labeled *discoverable/display-only* until their trading infrastructure is qualified. No invented bids, liquidity, settlement status or executable market for placeholder entries.
- Build mock indexer fault-injection tests for delayed/out-of-order events, duplicate fills, rollback, contract events disagreeing with snapshots and fee/beneficiary accounting; expose explicit reconciliation diagnostics.

**Exit:** a source-labeled read architecture and testable lifecycle reconciliation contract, with no fictitious market authority.

### PRE-11 — CI, packaging, security and operator runbooks (PARTIAL)

- Add independent contract, backend, browser DOM and integration suites to CI with exact-head provenance and required status checks. Make documentation-only changes that affect release procedures visible to the appropriate documentation check; do not treat a skipped path-filtered workflow as green.
- Test reproducible web bundles, correct module/script mounts, runtime schema and environment validation, content security policy and secret scanning. Add source maps/log redaction policy, rate limit/abuse controls, threat model for quote forgery, signature replay, approvals, transaction substitution, provider injection, UI confusion and malicious token metadata.
- Write operator procedures for signer/key rotation, service outages, paused markets, emergency disable/rollback, backfills, incident response, request tracing and recovery. Document config and contracts needed later without fabricating live endpoints or signoff.

**Exit:** all applicable offline suites green at the exact integration head; reproducible build, security review findings tracked and operator documentation reviewable.

### PRE-12 — Pre-testnet release candidate and explicit handoff (TODO)

- Reconcile PR #352 with current `main`, review changed-file/contract coverage, resolve conflicts, and separate safely mergeable read-only/disabled features from any changes that could expose wallet prompts. Update V15.11 qualification, top-level roadmap, API reference and acceptance checklist with linked evidence.
- Produce a versioned pre-testnet release candidate whose trading flags are **OFF**, and a signed-off list of LIVE GATES with owners, scripts, required test accounts/assets/markets, expected receipts/proofs and rollback conditions. A passed mock drill never clears a live gate.
- Require independent review before merging/deploying security-sensitive execution code. A PR merge is not equivalent to Genesis authorization.

**Exit:** an auditable, offline-tested and operationally documented pre-testnet codebase ready to **begin** testnet qualification, not ready for public trading.

## Deferred live gates — explicitly outside this roadmap

A verified 420 testnet and chain/RPC/network manifests; deployed contract addresses/code hashes, authorized market/router/bridge configuration and real token liquidity; independently sourced live executable quotes; actual allowance/gas/nonce/preflight observations; real wallet/device acceptance; swap receipt and failure drills; order signature/publication/fill/cancellation evidence; source-to-destination bridge proofs and **beneficiary payout**; indexer/fees/treasury reconciliation; security/operator approvals; final Genesis `qualify:genesis` and release decision.

**Execution rule:** implement PRE-01 through PRE-12 in order of dependencies, but continue parallel backend/front-end work where appropriate. Record `TODO` → `PARTIAL` → `DONE` only with exact source paths, tests and commit/run evidence. Until all applicable live gates pass, no publicly accessible wallet signing, swap, order, bridge or cancellation prompts should be enabled by the 420Exchange web app.
