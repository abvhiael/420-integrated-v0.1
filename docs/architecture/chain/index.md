---
title: Chain architecture
component: chain
audience:
  - developer
  - operator
  - architect
category: architecture
status: development
version: current
---

# Chain architecture

This section documents the canonical chain model for 420 Integrated: execution, accounts, transactions, blocks, state, gas and fees, native `$420`, and network identity/configuration.

The chain documentation explains how canonical execution state is produced and exposed. Consensus-specific validator selection, epochs, rewards, slashing, finality rules, and consensus recovery belong to DOC-4.

## DOC-3 phase map

- **DOC-3.1 — [Execution layer](execution-layer.md)** — `node420`, the pinned Geth baseline, execution responsibilities, Engine API relationship, consensus system calls, and execution failure boundaries.
- **DOC-3.2 — [Accounts](accounts.md)** — EOAs, contracts, smart-account relationships, addresses, balances, nonces, code/storage, and custody boundaries.
- **DOC-3.3 — [Transactions](transactions.md)** — transaction structure, signing, submission, validation, execution, receipts, reverts, replay protection, replacement, and lifecycle.
- **DOC-3.4 — [Blocks and state](blocks-and-state.md)** — block composition, execution ordering, state/receipt commitments, logs, reorg handling, canonical versus finalized state, and protocol system-call incorporation.
- **DOC-3.5 — [Gas, fees, and native `$420`](gas-fees-native-420.md)** — gas accounting, base fee, priority-fee behavior, system-call gas rules, fee settlement, and native-currency semantics.
- **DOC-3.6 — [Network identity and configuration](network-identity-and-configuration.md)** — chain ID, genesis configuration, fork activation, ports/interfaces, genesis allocation, execution-client compatibility, and network identity checks.

## Authority boundary

Execution is authoritative for EVM-visible chain state, including:

- account balances and nonces;
- contract code and storage;
- transaction receipts and logs;
- protocol state represented in contracts;
- native `$420` accounting;
- execution state roots included in canonical blocks.

RPC, Indexer, Explorer, Search, Analytics, Wallet displays, and application caches may expose or project execution state, but they do not redefine it.

## Implementation anchor

The current execution client is `node420`, which requires the pinned go-ethereum v1.17.5 baseline plus the maintained 420 protocol patchset. The patchset includes the consensus-to-execution system-call mechanism required by genesis.

Exact binary qualification and release evidence belong to operator/release documentation; this section describes the architecture those binaries implement.

## Related documentation

- [System overview](../system-overview.md)
- [Genesis architecture](../genesis-architecture.md)
- [System dependency map](../dependency-map.md)
- [Trust-boundary model](../trust-boundary-model.md)
