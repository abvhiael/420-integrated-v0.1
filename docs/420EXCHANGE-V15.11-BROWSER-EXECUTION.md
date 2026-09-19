# 420Exchange V15.11 — browser execution integration

## Repository work in this phase

`exchange/web/core/browser-execution-controller.js` composes the V15.9 EIP-1193/EIP-6963 provider chooser, wallet session invalidation, V15.3 transaction preflight and V15.4 transaction submission / qualified EIP-712 signing. Unit tests prove the fail-closed controller boundary. **It is not yet mounted by `exchange/web/app.js`, so this is not a completed browser execution integration.**

## Required application wiring before release

1. Mount one controller after validated runtime initialization. Pass a **bound V15.1 deployment runtime**, not the legacy runtime containing only `EXCHANGE_CHAIN_ID`. Unresolved or demo runtime must disable signing and submission.
2. Listen for EIP-6963 wallet announcements and request the provider list on the window event target. If more than one wallet is detected, show a user-selected wallet list; do not silently choose `globalThis.ethereum`. Unregister discovery and account/chain/disconnect listeners when replacing providers or leaving the application.
3. Connect user-initiated controls to the selected provider and discard all reviewed intents and preflight evidence upon account change, chain change, wallet disconnect, provider replacement, or runtime replacement. Check epoch/generation again after asynchronous RPC calls.
4. Swap: replace `fixtures/swap-quote.json` display values with authenticated canonical quote data and exact raw units. Construct the V15.2 transaction, display exact input, minimum output, recipient and fee for user review, call the controller preflight/submit only on explicit confirmation, and show V15.5 transaction lifecycle including reverted, reorged, replaced and indexer conflict states.
5. Limit orders: gather contract addresses and integer raw units rather than display symbols/floating-point values. Use V15.3 order signing qualification and V15.2 EIP-712 payload with the selected maker wallet; never represent a signature as an on-chain orderbook publication. Implement actual maker cancellation from the canonical order hash and fresh authorization checks.
6. Bridge: use qualified canonical routes, actual source and destination manifests, exact units, separately sourced proof, and finalized source/destination events; do not equate a submitted outbound transaction or inbound registration with beneficiary payout.
7. Render user rejection, unsupported RPC method, wrong chain, stale review, simulation revert and insufficient allowance as explicit recoverable or terminal states. Never log private keys, seed phrases, raw signatures or opaque proof bytes.
8. Add browser DOM and real-wallet acceptance tests for Chrome, Firefox, Brave, mobile wallet in-app browsers and at least two competing wallet extensions. Verify no wallet prompt is possible when demo fixtures or unresolved runtime are active.

## Exit status

Controller repository tests may pass while browser integration remains `BLOCKED_APP_JS_NOT_WIRED`. V15.10 Genesis release assessment remains BLOCKED until the browser UI, real deployment, live drill evidence and independent operator/security reviews are complete.
