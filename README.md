# 420 Integrated

**An EVM-compatible Layer-1 built as an integrated digital ecosystem from genesis.**

420 Integrated is a cannabis-native blockchain project built around a simple premise: a new network should launch with more than a token and an empty execution layer. It should begin with the core services users, developers and applications need to actually function together.

The native currency is **$420** (`420`). The chain is being designed as a modern EVM-compatible network with a 420-specific validator, consensus and economic architecture, surrounded by a broad genesis-resident application and protocol layer.

This repository contains the chain architecture, genesis contracts, protocol modules, configuration, wallet foundations, hardening artifacts, tests and the first wave of applications being built for the ecosystem.

> **420 Integrated is ecosystem-first.** The goal is to launch an interoperable network in which identity, payments, exchange, governance, discovery, verification, messaging, compute, rights and application services are designed to compose with one another from the beginning.

---

## The idea

Most general-purpose chains launch the base network first and wait for wallets, identity, payments, discovery, application distribution, governance tools and consumer experiences to appear independently.

420 Integrated takes a different approach.

The network is being built as a **coherent stack** with shared standards, canonical registries and bounded authorization systems so applications can reuse infrastructure instead of creating incompatible silos.

That stack includes:

- EVM-compatible smart contracts and tooling;
- a native `$420` economy and validator system;
- canonical registries for contracts, assets, applications and services;
- smart accounts, recovery, capabilities and wallet authorization;
- human-readable names and optional decentralized identity;
- native staking, governance, treasury and grants;
- swap, payments and bridge infrastructure;
- provider-neutral oracle, randomness, storage and compute interfaces;
- explorer, verification, analytics, search and network-status services;
- messaging, rights, attention and notification protocols;
- interoperability standards for first- and third-party applications;
- flagship games, media and cultural applications built on the same public primitives.

The goal is that a new application can plug into the network's wallet, identity, payments, discovery, notifications, rights and asset systems instead of rebuilding them from scratch.

---

# Architecture principles

## EVM compatibility

420 Integrated is being built around an EVM-compatible execution environment so developers can use familiar Solidity contracts, Ethereum-derived tooling and conventional RPC patterns while targeting the 420 network.

## Canonical state, replaceable interfaces

A recurring rule throughout the project is that **front ends do not become protocol authority**.

Explorer pages, search indexes, analytics dashboards, app listings, notifications and verification services can be replaced or independently operated. Canonical balances, ownership, registrations, settlements, rights and governance outcomes remain anchored in the chain and its authoritative contracts.

## Default-deny authorization

Security-sensitive modules use explicit authority rather than ambient privilege. Wallet capabilities, recovery, application permissions, execution paths, governance actions and protocol roles are intended to remain bounded, auditable and revocable.

## Interoperability by design

420 Integrated is not meant to become a pile of unrelated dApps. The ecosystem includes shared service identities and a **420 Interoperability Standard (420-IS)** so applications can discover and compose wallet, identity, payment, rights, messaging, randomness and other services through common interfaces.

## Provider-neutral infrastructure

Oracles, randomness, AI compute, storage and external attestations are being designed around interfaces rather than permanent dependence on one provider. The protocol defines the guarantees applications require while allowing multiple implementations to satisfy them.

## Harden before freeze

Genesis-critical components are subjected to qualification gates, integration testing, invariant testing, adversarial cases and focused hardening campaigns before they are treated as mainnet assumptions.

---

# Genesis ecosystem

The frozen genesis application decision already defines a broad resident service layer. Some components are protocol contracts, some are user applications, and some are replaceable projections over canonical chain state.

## Wallet and accounts

### 420 Wallet

The primary network wallet and ecosystem entry point. The web wallet binds to the canonical Wallet Core and smart-account architecture rather than inventing a second ownership model.

Its scope includes account discovery, portfolio and network reads, smart-account execution, recovery management, timelocks, scoped capabilities, user-operation transport, validator controls, dApp access, verified ecosystem navigation and developer resources.

### Smart Accounts / Wallet Core

Canonical smart accounts, factories and capability registries provide programmable ownership, recovery, session permissions and account-abstraction support without splitting authority across competing account systems.

## Discovery, transparency and developer visibility

### 420 Explorer

Blocks, transactions, contracts, validators, assets, governance, finality and protocol-state observability.

### 420 Search

Unified discovery across public chain state, registered services, applications and ecosystem content. Search remains non-authoritative: indexing or ranking something cannot change its legitimacy or ownership.

### 420 Analytics

Rebuildable metrics, trends, dashboards and derived analysis over public chain and protocol data.

### 420 Verify

Reproducible contract-source verification showing whether published source and compiler settings reproduce deployed bytecode. Verification is evidence of a source match, not an audit or endorsement.

### 420 Status

Health visibility for finality, validators, RPC infrastructure, bridges, swap services, AI services and other public endpoints.

### 420 Notifications

Opt-in alerts for wallet, protocol, governance, payment, bridge, staking, security and application events. Notifications report events but do not gain wallet execution authority.

