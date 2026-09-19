# 420Exchange V15.9 — Wallet and Browser Execution Compatibility

## Repository vs operational status

V15.9 provides testable EIP-1193 provider discovery, deliberate multi-wallet selection, read-only live chain/account inspection, and session-snapshot drift gates. Tests run against provider doubles. **No claim is made that real browsers or actual wallets were exercised.**

The current `exchange/web/app.js` still selects `globalThis.ethereum` directly and only prepares review requests instead of connecting actual V15.2–V15.8 execution modules to UI controls. Consequently real browser compatibility and interactive testnet transaction execution remain unqualified. The module is an integration building block, not evidence of completed multi-wallet UI integration.

## Requirements before Genesis closeout

1. Wire EIP-6963 discovery with an `eip6963:requestProvider` event and `eip6963:announceProvider` listeners; make the user select among multiple distinct providers and retain that selection only for the connected session. Legacy `window.ethereum.providers` is a fallback, not an ordering preference.
2. Replace direct `globalThis.ethereum` auto-selection in the browser app with explicit provider selection when more than one provider exists. Register and **remove** old wallet event listeners when switching providers.
3. Invalidate quotes, reviews, preflights, pending signatures and account-bound displays on `accountsChanged`, `chainChanged` and `disconnect`; re-check the live wallet immediately before sending.
4. Reconcile wallet provider errors 4001 (rejected), 4100 (unauthorized), 4200 (unsupported method), 4900 (disconnected) and 4901 (chain disconnected). Never silently retry a rejected signature or duplicate a transaction submission.
5. Bind V15.2 transaction builders, V15.3 preflight and V15.4 transaction/typed-data execution to **user-initiated** browser controls with reviewed chain, account, token, amount and destination details. Treat submitted hashes as pending until V15.5 canonical receipt/finality evidence arrives.
6. Verify wallet and browser matrix: desktop Chrome/Firefox/Brave with supported injected wallet extensions; Chrome Android/Safari iOS in compatible in-app-wallet browsers; and two simultaneously installed extensions. For each combination record actual product/version, OS, source SHA, testnet chain, wallet account (public address only), consent/rejection tests, chain/account change during approval, connect/disconnect, swap, limit-order signature/fill/cancel, bridge outbound and status recovery.
7. Run against a **resolved**, validated testnet manifest and disposable testnet funds. Preserve redacted screenshots, source/destination transaction hashes, receipts, wallet/browser versions, chain IDs and dates in protected evidence. Never collect private keys, recovery phrases or RPC credentials.
8. Distinguish EIP-712 signature from on-chain order creation, inbound proof acceptance from beneficiary payout, and green mocked CI from real-wallet/device tests.

## Automated coverage

`core/wallet-compatibility.js` and `test/wallet-compatibility.test.js` test provider detection/identity, EIP-6963/legacy deduplication, explicit multi-wallet selection, connectivity, wrong chain, account drift, disconnect and stale generation. Existing `wallet-execution.test.js` covers wallet request handoffs with mocked EIP-1193 providers.

## Operational closeout

Mark V15.9 operationally qualified only after every release-matrix row has dated real-browser evidence and the browser UI executes the relevant V15 flows on testnet. Until then the matrix remains `NOT_RUN` and release qualification stays blocked. Follow-on: V15.10 Genesis closeout.
