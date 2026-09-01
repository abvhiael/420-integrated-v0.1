# 420Explorer — Genesis Profile

420Explorer is the reference observability and discovery application for 420 Integrated. It is intentionally contract-free: the Explorer does not own protocol state, authorize actions, custody assets, or become a dependency for direct chain interaction.

## Canonical sources

The Explorer derives execution truth from 420 Integrated blocks, transactions, receipts, logs and deployed runtime bytecode. Consensus presentation distinguishes head, safe and finalized state, including slot, epoch, rotation, proposer and quorum-certificate metadata when exposed by supported nodes. Protocol service names, active implementations, version history, manifests and interface commitments are resolved through 420Registry. 420 Names and 420 Identity may enrich display labels without replacing canonical addresses or records.

## Indexing model

Indexed records are keyed to chain ID and canonical block hash. Non-finalized history may be repaired following a reorg; finalized history must not be silently rewritten. The hosted index database is a replaceable cache and must be reconstructable from chain/RPC, receipts, logs, consensus metadata and registry reads.

## Contract and protocol discovery

For deployed contracts the Explorer exposes runtime bytecode/code hash, transaction history, emitted events and available verification metadata. Registered protocol components should additionally show their 420Registry service identifier, version, component type, manifest commitment, dependency root and interface commitment. Verified source code is presentation metadata and never overrides deployed bytecode.

## Availability and authority

Explorer outages cannot block wallets, RPC clients or dApps from using the network. Explorer operators receive no custody, governance, bridge, validator, smart-account execution or token-transfer authority. Public Explorer APIs and indexers are replaceable infrastructure, not consensus participants or protocol truth sources.