## Registry, names, identity and reputation

### 420 Registry

The canonical discovery backbone for contracts, tokens, applications and protocol services.

### 420 Names

Human-readable names such as `crowley.420`, layered over canonical addresses and identities.

### 420 Identity

Optional decentralized profiles, credentials and reputation designed to preserve pseudonymous participation.

### 420 Reputation

Reusable reputation primitives intended to let applications share earned history without maintaining incompatible private reputation databases.

## Exchange, payments and assets

### 420 Swap / 420Exchange

The native exchange and routing layer for `$420` and approved assets, including multi-hop execution, native-value paths, routing infrastructure and settlement integration.

### 420 Pay

Reusable payment infrastructure for invoices, merchant authorization, settlement, split payments, refunds, sponsored gas and swap-assisted payment flows. Hardening work covers replay protection, expiry, partial-payment rules, asset validation, atomic settlement, rounding conservation and authority isolation.

### 420 Bridge

A restricted, verified cross-chain gateway designed to connect approved external assets and networks while keeping bridge authority narrow and auditable.

### 420 Token

Self-service creation of qualified fungible and NFT assets from frozen templates with explicit provenance and a fixed native creation fee.

### Development Compensation Vault

A transparent application-revenue routing primitive supporting defined first-party development compensation while allowing applications to recognize their own creator treasuries and revenue-sharing policies.

## Validators, governance and public funding

### 420 Stake

Validator registration, bonding, readiness, lifecycle, rewards and withdrawals. The genesis design does not use stake-weighted delegation as a source of governance power.

### 420 Governance

Proposals, voting, treasury actions and timelocked execution with community and validator participation.

### 420 Treasury

Transparent custody and governed expenditure for protocol and ecosystem funds.

### 420 Grants

Funding infrastructure for development, research, community projects and public goods.

### 420 Launchpad

A standardized launch framework for qualified ecosystem projects and assets integrated with network registry, token and governance services.

### 420 Arbitration

Domain-scoped disputes, evidence commitments, rulings, bounded appeals and finality without granting arbitration blanket custody, bridge reversal, slashing or governance authority.

## Compute, data and protocol services

### 420 AI

A decentralized AI service layer for providers, models, jobs, escrow, payments and reputation. Compute occurs off-chain; settlement and accountability are coordinated on-chain. AI providers receive no consensus privilege.

### 420 Randomness

Reusable randomness infrastructure for games and applications, designed around defined guarantees rather than permanent dependence on one implementation.

### Oracle Interface Layer

Provider-neutral interfaces for price feeds, proof-of-reserve data, external APIs and outcomes, automation triggers and other off-chain information.

### 420 Storage Proof Protocol

Infrastructure for proving useful storage commitments and supporting future decentralized storage markets and storage-backed applications.

### 420 Resource Protocol

Shared primitives for registering, accounting for and coordinating protocol or application resources.

### 420 Rights

Rights, licensing and delegated-use primitives for creators, applications and digital assets, including transfer, succession, expiry and revocation rules.

## Communication, attention and application services

### 420 Messenger

Messaging infrastructure combining on-chain identity, membership and authorization with off-chain message transport and storage.

### 420 Attention / Cannaseur

Opt-in attention campaigns and rewards designed so incentives cannot access wallet keys, silently sign transactions or execute arbitrary code for users.

### 420 AppStore

A curated but non-authoritative catalogue for discovering and launching registered applications with provenance, permissions and security context. Registry state, not AppStore ranking, determines canonical legitimacy.

### 420-IS

The 420 Interoperability Standard defines common patterns for discovering and composing ecosystem services so third-party applications can participate in the same network instead of forming isolated islands.

### 420 Faucet

A developer onboarding and testnet distribution service only. Testnet assets carry no monetary value and the faucet does not participate in mainnet economics.

---

# First-year ecosystem

Genesis infrastructure is the foundation, not the finish line. During the first year of mainnet operation, 420 Integrated is intended to expand into a recognizable consumer ecosystem built on those same shared primitives.

Several flagship projects are already in design or active development.

## High Country

A browser-first cannabis cultivation and genetics game built around persistent growers, land, seeds, clones, plants, phenotypes, mothers, harvests and breeding.

Its architecture includes typed assets, offline growth, environmental cultivation systems, genetics, equipment, regional progression, skills, a marketplace, seasonal competition and the Global 420 Cup. It is also a practical demonstration of chain-authoritative game state using common wallet, identity, asset and randomness infrastructure.

## 420Bet

A casino and wagering platform built around canonical wager routing, settlement, bankroll and risk controls, randomness, game registries and solvency-aware accounting.

Game verticals under development include Keno, Plinko, Slots and Mines, with broader casino and sportsbook infrastructure planned. The implementation emphasizes settlement correctness, replay resistance, bounded authority and accounting conservation.

## 420Media

A decentralized media and streaming application exploring a Livepeer-like model for the 420 ecosystem: live channels, creator streams, event broadcasting, discovery, payments, access control and decentralized delivery infrastructure.

