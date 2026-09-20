# 420Exchange V15.11 — browser execution integration

**Status as of 2026-09-19: PARTIAL, EXECUTION LOCKED.** See [the reconciled status roadmap](420EXCHANGE-STATUS-ROADMAP.md) and `exchange/web/v15.11-qualification.json` for the current phase and release gates.

## Implemented on PR #352

`exchange/web/core/browser-execution-controller.js` composes provider selection, wallet generation/session invalidation, preflight and guarded wallet execution. `exchange/web/browser-wallet-ui.js` is mounted before the V14 app by `exchange/web/scripts/build.mjs` and exposes wallet selection, while intercepting and disabling legacy swap, order, bridge and cancellation execution controls. This is **wallet discovery/selection integration, not a completed browser trading integration**.

`exchange/web/core/canonical-execution-inputs.js`, `human-readable-review.js`, `reviewed-execution-bridge.js` and `bound-swap-review.js` provide deterministic transaction preparation, display/review and fingerprint checks. `executable-quote-intake.js` validates an explicitly configured HTTPS endpoint's candidate response and receipt-time freshness; this does **not** authenticate the quote producer, source data or contract state. `quote-review-session.js` invalidates stale/changed wallet or trade sessions. `read-only-swap-review-ui.js` is mounted separately from the V14 display quote and can display a V15 review candidate from explicit token addresses and integer raw-unit inputs, provided a resolved testnet runtime and endpoint exist. It has no signing or transaction submission action.

The earlier statement that the controller is not mounted by `app.js` must not be read as saying no V15 browser UI is mounted: it is mounted by the build's separate browser-wallet entrypoint. The statement remains true that **live V15 execution is not wired through the V14 forms**, and the checked-in runtime does not configure a live executable-quote endpoint.

## Required browser qualification and wiring

1. Verify the read-only UI in real DOM/browser tests: review display/envelope field names, invalidation on input changes, navigation, account/chain/provider changes, expiry, slow responses, aborts and navigation races, keyboard/screen-reader behavior and no wallet prompts.
2. Publish an independently verified testnet deployment manifest (chain, RPC, contract addresses and code hashes) and operator-approved, authenticated, replay-resistant executable-quote service. Validate the quote against deployed contracts, qualified markets/routes, token metadata, timestamps and the exact request/account; replace caller-provided `sourceAuthenticated` flags with independently verifiable evidence before any execution path.
3. Swap: connect **only qualified V15** inputs to fresh canonical review and real on-chain preflight. Compare human-readable amounts and full route against reconstructed calldata; recheck wallet generation, account, network and exact transaction fingerprint immediately before an explicit wallet-confirmed *testnet-only* submission. Preserve legacy V14 display/fixture separation. Render rejection, revert, replacement, reorg, settlement and indexer conflict states.
4. Limit orders: qualify EIP-712 domain and deployed verifying contract, real maker ownership, raw amounts, nonce and expiry, publication and fill status, partial fills, and maker-only cancellation after fresh authorization checks. A signature alone is not publication.
5. Bridge: qualify route/adapter/verifier and destination manifests and proofs, finality, destination receipt, payout to the correct beneficiary, retries and failure/recovery states. Outbound submission or inbound proof registration is not settled payout.
6. Run real Chrome, Firefox, Brave, competing extension, mobile in-app wallet and assistive technology acceptance tests. Reject demo/unresolved data without wallet prompts and exercise wrong-chain, insufficient allowance, stale quote, user rejection and interrupted RPC paths.
7. Capture live V15.6–V15.8 swap/order/bridge drills, beneficiary/fee/indexer reconciliation, independent security and operator signoffs, deployment provenance and rollback/incident runbooks. Run all required CI and release qualifications at the *exact final branch head*.

## Exit status

The prior-head [Exchange Web Verification run 35469241756](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35469241756) passed static checks, web unit tests and frontend secret scan. It does not certify current/future heads, live deployment, browser devices or settlement. `npm run qualify:genesis` remains **BLOCKED** and wallet signing/submission controls must remain disabled until all applicable evidence and approvals are recorded.
