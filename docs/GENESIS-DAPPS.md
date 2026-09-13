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

This document describes the frozen application decision. Deployment readiness is determined by the current qualified deployment/configuration artifacts, not by this summary page alone.

## Canonical sources

- `config/genesis-applications.json` — frozen public Genesis application catalog and rules.
- `contracts/config/genesis-dapp-contract-map.json` — broader Genesis implementation/contract inventory.
- `docs/audit/genesis-contract-documentation-inventory.json` — documentation ownership reconciliation across the broader contract inventory.
