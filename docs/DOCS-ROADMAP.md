# 420 Integrated Documentation Roadmap

The DOCS workstream builds the canonical documentation system for the 420 Integrated ecosystem. Repository-controlled Markdown is the source of truth; a public 420Docs site renders and indexes it.

## DOC-0 — Documentation foundation — COMPLETE

- [x] DOC-0.1 Establish architecture taxonomy and migration rule.
- [x] DOC-0.2 Establish documentation page classes and contribution policy.
- [x] DOC-0.3 Establish application documentation contract.
- [x] DOC-0.4 Establish Architecture Decision Record format and lifecycle.
- [x] DOC-0.5 Establish diagram conventions.
- [x] DOC-0.6 Establish canonical terminology/style rules and DOC-0 qualification checks.

Exit condition: documentation taxonomy, standards, app contract, ADR rules, diagram conventions, terminology rules, and minimum contribution requirements are committed and reviewable.

## DOC-1 — 420Docs site foundation — COMPLETE

- [x] DOC-1.1 Establish MkDocs Material project foundation.
- [x] DOC-1.2 Add GitHub Pages deployment through GitHub Actions.
- [x] DOC-1.3 Build documentation landing page and audience-based navigation.
- [x] DOC-1.4 Integrate 420Docs links into the repository README.
- [x] DOC-1.5 Complete whole-site search/navigation qualification.

Exit condition: 420Docs builds strictly, publishes through GitHub Pages, exposes audience-based entry points, is discoverable from the repository README, and automatically qualifies navigation and search indexing before publication.

## DOC-2 — System architecture — COMPLETE

- [x] DOC-2.1 Publish canonical system overview.
- [x] DOC-2.2 Document system design principles.
- [x] DOC-2.3 Document genesis architecture.
- [x] DOC-2.4 Publish dependency map.
- [x] DOC-2.5 Publish trust-boundary model.

Exit condition: the system architecture explains the top-level layers, design principles, genesis composition, dependencies, authority boundaries, normal flows, failure assumptions, and links to deeper chain, consensus, protocol, infrastructure, and application documentation.

## DOC-3 — Chain documentation — COMPLETE

- [x] DOC-3.1 Document the execution layer and establish the chain-documentation index.
- [x] DOC-3.2 Document accounts, addresses, balances, nonces, EOAs, contracts, and smart-account relationships.
- [x] DOC-3.3 Document transaction structure and lifecycle from signing through receipt/failure.
- [x] DOC-3.4 Document blocks, execution ordering, receipts/logs, state roots, canonical state, and reorg/finality relationships.
- [x] DOC-3.5 Document gas accounting, fees, base fee, priority-fee behavior, consensus system-call gas, and native `$420` semantics.
- [x] DOC-3.6 Document chain identity, execution genesis, fork activation, network configuration, genesis allocations, and compatibility checks.

Exit condition: developers, operators, and reviewers can trace how 420 Integrated represents accounts, accepts and executes transactions, constructs execution blocks/state, accounts for gas/fees/native `$420`, and identifies/configures the canonical network from genesis onward.

## DOC-4 — Consensus documentation

- Validator lifecycle, proposer selection, cohorts, epochs, rewards, slashing, finality, failure, and recovery.

## DOC-5 — Infrastructure documentation

- fourtwentyd, node420, 420Indexer, RPC, gateways, storage/resource infrastructure, AI compute, oracle providers, and operational services.

## DOC-6 — Wallet and user onboarding

- Wallet installation/import, recovery protection, send/receive, dApp connections, signing, permissions, recovery, and troubleshooting.

## DOC-7 — Core protocol documentation

- One architecture/integration package for each canonical protocol.

## DOC-8 — Genesis application manuals

- Standard user/developer/security/troubleshooting package for every genesis application.

## DOC-9 — Developer documentation

- Quickstart, local environment, testnet, contracts, RPC, APIs, SDKs, events, errors, indexer, wallet, storage, AI, bridge, game integration, and examples.

## DOC-10 — Generated reference documentation

- NatSpec, ABI, RPC, API, SDKs, events, errors, chain registry, canonical deployments, and machine-derived reference pages.

## DOC-11 — Troubleshooting and error registry

- Searchable, stable error identifiers and symptom-to-recovery documentation across the ecosystem.

## DOC-12 — Documentation CI

- Broken-link, front-matter, duplicate-ID, orphan-page, required-doc, and generated-reference validation.

## DOC-13 — Versioning

- Genesis, mainnet, testnet, and development documentation version policy and renderer support.

## DOC-14 — Contextual documentation

- Stable deep links from Wallet and dApps into task-specific documentation and error help.

## DOC-15 — Ask 420 documentation assistant

- Canonical-document-grounded support through 420AI with source citations and current network context where appropriate.

## DOC-16 — Genesis documentation audit

- Matrix-based coverage audit across architecture, user, developer, security, troubleshooting, and reference documentation.

## DOC-17 — Genesis publication

- Production publication of 420Docs and integration from the repository, Wallet, Explorer, Developer Hub, and genesis dApps.
