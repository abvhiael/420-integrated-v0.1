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

## DOC-4 — Consensus documentation — COMPLETE

- [x] DOC-4.1 Publish the consensus architecture index and consensus overview.
- [x] DOC-4.2 Document validator lifecycle, eligibility, bonding, activation, tenure, exits, cooldown, and validator signing boundaries.
- [x] DOC-4.3 Document proposer selection, fallback scheduling, cohorts, rotations, committee scaling, migration, and anti-flapping.
- [x] DOC-4.4 Document slots, epochs, attestations, QCs, fork choice, chained finality, head/safe/finalized mapping, and reorganization behavior.
- [x] DOC-4.5 Document security rewards, issuance accounting, proposer/participant shares, missed participation, and execution settlement.
- [x] DOC-4.6 Document slashable evidence, equivocation protection, ejection, bond effects, local slashing protection, and consensus safety boundaries.
- [x] DOC-4.7 Document quorum loss, partitions, restarts, Engine failures, safety halt/recovery, remote signing, persistence, and operator recovery order.

Exit condition: developers, validators, operators, and reviewers can trace how 420 Integrated forms and rotates validator committees, schedules block proposers, certifies/finalizes execution payloads, accounts for consensus rewards and faults, preserves signing safety, and recovers from quorum, partition, execution, or process failures.

## DOC-5 — Infrastructure documentation — COMPLETE

- [x] DOC-5.1 Publish the infrastructure architecture index and infrastructure overview.
- [x] DOC-5.2 Document `fourtwentyd` process architecture, configuration, persistence, P2P, Engine dependency, signing boundary, health, startup/shutdown, and recovery.
- [x] DOC-5.3 Document `node420` execution distribution/wrapper, pinned Geth relationship, datadir/genesis initialization, JSON-RPC, Engine API, P2P, optional services, health, and recovery.
- [x] DOC-5.4 Document 420Indexer ingestion, canonical/finalized cursors, reorg reconciliation, projections, checkpoints, consumers, replay/rebuild, and non-authority guarantees.
- [x] DOC-5.5 Document public RPC/WSS, private Engine transport, gateways/proxies, endpoint discovery, rate limits, failover, ingress security, and trust assumptions, including the future 420RPC integration boundary.
- [x] DOC-5.6 Document storage/resource providers, content/proof boundaries, replication/availability, provider discovery, settlement, failure recovery, and provider neutrality.
- [x] DOC-5.7 Document 420AI compute workers/providers, job routing, off-chain inference, on-chain commitments/economics, SLA/proof boundaries, result delivery, and failure isolation.
- [x] DOC-5.8 Document oracle/external-provider infrastructure, provider-neutral adapters, freshness/verification, attestations, external computation, automation triggers, fallback, and replacement.
- [x] DOC-5.9 Document metrics/logs/traces, health/readiness, alerts, 420Status/Notifications boundaries, backups, incident signals, and operator-service recovery.

Exit condition: developers and operators can identify every major infrastructure service, distinguish canonical/derived/replaceable authority, deploy and connect the core node/indexing/access layers safely, understand provider-backed storage/AI/oracle boundaries, and recover infrastructure in canonical authority order without promoting operational services into protocol authority.

## DOC-6 — Wallet and user onboarding — COMPLETE

- [x] DOC-6.1 Publish the 420 Wallet onboarding overview, client-selection guidance, canonical account model, safe first-session sequence, and support-safety rules.
- [x] DOC-6.2 Document setup/import boundaries, SmartAccount420 discovery, authorization epochs, passkey enrollment/re-enrollment, recovery preparation, and baseline account protection.
- [x] DOC-6.3 Document receiving/sending native `$420`, address checks, fee behavior, activity/finality states, failed/pending transactions, and post-send verification.
- [x] DOC-6.4 Document dApp connection, verified destinations, connection-versus-capability boundaries, network mismatch, disconnection, and compromise response.
- [x] DOC-6.5 Document signing review, simulation, message versus transaction signatures, contract/batch calls, passkey signing, post-execution verification, and red flags.
- [x] DOC-6.6 Document owner/operator/capability/session/recovery/passkey authority classes, scoped permissions, authorization epochs, revocation, spend limits, and incident response.
- [x] DOC-6.7 Document recovery authority, the canonical timelocked recovery flow, owner cancellation, lost-device response, passkey/device considerations, and compromise handling.
- [x] DOC-6.8 Publish wallet troubleshooting for connection/network/account discovery, pending/failed transactions, simulation, passkeys, sessions, recovery, stale activity, and safe support diagnostics.

