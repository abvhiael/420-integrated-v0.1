---
title: Chain, RPC and transaction troubleshooting registry
audience:
  - user
  - developer
  - operator
category: troubleshooting
status: current
version: current
---

# Chain, RPC and transaction troubleshooting registry

Use these stable troubleshooting IDs for chain identity, RPC transport/method behavior, transaction submission, nonce/gas/replacement issues, receipt interpretation, finality and reorganization symptoms. Canonical chain/node state outranks gateway, Explorer, Indexer, Search or application presentation.

A timeout is not proof that a write failed. Before retrying any signed/state-changing action, preserve the transaction hash/raw transaction identity where available and inspect canonical state.

## `TRB-CHAIN-001` — Network or chain identity does not match

- **Audience:** user, developer, operator
- **Surface:** wallet, dApp, RPC client, deployment tooling
- **Symptom:** the reported chain ID/environment differs from the intended 420 Integrated network, or configured contracts/services do not match the selected network.
- **Severity:** blocked
- **Authority source:** approved network manifest/chain identity plus canonical RPC `eth_chainId`/network evidence.
- **Likely causes:** wrong endpoint; stale/manual network configuration; local/devnet values promoted into another environment; application connected to a different wallet network.
- **Retry safety:** not-applicable until identity is corrected.
- **Safe diagnostics:** endpoint label, chain ID, environment name, client version, approved manifest identity. Do not share endpoint credentials.
- **Recovery:** stop writes; compare chain ID and approved network manifest; switch to a qualified endpoint; re-resolve deployment/service identities for that environment; reconnect clients.
- **Escalate when:** approved identity and canonical RPC disagree or the canonical environment cannot be established.

## `TRB-RPC-001` — RPC endpoint unavailable or transport failing

- **Audience:** user, developer, operator
- **Surface:** public RPC/WSS, gateway/proxy, client transport
- **Symptom:** connection refused, timeout, TLS/proxy failure, repeated disconnects or no JSON-RPC response.
- **Severity:** degraded
- **Authority source:** endpoint health plus direct qualified canonical-node RPC where available.
- **Likely causes:** gateway outage; rate limiting; network path/TLS failure; stale endpoint; node process unavailable.
- **Retry safety:** safe for read-only calls; conditional for writes.
- **Safe diagnostics:** endpoint hostname, timestamp, method name, HTTP/WebSocket status, sanitized error, health/readiness response.
- **Recovery:** distinguish transport failure from method error; test a read-only identity/health request; fail over to another qualified endpoint; if operating the service, verify proxy then node health.
- **Stop before write retry:** confirm whether the signed transaction was already accepted by any endpoint or visible by hash.
- **Escalate when:** multiple qualified endpoints fail or canonical node health is unavailable.

## `TRB-RPC-002` — RPC method rejected, invalid or unsupported

- **Audience:** developer, operator
- **Surface:** public JSON-RPC
- **Symptom:** `method not found`, invalid request/params, policy rejection, or unsupported public method.
- **Severity:** blocked
- **Authority source:** generated public RPC reference and runtime RPC response.
- **Likely causes:** private/admin method used on public RPC; malformed params; unsupported compatibility assumption; client version mismatch.
- **Retry safety:** safe only after correcting the request.
- **Safe diagnostics:** method name, sanitized params shape, JSON-RPC error code/message, client build.
- **Recovery:** verify the method is in the public RPC surface; correct request/parameter shape; do not substitute private Engine/admin/signer methods through a public gateway.
- **Escalate when:** a documented public method is rejected consistently by a healthy qualified endpoint.

## `TRB-RPC-003` — RPC data disagrees between endpoints

- **Audience:** developer, operator
- **Surface:** multiple RPC providers/gateways
- **Symptom:** block number, receipt, balance, nonce or logs differ across endpoints.
- **Severity:** degraded
- **Authority source:** canonical node state at the relevant block/finality level.
- **Likely causes:** provider lag; different head/safe/finalized views; reorg; stale cache; endpoint on wrong chain.
- **Retry safety:** conditional.
- **Safe diagnostics:** chain ID, block hash/number, finality tag, endpoint identities, transaction hash.
- **Recovery:** verify all endpoints are on the same chain; compare explicit block hashes/finality tags instead of only `latest`; prefer canonical/finalized evidence for irreversible decisions.
- **Escalate when:** finalized-state disagreement persists across qualified canonical sources.

