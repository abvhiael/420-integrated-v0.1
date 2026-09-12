---
title: Troubleshooting
category: troubleshooting
status: current
version: current
---

# 420 Integrated troubleshooting

This section is the ecosystem-wide entry point for diagnosing failures, degraded behavior and recovery conditions across 420 Integrated.

DOC-11 organizes troubleshooting around two ways people actually arrive here:

1. **By symptom** — what the user, developer or operator can observe.
2. **By stable troubleshooting ID** — a durable documentation identifier that can be linked from Wallet, dApps, developer tooling, support material and later contextual help.

## Start here

- [Troubleshooting registry contract](registry-contract.md) — stable ID, severity, authority, retry and secret-safety rules.
- [Troubleshooting entry template](entry-template.md) — required shape for every registry entry.
- [Wallet, account and authorization registry](wallet-account-authorization.md) — `TRB-WALLET-001` through `TRB-WALLET-011` covering connection, network mismatch, SmartAccount420 discovery, capabilities/sessions, passkeys, signing/simulation, recovery, transaction outcomes, stale presentation and compromise response.
- [Chain, RPC and transaction registry](chain-rpc-transactions.md) — `TRB-CHAIN-*`, `TRB-RPC-*` and `TRB-TX-*` covering chain identity, transport/method failures, ambiguous submissions, nonce/gas/replacement states, receipt/revert handling, finality/reorgs and canonical-versus-derived disagreements.
- [Consensus, validator and node registry](consensus-validator-node.md) — `TRB-CONSENSUS-*` and `TRB-NODE-*` covering validator lifecycle, proposer/attestation/QC/finality symptoms, quorum loss, partitions, safety halts, signing conflicts, `fourtwentyd`/`node420`, Engine connectivity, consensus/execution divergence and crash recovery.
- [Indexer, Explorer, Search, Analytics and Status registry](indexer-explorer-search-analytics-status.md) — `TRB-INDEXER-*`, `TRB-EXPLORER-*`, `TRB-SEARCH-*`, `TRB-ANALYTICS-*` and `TRB-STATUS-*` covering stale/missing projections, replay/rebuild states, presentation mismatches, readiness semantics and canonical-RPC fallback.
- [Value movement and economics registry](value-movement-economics.md) — `TRB-PAY-*`, `TRB-TOKEN-*`, `TRB-SWAP-*`, `TRB-BRIDGE-*`, `TRB-STAKE-*` and `TRB-TX-008` covering ambiguous payment/swap outcomes, invoices/quotes, refunds, settlement, token deployment/balances, bridge proof/replay/finality, staking lifecycle, rewards and fee interpretation.
- [Shared protocol and provider registry](shared-protocol-provider.md) — `TRB-REGISTRY-*`, `TRB-NAMES-*`, `TRB-IDENTITY-*`, `TRB-RANDOM-*`, `TRB-ORACLE-*`, `TRB-STORAGE-*`, `TRB-AI-*`, `TRB-RIGHTS-*`, `TRB-VERIFY-*`, `TRB-ARBITRATION-*`, `TRB-MESSENGER-*`, `TRB-NOTIFY-*` and `TRB-ATTENTION-*` covering discovery, freshness, proofs, provider availability, AI jobs, rights/evidence, disputes and off-chain delivery boundaries.
- [Genesis application coverage](genesis-application-coverage.md) — maps all 20 frozen Genesis/testnet application manual targets into DOC-11 and defines the limited `TRB-APP-*` cases for AppStore, Governance and Faucet where application-level indexing is useful.
- [Search, diagnostics and support workflow](search-diagnostics-support.md) — exact-ID and symptom search, audience/severity/surface routing, copy-safe diagnostic bundles, escalation paths and stable deep-link rules for later contextual help.
- [DOC-11 coverage audit](coverage-audit.md) — phase-wide ID, authority, retry/finality, secret-safety, application coverage, search/navigation and provenance audit.

## Safety rules

- Never disclose or request private keys, seed phrases, passkeys, recovery secrets, signer material or authentication secrets.
- Confirm environment and chain identity before acting on addresses, contracts or service endpoints.
- Prefer canonical chain/protocol evidence over derived indexes, caches, dashboards or application presentation state.
- Treat retries of state-changing or value-changing actions as unsafe until transaction identity, canonical state and idempotency implications are understood.
- For validator/operator incidents, consensus safety outranks liveness: do not lower quorum, bypass signing protection, duplicate signer identity or force a preferred head.
- For payments, swaps, refunds, bridge messages and staking writes, a timeout or stale UI is never proof of failure; identify the original operation and reconcile canonical state before retrying.
- For Indexer/Explorer/Search/Analytics/Status discrepancies, repair or rebuild the derived layer; do not mutate canonical state merely to make the UI match.
- For provider-backed protocols, provider-local success/failure is operational evidence only; use replacement/fallback providers only through canonical protocol rules.
- Application manuals may summarize first actions, but shared `TRB-*` entries own the stable retry/recovery identity; do not fork recovery procedures across application pages.
- Support reports use sanitized, copy-safe diagnostics only; never include signer, recovery, bearer-token, Engine/JWT or private payload secrets.
- Stop and escalate when evidence is ambiguous, authority cannot be established, or a recovery step could increase loss or state divergence.

## Phase status

DOC-11.1 through DOC-11.10 are complete at the documentation-content level. See the [DOC-11 roadmap](DOC-11-ROADMAP.md) and [coverage audit](coverage-audit.md).

The monolithic phase is now at its final merge gate: reconcile with current `main`, qualify the reconciled exact head, require green 420Docs and 420 Integrated qualification, then merge PR #230 once.