Exit condition: a new user can choose a qualified 420 Wallet client, establish or discover an account safely, protect it, send/receive `$420`, connect applications, understand and approve signing requests, control reusable permissions/sessions, recover from owner/device loss using the canonical timelocked path, and diagnose common failures without exposing private signing material or needing protocol internals.

## DOC-7 — Core protocol documentation — COMPLETE

- [x] DOC-7.1 Publish the core-protocol architecture index and integration model covering canonical authority, discovery, versioning, composition, provider neutrality, authorization, settlement, evidence, finality, failure and recovery.
- [x] DOC-7.2 Document 420 Registry, 420 Names, 420 Identity and 420-IS discovery/interoperability architecture.
- [x] DOC-7.3 Document 420 Pay, 420 Token, Swap/Exchange and Bridge value-movement architecture and integration boundaries.
- [x] DOC-7.4 Document 420 Stake, Governance, Treasury and Grants validator/public-governance integration and governed-funds flows.
- [x] DOC-7.5 Document 420 Randomness and Oracle Interface routing, verification, provider neutrality, freshness and fail-closed consumption.
- [x] DOC-7.6 Document Storage Proof and Resource Protocol commitments, provider qualification, proofs, metering, availability and settlement.
- [x] DOC-7.7 Document 420 Rights and 420 Verify provenance, licensing, evidence and verification integration.
- [x] DOC-7.8 Document 420 Arbitration dispute intake, evidence, bounded authority, outcomes, appeal/finality semantics and protocol integration.
- [x] DOC-7.9 Document 420 Messenger, Notifications and Attention communication/engagement state, off-chain delivery and bounded authority.

Exit condition: developers, architects and reviewers can identify every canonical shared protocol family, discover and integrate it through approved interfaces, understand its authority and external dependencies, compose protocols without cross-domain privilege leakage, and recover or replace operational providers without rewriting canonical protocol state.

## DOC-8 — Genesis application manuals — COMPLETE

- [x] DOC-8.1 Publish the Genesis application manual index and exact frozen application inventory, establish the per-application coverage contract, distinguish protocol-only/testnet-only entries, expose the application-manual navigation entry, and lock the DOC-8 build order.
- [x] DOC-8.2 Build the 420 Wallet application package around the completed DOC-6 user journey, filling concepts, architecture, permissions, fees, security, FAQ and developer integration without duplicating the canonical Wallet task guides.
- [x] DOC-8.3 Build 420 Explorer, 420 Search and 420 Analytics manuals for chain discovery, search and derived analytics, preserving canonical-versus-derived authority and finality/reorg semantics.
- [x] DOC-8.4 Build 420 AppStore, 420 Verify, 420 Notifications and 420 Status manuals for application discovery, reproducible verification, alerts and operational presentation, including explicit non-authority/security boundaries.
- [x] DOC-8.5 Build 420 Registry, 420 Names and 420 Identity manuals for canonical registered discovery, `.420` naming and optional pseudonymous identity/credential workflows.
- [x] DOC-8.6 Build 420 Swap, 420 Bridge and 420 Token manuals for swaps/routes, verified cross-chain movement and qualified token-template deployment, including value/fee/risk/settlement safety.
- [x] DOC-8.7 Build 420 Stake, 420 Governance and 420 Arbitration manuals for validator economics/lifecycle, proposals/voting/treasury and bounded dispute-resolution workflows.
- [x] DOC-8.8 Build 420 AI and 420 Attention manuals for provider/model/job/escrow workflows and opt-in sponsor/consent/proof/reward workflows with privacy and authority boundaries.
- [x] DOC-8.9 Build the explicitly testnet-only 420 Faucet manual covering acquisition, limits, no-value semantics, abuse controls and troubleshooting without implying mainnet availability.
- [x] DOC-8.10 Run the Genesis application manual coverage audit: verify every required user/developer/security/troubleshooting package, navigation path, authority warning, cross-link and application-version/genesis scope before phase closeout.