The design draws inspiration from systems and formats such as Livepeer, Streamplace, Daydream, Lot Radio and community television while integrating native 420 identity, wallet and application services.

## 420Hz

A music-focused ecosystem for artists, listeners and communities, exploring publishing, streaming, discovery, artist identity, rights, fan relationships and native economic interaction between creators and audiences.

## Marijuanopolis

A persistent 3D virtual world intended to bring social spaces, events, land, collectibles, games, commerce and community applications into one explorable environment.

Rather than functioning as a disconnected metaverse token project, Marijuanopolis is intended to consume the same wallet, names, identity, payments, rights, messaging and asset infrastructure used elsewhere on the chain.

## Dopemon

A collectible creature game built around cannabis-culture-inspired characters, evolution, collecting and gameplay. Dopemon can use shared token, identity, randomness, marketplace and wallet infrastructure and may ultimately exist both as its own game and inside broader environments such as Marijuanopolis.

## Smoke & Chrome

An adult cannabis-fantasy / cyberpunk trading-card game built around factions, collectible editions, booster packs, deck building, tournaments and provable ownership.

Fast gameplay can remain largely off-chain while the blockchain handles identity, provenance, scarce assets and settlement.

---

# One ecosystem, many applications

The point is not simply to accumulate dApps.

A High Country player should not need a special High Country wallet. A 420Hz artist should not need a separate identity system. A Smoke & Chrome card should not require a private marketplace standard. A 420Media creator should not need an incompatible payment rail. A third-party developer should not need permission from a first-party front end to discover the protocol.

Applications should be able to reuse:

- the same `$420` native currency;
- the same wallet and smart-account security model;
- the same names and optional identity system;
- the same canonical Registry;
- the same payment, swap and bridge rails;
- the same token standards and provenance model;
- the same rights and licensing primitives;
- the same notification and messaging interfaces;
- the same randomness, oracle, storage and compute interfaces;
- the same governance and treasury framework;
- the same search, explorer, analytics and verification services;
- the same interoperability conventions.

That shared foundation is the core meaning of **420 Integrated**.

---

# Development status

This repository is an active build, not a finished mainnet release.

The project has progressed well beyond its original protocol-design scaffold. Genesis contracts, application registries, wallet architecture, payments, exchange infrastructure, developer services and multiple flagship applications are being implemented and hardened through feature branches and pull requests.

The normal development path is:

1. define architecture, authority boundaries and invariants;
2. implement contracts, services, adapters and application foundations;
3. run unit, integration, invariant and regression qualification;
4. perform focused adversarial hardening;
5. reconcile feature work against current `main`;
6. merge only after required gates pass;
7. explicitly freeze only those components that must become network assumptions.

Not every project described here is a genesis-critical contract, and not every first-year application is expected to ship in the first mainnet block. The distinction is deliberate: **the interoperability foundation is designed for genesis; flagship applications can continue evolving above it.**

---

# Repository guide

Important areas include:

- `contracts/` — protocol and application smart contracts and interfaces
- `contracts/config/` — genesis/service wiring and application configuration
- `config/` — chain-level and genesis application decisions
- `docs/` — architecture, protocol, hardening and application documentation
- `genesis/` — genesis configuration and allocation material
- `.github/` — CI and qualification workflows

Useful starting points:

- `config/genesis-applications.json` — frozen genesis application decision and service roles
- `config/protocol.json` — protocol-level parameters under freeze discipline
- `docs/ROADMAP.md` — protocol development roadmap
- `docs/PROTOCOL-v0.1.md` — protocol design documentation

The repository also retains implementation summaries, hardening outputs and qualification artifacts for major components so important integration and security decisions remain reviewable alongside the code.

---

# Native currency and naming

The public native currency is **`420`**, commonly written **`$420`**.

Programming-language identifiers generally cannot begin with a digit, so source code uses compatible names such as `FourTwenty`, `Coin420`, `NativeCurrency`, `SmartAccount420`, `Registry420` and similar identifiers where required.

---

# What 420 Integrated is trying to become

420 Integrated is an experiment in whether a purpose-built blockchain can launch with enough shared infrastructure to feel less like an empty protocol and more like a functioning digital place.

Its cannabis identity is deliberate, but the technical ambition is broader: create a secure, interoperable and developer-friendly network where culture, games, media, payments, identity, markets, AI, community software and future third-party applications can share one coherent foundation.

The success condition is not that every application is controlled by one team. It is that the common infrastructure becomes useful enough for independent developers to build their own applications without recreating the chain around them.

**420 Integrated provides the rails. The ecosystem should be able to grow beyond its founders.**

---

## Mainnet caution

This repository is under active development. Code, economic parameters, validator rules, genesis allocations, service definitions and application interfaces may change until explicitly frozen for release.

No value should be assigned to testnet assets, and no protocol parameter should be treated as a constitutional mainnet constant merely because it currently appears in the repository.

**Simulate first. Test aggressively. Harden critical paths. Freeze deliberately.**
