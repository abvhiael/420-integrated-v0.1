---
title: Troubleshooting
category: troubleshooting
status: active
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

## Safety rules

- Never disclose or request private keys, seed phrases, passkeys, recovery secrets, signer material or authentication secrets.
- Confirm environment and chain identity before acting on addresses, contracts or service endpoints.
- Prefer canonical chain/protocol evidence over derived indexes, caches, dashboards or application presentation state.
- Treat retries of state-changing or value-changing actions as unsafe until transaction identity, canonical state and idempotency implications are understood.
- For validator/operator incidents, consensus safety outranks liveness: do not lower quorum, bypass signing protection, duplicate signer identity or force a preferred head.
- Stop and escalate when evidence is ambiguous, authority cannot be established, or a recovery step could increase loss or state divergence.

## Phase status

DOC-11.1 through DOC-11.4 are complete. The implementation roadmap is in [`DOC-11-ROADMAP.md`](DOC-11-ROADMAP.md).

Remaining domain registries will be added incrementally within the same DOC-11 branch/PR and merged only after the final ecosystem-wide troubleshooting audit and exact-head qualification.
