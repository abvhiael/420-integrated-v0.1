---
title: 420 Integrated Genesis applications
audience: [user, developer, architect, operator]
category: architecture
status: frozen
version: current
---

# 420 Integrated Genesis applications — Frozen Decision

Genesis Application Decision #1 is frozen. The authoritative public application catalog is `config/genesis-applications.json` (`420-genesis-application-decision-v9`).

## Frozen Genesis catalog

1. 420 Wallet
2. 420 Explorer
3. 420 Search
4. 420 Analytics
5. 420 AppStore
6. 420 Verify
7. 420 Notifications
8. 420 Registry
9. 420 Names
10. 420 Identity
11. 420 Gaming Protocol
12. 420 Arbitration
13. 420 Swap
14. 420 Bridge
15. 420 Stake
16. 420 Governance
17. 420 AI
18. 420 Attention
19. 420 Token
20. 420 Status
21. 420 Faucet — testnet only

420 Governance is the public Genesis application name. Its canonical production implementation family is 420 Civic. The retired `Governance420` surface is compatibility-only and is not an alternate governance authority.

## GEN-10 delivery roadmap

The frozen catalog above defines what ships at Genesis. GEN-10 tracks the repository implementation and qualification of the contract-free user-facing clients and derived-data services that sit on top of the shared protocol and infrastructure layers.

### Completed

- **GEN-10.1 — 420 Wallet** — repository implementation merged through W13, including Wallet Core, web, extension, native iOS/Android projects, passkeys/session/recovery authority boundaries, onboarding, design system and store-presentation assets. Repository qualification is complete. Production Play/TestFlight release remains externally blocked until genuine physical Android and iPhone evidence satisfies the device closeout gate.
- **GEN-10.2 — 420 Explorer** — complete and merged. Explorer consumes the qualified 420Indexer boundary for chain/protocol projections and preserves canonical provenance, freshness and finality semantics.
- **GEN-10.3 — 420 Search** — complete and merged. SEARCH-0 through SEARCH-10 delivered architecture, qualified Indexer consumption, result/provenance models, public-domain discovery, deterministic ranking and pagination, privacy/reorg/resource hardening, HTTP API, frontend/trust presentation, runtime packaging, testnet validators and Genesis closeout.

### Current

- **GEN-10.4 — 420 Analytics** — next active Genesis application implementation. The frozen Analytics Genesis profile and service identity already exist; the remaining work is the full qualified consumer/application build over canonical public chain and protocol sources. Analytics must remain rebuildable and non-authoritative, with explicit provenance, methodology/window definitions, finality/freshness handling and privacy exclusions.

### Remaining GEN-10 application builds

- **GEN-10.5 — 420 Verify** — build the full reproducible source/bytecode verification service and user-facing workflow on top of its already-frozen Genesis profile. Verification must remain evidence, not audit, safety, Registry legitimacy or wallet authority.
- **GEN-10.6 — 420 AppStore** — build the full Registry-backed discovery/curation client with provenance, permissions/security context and explicit non-authoritative ranking/listing semantics.
- **GEN-10.7 — 420 Notifications** — build the opt-in delivery service with canonical source provenance, reorg/finality handling, privacy-safe subscriptions/history and no execution authority.
- **GEN-10.8 — 420 Status** — build the public network/service-health application over qualified chain, Indexer, RPC and service observations without converting operational health into protocol authority.

### Shared prerequisites already in place

- **420Indexer** — shared rebuildable projection service is implemented and qualified for Genesis consumers.
- **420RPC** — public RPC/routing/policy layer is implemented through its hardening and qualification roadmap.
- **Developer Hub / documentation** — integration, verification, publishing and service-health workflows exist to support the remaining application builds.

Protocol-backed applications in the frozen catalog — Registry, Names, Identity, Gaming Protocol, Arbitration, Swap, Bridge, Stake, Governance/Civic, AI, Attention and Token — continue to use their own contract/protocol deployment and qualification roadmaps. They are not reclassified as unfinished GEN-10 derived-data clients merely because later integration or production deployment work remains.

## Public catalog versus implementation inventory

The frozen list above is the public Genesis application decision. It is intentionally narrower than `contracts/config/genesis-dapp-contract-map.json`, which also tracks implementation protocols, shared infrastructure, aliases, and other Genesis contract families such as Smart Accounts, 420-IS, Randomness, Trust, Commons, Pulse, Messenger, Vault, Treasury, Grants, Launchpad, Resource Protocol, Market, Rights, Pay, Oracle, Civic, and ComputeMarket.

Those implementation-only surfaces do not become additional public Genesis applications merely because they appear in the contract map. Their documentation ownership is reconciled in `docs/audit/genesis-contract-documentation-inventory.json`.

## Contract-readiness rules

Applications marked `contracts_required: false` in the frozen catalog are deliberately frontend/derived-data surfaces and do not gain protocol authority merely by being official Genesis applications. Search, Analytics, AppStore, Verify, Notifications, Wallet, Explorer, and Status remain replaceable clients or projections over canonical protocol state where applicable.

Protocol-backed Genesis applications must preserve their frozen authority boundaries. In particular:

- 420 Registry remains the canonical discovery backbone.
- 420 Names is a presentation/name layer and does not replace canonical protocol or service identity.
- 420 Identity remains optional and pseudonymous.
- 420 Gaming Protocol does not make routine game state canonical and does not create parallel wallet authority.
- 420 Arbitration records bounded dispute process and rulings but cannot directly acquire blanket custody or execution authority.
- 420 Bridge remains verifier-based and replay-protected; it does not gain unbacked mint authority.
- 420 Stake has no stake-weighted delegation at Genesis.
- 420 Governance uses the Civic implementation family and timelocked committed execution.
- 420 Attention cannot access wallet keys or transact on behalf of users.
- 420 Token accepts only qualified frozen templates and charges the exact frozen creation fee.
- 420 Faucet is testnet-only and never participates in mainnet Genesis economics.

## Deployment status

Source readiness is not the same as production deployment readiness. Contract-backed surfaces still require the applicable deterministic deployment, compiler/build, invariant/security, bytecode/storage, Genesis-injection, and address/code-hash verification gates before a production deployment image is considered frozen.

This document describes both the frozen application decision and the current GEN-10 delivery sequence. Deployment readiness is determined by the current qualified deployment/configuration artifacts, not by this summary page alone.

## Canonical sources

- `config/genesis-applications.json` — frozen public Genesis application catalog and rules.
- `contracts/config/genesis-dapp-contract-map.json` — broader Genesis implementation/contract inventory.
- `docs/audit/genesis-contract-documentation-inventory.json` — documentation ownership reconciliation across the broader contract inventory.
- `docs/ROADMAP.md` — top-level build sequence and current shared-service/application milestone.
