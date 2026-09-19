# 420Exchange V15.10 — Genesis testnet closeout

## Decision

**NOT QUALIFIED for Genesis testnet launch.** V15.10 creates an executable, fail-closed evidence inventory; it does not convert green PR unit tests into live deployment evidence or authorize asset movement.

## Execute the closeout gate

From `exchange/web`:

```sh
npm run qualify:genesis
```

With the checked-in unresolved manifest and no external artifacts, the command prints a JSON report identifying every blocked gate and exits nonzero. This is the **expected** repository baseline. `npm run check` and `npm test` instead assert that this no-evidence baseline cannot be misreported as release-ready, and should pass in normal CI.

To assess an actual deployment, supply `EXCHANGE_GENESIS_MANIFEST` pointing to an independently verified resolved testnet manifest, `EXCHANGE_GENESIS_EVIDENCE_BUNDLE` pointing to an approved evidence bundle, and optionally `EXCHANGE_GENESIS_REPORT` for the generated report. The gate never fetches private credentials or performs swaps, fills, cancels or bridge transactions itself. Operator review must independently confirm artifact integrity, the source commit, the actual on-chain transaction and settlement, and the full deployment manifest; the bundle is an evidence inventory, not cryptographic proof.

## Required gates

1. **Resolved deployment:** real testnet chain ID, RPC and testnet manifest, never placeholder values.
2. **Verified contracts:** critical contract addresses and independently checked deployed bytecode/code hashes.
3. **V15.6 live swap:** real reviewed protected-workflow artifact with finalized canonical receipt, correct chain/commit and V13 indexer reconciliation.
4. **V15.7 live limit order:** maker EIP-712 signature, exact partial fill, finalized maker cancellation and on-chain state evidence; publishing to an orderbook requires separate proof.
5. **V15.8 live bridge:** distinct actual source/destination chains, finalized source event, externally sourced adapter proof, finalized inbound acceptance and destination registration; no synthetic proof.
6. **Beneficiary settlement:** registry/payout evidence; `InboundAccepted` alone does not establish payout.
7. **V15.9 browser/UI integration:** explicit multi-provider selection and safe listener lifecycle wired to the real user-facing Exchange, with user-initiated preflight and execution.
8. **Real browser-wallet matrix:** Chrome/Firefox/Brave desktop, iOS/Android wallet browsers and multiple-extension conflict tests with reproducible per-device evidence.
9. **V13 API/indexer:** real chain-backed read/stream freshness, order/trade/bridge state, reorg/replacement and degraded API exercises.
10. **Independent security review:** signed, traceable assessment of deployment, signer, permissions, bridge adapter/proof and approval boundaries.
11. **Operator signoff:** documented incident response, monitoring, rollback, testnet asset/account handling and release decision.

## Operational sequencing

Resolve V15.1 and verify code first; wire and test V15.9 browser execution before running real user-wallet drills. Run V15.6 swap, V15.7 order and V15.8 bridge qualification on the same reviewed release revision, retaining protected workflow artifacts. Independently examine beneficiary payout and V13 indexer alignment. Execute the real wallet/browser matrix and negative-path tests. Obtain security and operator signoffs. Only then rerun the V15.10 assessment and consider a separate release approval. No automatic deployment or PR merge is performed by this phase.

## Evidence rules

Do not put private keys, seed phrases, signatures, auth headers, RPC URLs containing credentials, or raw bridge proof payloads into public artifacts. A `QUALIFIED` flag entered by an operator is not a substitute for checking transaction hashes, source SHA, verified code hashes, settlement provenance and attached evidence. The assessment reports are advisory until externally verified and approved by accountable operators.

## Current blockers

The repository testnet manifest remains unresolved; live V15.6–V15.8 evidence is absent; V15.9 browser UI wiring and real device-wallet matrix remain incomplete; V13 live reconciliation, payout, security and operator signoffs remain unverified. Thus V15.10 implementation may pass repository CI while Genesis operational release remains blocked.