## `TRB-TX-001` — Transaction submission timed out or returned an ambiguous result

- **Audience:** user, developer
- **Surface:** wallet, SDK, RPC `eth_sendRawTransaction`
- **Symptom:** submission timed out/disconnected and the caller does not know whether the transaction was accepted.
- **Severity:** value-risk
- **Authority source:** canonical transaction lookup/receipt plus sender nonce state.
- **Likely causes:** response lost after acceptance; gateway timeout; endpoint failover; transient node pressure.
- **Retry safety:** unsafe blind retry.
- **Safe diagnostics:** transaction hash if locally derivable/returned, sender, nonce, chain ID, submission timestamp.
- **Recovery:** preserve the signed transaction identity; query by hash; inspect sender nonce/pending state; only resubmit the same signed transaction when the client flow explicitly treats that as safe; do not create a fresh value-moving transaction merely because the response timed out.
- **Escalate when:** canonical lookup and nonce state remain ambiguous.

## `TRB-TX-002` — Nonce too low, nonce too high or nonce lane blocked

- **Audience:** user, developer
- **Surface:** EOA/smart-account transaction submission
- **Symptom:** nonce-related rejection, later transactions remain pending behind an earlier nonce, or local nonce differs from canonical state.
- **Severity:** blocked
- **Authority source:** canonical account nonce plus known pending/included transactions.
- **Likely causes:** concurrent senders; stale local nonce cache; earlier pending transaction; already-included/replaced transaction.
- **Retry safety:** conditional.
- **Safe diagnostics:** sender, chain ID, candidate nonce, canonical transaction count, known hashes for nearby nonces.
- **Recovery:** rebuild nonce view from canonical state and known pending transactions; resolve the earliest missing/pending nonce first; use explicit replacement/cancellation semantics if supported.
- **Escalate when:** signing infrastructure is issuing conflicting transactions for the same nonce without an intentional replacement policy.

## `TRB-TX-003` — Insufficient balance, fee or gas condition

- **Audience:** user, developer
- **Surface:** transaction preparation/submission
- **Symptom:** insufficient funds, intrinsic gas/fee rejection, estimate failure tied to balance/fee constraints.
- **Severity:** blocked
- **Authority source:** canonical balance, fee data and execution rules.
- **Likely causes:** insufficient `$420` for value plus gas; stale balance; incorrect gas/fee assumptions; state changed since simulation.
- **Retry safety:** conditional after correcting funding/fee inputs.
- **Safe diagnostics:** public sender, value, gas limit, fee parameters, canonical balance, estimate result.
- **Recovery:** refresh canonical balance/fee data; re-estimate; reduce/adjust the intended action only when semantically valid; never bypass a revert/simulation failure by arbitrarily raising gas.
- **Escalate when:** estimates fail despite valid balance and a known-good call against current state.

## `TRB-TX-004` — Replacement or cancellation is not taking effect

- **Audience:** user, developer
- **Surface:** pending transaction replacement
- **Symptom:** replacement remains pending, original still appears, or multiple same-nonce candidates are visible.
- **Severity:** value-risk
- **Authority source:** canonical inclusion state for the nonce and transaction hashes.
- **Likely causes:** replacement fee insufficient; original already included; provider mempool differences; replacement not propagated.
- **Retry safety:** unsafe without nonce/hash inspection.
- **Safe diagnostics:** sender, nonce, all candidate transaction hashes, fee parameters, inclusion/receipt status.
- **Recovery:** identify whether any candidate is already included; if none are included and replacement is supported, follow wallet/client replacement policy; do not keep generating same-nonce variants blindly.
- **Escalate when:** conflicting signed transactions exist unexpectedly or value destinations differ.

## `TRB-TX-005` — Transaction is pending longer than expected

