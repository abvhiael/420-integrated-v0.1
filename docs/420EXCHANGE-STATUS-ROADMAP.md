# 420Exchange — implementation and Genesis readiness roadmap

**Reconciled:** 2026-09-19. **Working branch:** `feature/420exchange-v15.1-testnet-binding`; **PR:** [#352](https://github.com/abvhiael/420-integrated-v0.1/pull/352). **Evidence baseline:** `50ca04c0e5ecd5b702806aa30546485276db64a8`, [Exchange Web Verification run 35469241756](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35469241756) (successful static checks, web unit tests, frontend secret scan). This document is an implementation-status roadmap, not a security certification or authorization to trade.

## Status vocabulary

- **Repository implemented / unit-tested:** code and tests exist on the PR branch; not necessarily merged, deployed, integrated into the real page, or exercised with real wallets/contracts.
- **Partial / active:** components exist but integration or acceptance criteria are incomplete.
- **Blocked / not evidenced:** required real-world qualification has not been supplied or demonstrated; do not infer completion from fixtures, simulated RPC, caller-provided trust flags, or a green web-unit-test run.
- **Genesis release:** **BLOCKED**. Do not enable `swap-submit`, `order-sign`, `bridge-submit` or order-cancel wallet prompts based on this roadmap.

## Done in the repository (not a claim of live readiness)

| Workstream | Verified repository deliverable | Remaining distinction |
| --- | --- | --- |
| V15.1 runtime and deployment binding | Deployment-aware runtime validation, unresolved/testnet fail-closed checks and deployment configuration tooling. | The actual deployment manifest, contract code, network and endpoints require independent live verification. |
| V15.2 canonical execution construction | Deterministic raw-unit swap/bridge/cancel transaction builders and limit-order signing payload preparation (`exchange/web/core/execution.js`, `canonical-execution-inputs.js`). | Building a transaction is not proof that its route, allowance, counterparty or bridge can execute on chain. |
| V15.3–V15.4 preflight / wallet-execution building blocks | Transaction fingerprint, preflight checks, guarded transaction submission and qualified order-signing APIs (`preflight.js`, `wallet-execution.js`, `browser-execution-controller.js`). | Browser trading forms do not call those methods for live trades; real RPC, gas, allowance, nonce and contract-state evidence is outstanding. |
| V15.5 transaction-state support | Transaction lifecycle work exists in the V15 stack. | Real submitted, reverted, replaced, reorged and indexer-conflict cases need observed browser/testnet evidence. |
| V15.6–V15.8 live qualification scaffolding | Swap, limit-order and bridge testnet workflows / scripts are present in the repository. | Script or workflow presence does not establish successful real-network execution or settlement; capture and review live receipts, proofs and reconciliation. |
| V15.9 wallet/provider compatibility | EIP-6963 discovery, explicit provider selection, session-generation invalidation and listener cleanup in controller/UI tests. | Real browser/extension/mobile wallet matrix remains outstanding. |
| V15.10 qualification gates | Genesis closeout script / release-gate framework exists. | Gate remains BLOCKED pending independent evidence and signoff. |
| V15.11 wallet integration | `browser-wallet-ui.js` mounts wallet selection in the build; demo-backed legacy V14 signing/submission controls remain locked. | The legacy display-derived V14 form is **not** an execution source; live swap, order, bridge and cancellation forms are not qualified. |
| V15.11 swap review construction | `canonical-execution-inputs.js`, `human-readable-review.js`, `reviewed-execution-bridge.js` and `bound-swap-review.js` bind raw units, display fields, calldata and transaction fingerprint in repository tests. | The source-authentication boolean is **not** provider authentication; the bound review is not connected to a permitted live submit path. |
| V15.11 quote intake / freshness | `executable-quote-intake.js` validates a configured HTTPS same-origin endpoint, request/response fields, expiry at receipt and endpoint consistency. | No independently authenticated, operator-approved, live executable-quote producer is established by this client. Schema flags and TLS are not proof of on-chain qualification. |
| V15.11 quote-session / read-only UI | `quote-review-session.js` invalidates late/stale responses on request, wallet or chain changes; `read-only-swap-review-ui.js` is included in the browser build and shows only explicit raw-unit review candidates. | Requires valid runtime and configured quote endpoint; no signing or submission action. Full real DOM, accessibility and browser tests remain to be run. |
| Web build and code CI | PR-head Exchange Web Verification run 35469241756 passed static checks, web unit tests and frontend secret scan. | Does not substitute for contract-suite, deployment, live drill, wallet/device or security qualification. |

## Where we are now: V15.11 integration and evidence closeout

The site has a V14 read/display catalog and a separate V15 read-only candidate-review panel. Trading actions are deliberately disabled. The checked-in `exchange/web/runtime-config.json` does not specify a real chain ID, RPC URL, API base URL or executable-quote endpoint, and client-side quote intake does not itself establish quote provenance. PR #352 is open and **not merged**; its previous green CI run applies to its previous code head, not automatically to later commits. The existing `exchange/web/v15.11-qualification.json` and `docs/420EXCHANGE-V15.11-BROWSER-EXECUTION.md` describe earlier partial integration and must be reconciled before closeout.

**Next engineering increment — V15.11.1 (read-only browser verification):** test the deployed V15 panel with real DOM, screen readers/keyboard, navigation, account/network changes and slow/aborted quote responses. Reconcile displayed field names with `canonicalSwapReview` (`transactionFingerprint` versus any display alias) and ensure invalid/missing quote configuration, invalid response, stale review and changed user input visibly clear the panel. Do not add wallet prompts.

**V15.11.2 (real quote service and source qualification):** implement a documented, versioned, authenticated executable-quote producer on an explicitly approved testnet origin. Bind provider identity, deployment and contract code, chain/account, token metadata, route/market IDs, raw amounts, nonce or replay protection and expiry to each quote; define quote error/freshness semantics. Verify the producer against deployed contracts and a trusted source-of-truth. Only then replace caller-provided flags with verifiable provenance in the browser intake and review boundary.

**V15.11.3 (operational testnet preflight):** publish and independently verify the deployment manifest, contract addresses/code hashes, network/RPC and router/market/bridge configuration. Exercise actual provider reads and simulation for balance, allowance, approval lifecycle, gas, nonce, fees, authorization, route availability, stale state and revert handling. Capture redacted evidence. Keep signing disabled until qualification passes.

**V15.11.4 (explicit wallet-confirmed swap pilot):** after trusted quotes and preflight are operational, bind the live V15 swap form to one selected wallet/session and exact reviewed transaction. Require a fresh second check and explicit user confirmation; enforce chain/account and transaction-fingerprint stability immediately before wallet submission. Roll out a *testnet-only*, feature-gated pilot with transaction lifecycle and receipts. Do not use the V14 fixture/display quote as an executable input.

**V15.11.5 (order and cancellation UI):** integrate qualified EIP-712 order review/signing, maker ownership, nonce/expiry, actual publication/status, partial fills and cancellation with fresh on-chain checks; handle rejected signatures and failed/cancelled operations explicitly.

**V15.11.6 (bridge UI and settlement):** integrate separately qualified routes, adapters/verifiers, destination-chain manifest, proof verification and source/destination status; track destination finality, correct beneficiary payout, retries and exception recovery. Outbound submission or proof registration alone is not settlement.

## Remaining Genesis exit gates (required evidence, not box-ticking)

1. **Source and deployment:** audited/approved executable-quote authority, verified token metadata, exact deployed code/configuration and qualified testnet runtime; security review of quote replay and provenance controls.
2. **Functional live drills:** successful and negative-path real swap, order/sign/fill/cancel and bridge/source-to-destination settlement runs, with hashes/receipts, failure classifications and operator runbooks; complete V15.6–V15.8 evidence.
3. **Client acceptance:** real Chrome, Firefox, Brave, competing extensions and mobile in-app wallets; account/network/provider switches, stale-quote races, user rejection, incorrect approvals, offline and resumed sessions, and accessible UI review. Confirm no wallet prompt from fixtures or unresolved runtime.
4. **Accounting and resilience:** transaction/reorg/replacement reconciliation, orderbook/indexer convergence, protocol fees/beneficiary accounting, bridge payout and withdrawal reconciliation and operational alert/recovery evidence.
5. **Security and operations:** independent review, threat model, permission/role checks, reproducible build and deployment provenance, secrets handling, incident/rollback procedures, monitoring and named operator/security signoffs.
6. **Release control:** update `v15.11-qualification.json` and the browser runbook with actual evidence, run all applicable web/contract/testnet suites on the exact release head, reconcile PR #352 with current `main`, and merge only after required reviews. A merged PR or green unit tests alone are not Genesis approval.

**Current release decision:** `BLOCKED`; **browser execution:** disabled. When the verified quote provider and deployment are unavailable, the next permissible user-facing milestone is improved **read-only review and validation**, not demo-backed signing.