Exit condition: every user-facing frozen Genesis application has a predictable, task-oriented manual package that explains safe startup, state-changing/value-changing actions, signing/permissions, economics, security/privacy, failure recovery, canonical authority and supported developer integration; the protocol-only Gaming Protocol is correctly routed to protocol/developer documentation, and Faucet documentation is unambiguously testnet-only. See `docs/apps/coverage-audit.md` for the recorded DOC-8.10 result.

## DOC-9 — Developer documentation

- [x] DOC-9.1 Establish the developer-documentation foundation and integration model: developer audiences, prerequisites, tooling/source-of-truth matrix, canonical-versus-derived authority map, task-guide structure, navigation and the DOC-9/DOC-10 boundary.
- [x] DOC-9.2 Publish the developer quickstart and local-development workflow: repository/toolchain setup, local/devnet bootstrap, project structure, starter flow and first canonical read plus Wallet-authorized write.
- [ ] DOC-9.3 Document networks, testnet and RPC access: network discovery, chain identity/manifests, Faucet/test accounts, public RPC/WSS, 420RPC boundaries, endpoint health/failover and environment-safety checks.
- [ ] DOC-9.4 Document contracts, deployments, Registry and verification: canonical contract/interface discovery, versioning, deployment planning/external signing, receipt/runtime-code confirmation, 420Verify evidence and Registry/AppStore publication handoffs.
- [ ] DOC-9.5 Document reads, APIs and 420Indexer: canonical RPC versus projections, Indexer endpoints, query/pagination/cursor/replay patterns, provenance, reorg/finality semantics, rate limits and fallback behavior.
- [ ] DOC-9.6 Document Wallet, Smart Account and capability integration: connection versus authority, transaction preparation/simulation, capability/session scopes, passkeys, recovery-aware UX, signing handoff and post-submit confirmation.
- [ ] DOC-9.7 Document SDKs, events, errors and reliability patterns: shared SDK/CLI use, event consumption, stable errors, retry/idempotency/deadlines, finality/confirmation policy, logs and diagnostic correlation.
- [ ] DOC-9.8 Document Storage/Resource, AI/Compute and Bridge integration: provider-neutral storage, job/request/verification/settlement flows, private-payload boundaries and verified cross-chain chain/asset/route/proof/risk/replay handling.
- [ ] DOC-9.9 Document 420 Gaming Protocol developer integration: optional-wallet and guest flows, namespaces, entitlements, guest migration commitments, scoped cross-game attestations, session/capability boundaries and no pay-to-win Wallet coupling.
- [ ] DOC-9.10 Publish end-to-end developer examples and run the DOC-9 coverage audit: complete application workflows from discovery/read/write through deploy/verify/register/publish, security checklist, cross-links and phase closeout qualification.

Exit condition: a developer can start from a clean environment, identify the correct 420 network and canonical services, build locally, use testnet safely, select canonical RPC versus derived APIs correctly, integrate Wallet authorization without handling user secrets, discover/deploy/verify/register contracts, consume SDKs/events/errors reliably, integrate storage/AI/Bridge/Gaming boundaries, and follow complete examples without promoting Developer Hub or other tooling into protocol authority. Generated machine reference remains owned by DOC-10.

DOC-9 uses the same monolithic phase policy as DOC-8: DOC-9.1 through DOC-9.10 remain on one branch/PR and merge once after the final phase audit, reconciliation with current `main`, exact-head 420Docs qualification and exact-head full 420 Integrated qualification.

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
