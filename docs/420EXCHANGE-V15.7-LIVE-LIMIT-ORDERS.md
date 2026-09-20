# 420Exchange V15.7 — Live testnet limit-order create/fill/cancel

## Repository status versus live evidence

V15.7 provides a testnet-only, manually invoked qualification path for EIP-712 order signing, an actual partial fill, and an actual cancellation of the remainder. Repository tests qualify the encoding and the refusal paths; they do not prove a live network trade. Live qualification remains `PENDING_LIVE_TESTNET_DRILL` until a protected GitHub Actions run records canonical evidence from a resolved testnet deployment.

## Canonical contract boundary

`ExchangeLimitOrderSettlement420` does **not** have an on-chain create-order method. The maker signs the exact V15.2 `LimitOrder` EIP-712 payload with `eth_signTypedData_v4`. The signature does not by itself establish that an order was published to an orderbook or accepted by a separate order relay. V15.7 qualifies cryptographic creation of a signed order and its on-chain fill/cancel behavior; orderbook publication remains a separate operational/API integration gate.

The filler calls `fillOrder((LimitOrder),uint128,bytes,bytes32,Hop[])` on the deployed settlement contract, which checks order signature (including ERC-1271 makers), expiry, nonce/cancellation, authorization, amount constraints, route hash and the atomic router. The maker subsequently calls `cancelOrder(LimitOrder)` to revoke the unfilled balance. The drill deliberately requires `allowPartial=true` and `0 < fillSellAmountRaw < sellAmountRaw`; trying to cancel a fully filled order would not meaningfully verify cancellation of remaining liquidity.

## Execution and evidence

The orchestrator `exchange/web/core/live-limit-order-qualification.js` uses two explicit providers. Each provider must support `eth_accounts`, `eth_chainId`, read RPC calls and its own user-authorized `eth_sendTransaction`; the maker provider must support `eth_signTypedData_v4`. Accounts may be separate disposable testnet wallets. The runner does not accept or serialize keys, seed phrases or mnemonics.

Sequence: resolved V15.1 runtime → live maker/filler chain/account validation → exact V15.2 typed data → V15.3 maker allowance/authorization/expiry check → V15.4 maker signature → on-chain zero-filled/uncancelled state read → fill-order calldata → V15.3 fill simulation/gas → V15.4 filler submission → V15.5 canonical `FINALIZED` receipt → on-chain exact partial-fill state read → maker-only cancel-order calldata → V15.3 cancel simulation/gas → V15.4 maker submission → V15.5 canonical `FINALIZED` receipt → on-chain cancellation and preserved partial-fill verification. Receipt failure, reorg, dropped transaction, mismatched storage, wrong chain/account, or timeout fails the drill.

Run `420Exchange Testnet Limit Order Qualification` manually from GitHub Actions in the protected `exchange-testnet` environment. Configure `EXCHANGE_TESTNET_MANIFEST_JSON` (resolved V15.1), `EXCHANGE_TESTNET_ORDER_FIXTURE_JSON` (canonical V15.7 fixture), `EXCHANGE_TESTNET_MAKER_RPC_URL`, and `EXCHANGE_TESTNET_FILLER_RPC_URL` as protected environment secrets. These URLs must refer only to disposable testnet provider endpoints that actually support separate account-scoped signing/submission; ordinary public read-only RPC endpoints do not provide that capability. Never use a production wallet or production assets.

Fixture JSON schema `420-exchange-live-limit-order-fixture-v15.7` requires `environment:"testnet"`, deployed `chainId`, `reviewedOrder` in the V15.2 format, complete raw-unit `execution` payload, and `fill` containing `filler`, `fillSellAmountRaw`, `signature` is NOT supplied (obtained from wallet), `expectedPathHash`, `hops`, and optional V15.3 `preflight`/`cancelPreflight` check configuration. The fixture must bind canonical route, allowance, and market IDs. The caller must provision maker token balance and approval to the deployed settlement contract and both wallets must have enough testnet gas.

The workflow uploads sanitized V15.7 JSON evidence: source SHA, chain, maker/filler, on-chain order hash, signed total, exact fill, cancelled remainder, final fill and cancel transaction hashes, block identities and final storage state. It does not publish typed-data signature, private signing material or provider URL.

## Required follow-up before production claims

Repository green is not operational testnet qualification; the unresolved checked-in manifest cannot execute this drill. Live on-chain storage/receipt qualification also does not itself prove V13 orderbook publication, full V13 ORDER/FILL/CANCELLATION indexing, or user-interface presentation; these remain explicit downstream integration requirements rather than inferred successes.

Next: **V15.8 — live testnet bridge lifecycle qualification**.