- **Audience:** user, developer
- **Surface:** transaction lifecycle
- **Symptom:** a known hash has no receipt and remains pending/unconfirmed.
- **Severity:** degraded
- **Authority source:** canonical transaction/nonce state and current chain progress.
- **Likely causes:** fee competitiveness; blocked nonce lane; temporary congestion; propagation issue; endpoint lag.
- **Retry safety:** conditional.
- **Safe diagnostics:** hash, sender, nonce, fee parameters, chain head progress, earlier nonce transactions.
- **Recovery:** verify the chain is progressing; resolve earlier nonce blockers; use explicit replacement only if supported; otherwise wait rather than duplicating the semantic action.
- **Escalate when:** the transaction disappears from all qualified sources while nonce state remains unresolved.

## `TRB-TX-006` — Included transaction failed/reverted

- **Audience:** user, developer
- **Surface:** execution receipt
- **Symptom:** receipt exists but execution status indicates failure/revert.
- **Severity:** blocked
- **Authority source:** canonical receipt and runtime revert/error evidence.
- **Likely causes:** changed contract state; insufficient authority; expired deadline; invalid calldata; protocol precondition failure.
- **Retry safety:** unsafe until the cause is understood; gas may already have been consumed.
- **Safe diagnostics:** transaction hash, receipt, block/finality status, surfaced revert/error identifier, target address.
- **Recovery:** inspect receipt/runtime error; re-read canonical state; correct the underlying precondition; re-simulate before any new signed attempt.
- **Escalate when:** the same valid call consistently fails without a documented/runtime-identifiable cause.

## `TRB-CHAIN-002` — Receipt/block disappeared or changed after a reorganization

- **Audience:** user, developer, operator
- **Surface:** blocks, receipts, logs, application confirmation state
- **Symptom:** a previously seen receipt/block/log is missing or replaced, or transaction confirmation count decreases.
- **Severity:** degraded
- **Authority source:** current canonical head plus safe/finalized mapping.
- **Likely causes:** normal pre-finality reorganization; provider lag; derived index not yet reconciled.
- **Retry safety:** conditional.
- **Safe diagnostics:** transaction hash, old/new block hash, block number, prior/current finality state.
- **Recovery:** re-query canonical transaction/receipt state; wait for the required finality level; allow Indexer/Explorer projections to reconcile; do not mutate canonical state merely to make a derived view match.
- **Escalate when:** a transaction previously reported finalized is no longer canonical.

## `TRB-CHAIN-003` — Head, safe and finalized states are being confused

- **Audience:** user, developer, operator
- **Surface:** confirmation/finality handling
- **Symptom:** an application treats `latest` as irreversible, or different interfaces show different confirmation states.
- **Severity:** value-risk
- **Authority source:** consensus-defined head/safe/finalized mapping and canonical RPC tags.
- **Likely causes:** confirmation policy too weak; UI collapses finality states; provider only showing head progress.
- **Retry safety:** not-applicable.
- **Safe diagnostics:** block hash/number and its head/safe/finalized status.
- **Recovery:** apply the task-appropriate finality requirement; for value/cross-chain/irreversible decisions, do not substitute mere inclusion for the required safe/finalized state.
- **Escalate when:** canonical endpoints disagree on finalized mapping.

## `TRB-CHAIN-004` — Explorer/Indexer presentation disagrees with canonical RPC

- **Audience:** user, developer, operator
- **Surface:** Explorer, Indexer, Search, application activity views
- **Symptom:** balance, receipt, log, status or block presentation differs from canonical RPC.
- **Severity:** degraded
- **Authority source:** canonical chain/protocol state; derived services remain rebuildable/non-authoritative.
- **Likely causes:** indexing lag; reorg reconciliation; stale cache; service replay/rebuild.
- **Retry safety:** unsafe if the only reason to retry a write is stale derived presentation.
- **Safe diagnostics:** transaction/block hash, canonical RPC result, derived service cursor/status, timestamps.
- **Recovery:** trust canonical state for action decisions; allow/rebuild the derived service; cross-link the discrepancy into Indexer/Explorer troubleshooting rather than resubmitting chain writes.
- **Escalate when:** derived state fails to converge after canonical finality and normal recovery/replay.

## Related documentation

- [Troubleshooting registry contract](registry-contract.md)
- [Wallet/account troubleshooting](wallet-account-authorization.md)
- [Chain transactions](../architecture/chain/transactions.md)
- [Blocks and state](../architecture/chain/blocks-and-state.md)
- [Generated public RPC reference](../reference/generated/rpc.md)
- [Developer documentation](../developers/index.md)
