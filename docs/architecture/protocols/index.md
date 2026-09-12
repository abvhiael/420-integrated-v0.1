---
title: Core protocol architecture
audience:
  - developer
  - architect
  - operator
category: architecture
status: development
version: current
---

# Core protocol architecture

420 Integrated uses shared canonical protocols so applications can compose common services without creating incompatible wallet, identity, discovery, payment, rights, randomness, storage, dispute, or communications systems.

This section documents those protocols as **authority and integration boundaries**. Application manuals belong in DOC-8; generated ABIs and machine reference material belong in DOC-10.

## Start here

- [Protocol integration model](protocol-integration-model.md) — what makes a protocol canonical, how applications discover and compose protocols, authority boundaries, versioning, provider neutrality, settlement, failure behavior, and cross-protocol invariants.
- [Registry, Names, Identity and 420-IS](registry-names-identity-420is.md) — canonical service discovery/versioning, `.420` naming and resolution, optional pseudonymous profiles/credentials, and provider-neutral interoperability mappings/checkpoints.
- [Pay, Token, Swap/Exchange and Bridge](pay-token-exchange-bridge.md) — canonical invoices/payments/settlement, governed token templates/factory provenance, qualified exchange routing, and proof/risk-bounded cross-chain value movement.
- [Stake, Governance, Treasury and Grants](stake-governance-treasury-grants.md) — validator-economic boundaries, snapshot/timelock-based Civic governance, Vault-backed Treasury control, and grant milestone-to-disbursement integration.
- [Randomness and Oracle Interface](randomness-oracle-interface.md) — request-frozen verified entropy, provider-neutral external facts, freshness/epoch/quorum policy, and fail-closed consumption.
- [Storage Proof and Resource Protocol](storage-proof-resource-protocol.md) — provider/service qualification, bounded metering, durable-storage agreements, capacity, commitments, proofs, manifests, retrievability, and Vault-backed proof-window settlement.
- [Rights and Verify](rights-verify.md) — rights subjects/claims/succession/licensing plus reproducible contract-source verification and their strict non-overlapping authority boundaries.
- [420 Arbitration](arbitration.md) — domain-scoped dispute intake, policy snapshots, evidence commitments, exact resolver authority, bounded appeals, finality, and origin-protocol remedy boundaries.
- [Messenger, Notifications and Attention](messenger-notifications-attention.md) — private message coordination with off-chain payloads, non-canonical event delivery, and opt-in sponsor-funded Attention proofs/rewards with segregated liabilities.

## DOC-7 phase map

The protocol documentation phase is organized by integration family:

1. **DOC-7.1 — Protocol index and integration model** — shared architecture, discovery, authority, composition, versioning, failure and integration rules.
2. **DOC-7.2 — Registry, Names, Identity and 420-IS** — canonical discovery, human-readable naming, optional identity, interoperability and interface discovery.
3. **DOC-7.3 — Pay, Token, Swap/Exchange and Bridge** — payment, asset/value movement, exchange composition and cross-chain attestations.
4. **DOC-7.4 — Stake, Governance, Treasury and Grants** — validator/public-governance integration, governed funds and grant flows.
5. **DOC-7.5 — Randomness and Oracle Interface** — provider-neutral external entropy/data, verification, routing and fail-closed consumption.
6. **DOC-7.6 — Storage Proof and Resource Protocol** — storage/resource commitments, provider qualification, proofs, metering and settlement boundaries.
7. **DOC-7.7 — Rights and Verify** — rights provenance/licensing plus reproducible deployed-contract verification and evidence boundaries.
8. **DOC-7.8 — Arbitration** — domain-scoped dispute intake, evidence commitments, exact resolver authority, bounded appeals/finality and explicit origin-protocol remedy consumption.
9. **DOC-7.9 — Messenger, Notifications and Attention** — private-message coordination, non-canonical alert delivery, opt-in engagement proofs/rewards, privacy, bounded capabilities and provider-neutral delivery.

## Protocol versus application

A protocol defines reusable canonical state, interfaces, authorization rules or settlement semantics that multiple applications can compose. A dApp provides a user experience or application-specific domain on top of those primitives.

For example, 420 Bridge can have a user-facing application while the underlying bridge protocol defines route, attestation, replay and settlement rules. DOC-7 documents the reusable protocol contract; DOC-8 documents how a person uses the genesis application.

## Protocol versus infrastructure

Infrastructure may operate a protocol but does not become the protocol authority merely by serving requests. RPC endpoints, indexers, storage nodes, AI workers, oracle providers, notification relays and gateways remain replaceable where the protocol permits.

Canonical permissions, commitments, ownership, settlement, registrations and governed outcomes remain anchored to the designated on-chain protocol authority.

## Related documentation

- [System overview](../system-overview.md)
- [Dependency map](../dependency-map.md)
- [Trust-boundary model](../trust-boundary-model.md)
- [Infrastructure architecture](../infrastructure/index.md)
