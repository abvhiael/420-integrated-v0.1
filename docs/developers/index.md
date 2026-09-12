---
title: Build on 420 Integrated
audience:
  - developer
category: developer
status: development
version: current
---

# Build on 420 Integrated

DOC-9 is the canonical cross-ecosystem developer documentation phase for building applications, services and integrations on 420 Integrated.

The Developer Hub implementation is already complete through DEVHUB-19. DOC-9 does not rebuild that control plane or duplicate the DOC-8 application manuals. It turns the existing chain, protocol, infrastructure, Wallet, Indexer, Developer Hub and application integration material into a coherent developer journey: discover the correct network and contracts, build locally, use testnet safely, read canonical and derived state, prepare Wallet-authorized writes, integrate shared services, handle finality/errors/retries and ship reproducible examples.

## Start here

DOC-9.1 establishes the developer contract used by every later guide:

- [Developer integration model](integration-model.md) — canonical authority boundaries, read/write handoffs, provider neutrality, failure behavior and the standard integration sequence.
- [Source of truth and finality](source-of-truth.md) — source precedence, canonical versus indexed reads, provenance, confirmations, finality and reorg handling.
- [Developer prerequisites and tooling](prerequisites.md) — common prerequisites, tooling matrix, environment discipline, secret/signer rules and the baseline integration checklist.

DOC-9.2 adds the first working developer path:

- [Developer quickstart](quickstart.md) — clean checkout through local devnet, first canonical read and first Wallet-authorized write.
- [Local development](local-development.md) — real15 topology, lifecycle commands, local data/reset expectations and health-check order.
- [Project structure and starters](project-structure.md) — `sdk-basic`, `protocol-reader`, `wallet-aware` and the recommended integration layers.
- [First read and Wallet-authorized write](first-read-write.md) — canonical-read versus signing-authority boundary and post-submit confirmation.

DOC-9.3 adds safe environment and public-access guidance:

- [Networks and manifests](networks-and-manifests.md) — manifest schema, explicit environment selection, chain/deployment identity and the rule that chain ID alone is insufficient proof of network.
- [Testnet and Faucet](testnet-and-faucet.md) — official-testnet manifest workflow, external-custody test accounts, Faucet limits and canonical balance confirmation.
- [RPC and WebSocket access](rpc-and-websocket.md) — current `node420` JSON-RPC path, public method boundary, transaction submission/finality, WebSocket recovery and the replaceable 420RPC boundary.
- [Endpoint health and failover](endpoint-health-and-failover.md) — readiness checks, same-environment failover, finalized disagreement handling, provider quarantine and credential separation.

The repository currently checks in only the local example manifest. DOC-9 does not invent public testnet or mainnet endpoints; deployment-specific values must come from an official manifest for that environment.

DOC-9.4 adds the contract release path:

- [Contracts and interfaces](contracts-and-interfaces.md) — canonical service/version discovery, implementation/code-hash checks, interface/profile commitments and ABI/version selection.
- [Deployment workflow](deployment-workflow.md) — qualified artifacts, non-custodial planning, external signing, canonical receipt/code confirmation and safe retry boundaries.
- [Verification and evidence](verification-and-evidence.md) — 420Verify evidence inputs/result classes, proxy/upgrade handling and the distinction between reproducibility and endorsement.
- [Registry and publishing](registry-and-publishing.md) — release manifests, Registry preflight, governance-authorized canonical registration and non-canonical AppStore publication.

DOC-9.5 adds the read and 420Indexer path:

- [Reads and source selection](reads-and-source-selection.md) — when to use canonical RPC/owning contracts versus rebuildable 420Indexer projections and when to recheck chain truth.
- [420Indexer API](indexer-api.md) — stable v1 envelopes/routes, chain scoping, readiness/status semantics and the public API boundary.
- [Pagination, replay and reorgs](pagination-replay-and-reorgs.md) — opaque keyset cursors, bounded pages, consumer checkpoints, replay and non-finalized reorg reconciliation.
- [API fallback and reliability](api-fallback-and-reliability.md) — stale/degraded behavior, same-environment fallback, retry/caching/privacy rules and deployment-specific rate-limit handling.

DOC-9.6 adds the Wallet/Smart Account authorization path:

- [Wallet and Smart Account integration](wallet-and-smart-accounts.md) — connection versus authority, canonical account-state revalidation, EntryPoint execution and authorization epochs.
- [Transaction preparation and simulation](transaction-preparation-and-simulation.md) — bounded intent, Wallet simulation/review, stale-state invalidation and canonical post-submit confirmation.
- [Capabilities and sessions](capabilities-and-sessions.md) — session keys, target/selector-scoped grants, limits, validity, revocation and gas-sponsorship boundaries.
- [Passkeys and recovery-aware integrations](passkeys-and-recovery.md) — owner-level passkey UserOperations, epoch-bound credentials, two-day recovery and post-recovery authority invalidation.

DOC-9.7 adds the common reliability layer:

- [SDK and CLI integration](sdk-and-cli.md) — shared `@420/sdk`/`420` CLI boundaries, explicit environment binding, deterministic output and signer separation.
- [Events, logs and finality](events-and-finality.md) — indexed/canonical event sources, replay-safe event consumption, WebSocket recovery and head/safe/finalized handling.
- [Errors, retries and idempotency](errors-retries-and-idempotency.md) — error classes, bounded retry rules, state-changing submission safety, idempotency and deadline/expiry handling.
- [Diagnostics and correlation](diagnostics-and-correlation.md) — source-preserving transaction/event diagnostics, stable correlation identifiers, Developer Hub debug commands and support-safe logging.

DOC-9.8 adds provider-backed integrations:

- [Provider-backed integration model](provider-backed-integrations.md) — common request/evidence/verification/settlement boundaries and private-payload rules across replaceable providers.
- [Storage and Resource integration](storage-and-resource-integration.md) — offers, bounded sessions, storage agreements, capacity, commitments, proofs, retrievability and Vault-backed settlement.
- [420AI and Compute integration](ai-and-compute-integration.md) — model/version identity, request constraints, ComputeMarket execution, result commitments, verification and settlement.
- [420 Bridge integration](bridge-integration.md) — exact chain/asset/route identity, source finality, adapters/verifiers, risk, replay and destination completion.

Read the foundation pages before implementing a production-facing integration. Later DOC-9 sections may add convenience abstractions, but they must not weaken these rules.

## Local workflow at a glance

From `developer-hub/`, inspect and qualify the local profile before starting it:

```bash
npm run devnet:plan
npm run devnet:doctor
npm run devnet:smoke
```

For a normal development session:

```bash
npm run devnet:prepare
npm run devnet:up
```

Then confirm the selected network and canonical RPC path through the repository-native CLI:

```bash
420 network
420 rpc eth_chainId '[]'
420 rpc eth_blockNumber '[]'
```

Starter projects are discovered through `420 templates` and created with `420 create`. State-changing requests must cross the 420 Wallet/Smart Account boundary; the CLI and starter applications must not acquire raw user signing secrets.

## Developer paths

| Goal | Start with | Continue in |
| --- | --- | --- |
| Build a first local dApp | [quickstart](quickstart.md) | local development + project structure + first read/write |
| Connect to testnet/RPC | [networks and manifests](networks-and-manifests.md) | testnet/Faucet + RPC/WSS + endpoint health/failover |
| Deploy/register a contract | [contracts and interfaces](contracts-and-interfaces.md) | deployment + verification + Registry/publishing |
| Build read-heavy UX | [reads and source selection](reads-and-source-selection.md) | 420Indexer API + pagination/replay + fallback/reliability |
| Submit user-authorized writes | [Wallet and Smart Account integration](wallet-and-smart-accounts.md) | transaction preparation + capabilities/sessions + passkeys/recovery |
| Build resilient SDK/event handling | [SDK and CLI integration](sdk-and-cli.md) | events/finality + errors/retries + diagnostics/correlation |
| Integrate Storage, AI or Bridge | [provider-backed integration model](provider-backed-integrations.md) | storage/resource + AI/Compute + Bridge guides |
| Integrate a game | prerequisites + integration model | DOC-9.9 Gaming Protocol |
| Review a complete production flow | all DOC-9 foundation pages | DOC-9.10 examples/audit |

## Authority rule

Developer tooling is never a substitute for the authority that owns the state being changed.

- network identity comes from the selected canonical manifest and chain ID;
- canonical state comes from the chain and owning protocol contracts;
- Registry/contract discovery identifies approved services and versions;
- 420Indexer provides rebuildable projections, not canonical state;
- Wallet/Smart Account owns user authorization and signing;
- deployment signatures remain with the qualified signer;
- 420Verify provides reproducible-build evidence, not audit or endorsement;
- Developer Hub orchestrates and validates handoffs but is non-authoritative.

## DOC-9 work order

1. **DOC-9.1 — Developer documentation foundation and integration model — COMPLETE** — developer audiences, source-of-truth rules, authority model, prerequisite/tooling matrix, landing/navigation paths and the DOC-10 generated-reference boundary.
2. **DOC-9.2 — Quickstart and local development — COMPLETE** — repository/toolchain setup, local real15 bootstrap, starter selection/project structure, first canonical read and first Wallet-authorized write/confirmation flow.
3. **DOC-9.3 — Networks, testnet and RPC access — COMPLETE** — explicit manifest/environment discovery, testnet/Faucet procedure without invented deployment values, current `node420` public RPC/WSS access, 420RPC ingress boundary, endpoint readiness/failover and cross-environment fail-closed rules.
4. **DOC-9.4 — Contracts, deployments, Registry and verification — COMPLETE** — canonical contract/service/version/interface discovery, non-custodial deployment planning/external signing, canonical receipt/runtime-code confirmation, 420Verify evidence semantics and governance-only Registry plus AppStore publication handoffs.
5. **DOC-9.5 — Reads, APIs and 420Indexer — COMPLETE** — canonical-versus-derived read selection, stable Indexer v1 API use, opaque cursor pagination/replay, provenance/finality/reorg handling, stale/degraded fallback and non-invented deployment rate-limit policy.
6. **DOC-9.6 — Wallet, Smart Accounts and capabilities — COMPLETE** — connection-versus-authority boundaries, canonical Smart Account revalidation, bounded transaction preparation/simulation, target/selector-scoped capability/session grants, passkey UserOperation semantics, recovery-aware invalidation and post-submit canonical confirmation.
7. **DOC-9.7 — SDKs, events, errors and reliability patterns — COMPLETE** — shared SDK/CLI authority boundaries, replay/finality-safe event handling, classified errors, bounded retries/idempotency/deadlines and provenance-preserving diagnostic correlation.
8. **DOC-9.8 — Storage, AI/Compute and Bridge integrations — COMPLETE** — common provider/evidence/privacy boundary, Resource/420Store offer-session-agreement-proof-settlement flow, AI/Compute request-match-result-verification-settlement flow and Bridge chain/asset/route/finality/proof/risk/replay flow.
9. **DOC-9.9 — Gaming Protocol integration** — optional-wallet/guest flows, registered game namespaces, entitlements, guest migration commitments, scoped cross-game attestations and no pay-to-win Wallet coupling.
10. **DOC-9.10 — End-to-end examples and developer coverage audit** — production-oriented example integrations, deployment/verification/publishing workflow, security checklist, cross-link audit and phase closeout.

DOC-9 follows the same monolithic phase policy as DOC-8: all DOC-9.x commits remain on one branch/PR and the phase merges once, after DOC-9.10, reconciliation with current `main`, exact-head 420Docs qualification and exact-head full-repository qualification.

## Existing implementation sources

DOC-9 consolidates rather than replaces the implemented Developer Hub and architecture material, including Developer Hub network/environment discovery and canonical contract catalogue; TypeScript SDK and CLI; Wallet/smart-account SDK; local/devnet bootstrap and templates; testnet Faucet/test-account flows; deployment and 420Verify workflows; 420Indexer API integration; protocol integration guides; application registration/AppStore publishing; logs/events/debugging and service-health diagnostics; and existing DOC-3 through DOC-8 architecture/application documentation.

The existing [end-to-end dApp integration guide](../developer-hub/guides/end-to-end-dapp.md) is an implementation source for DOC-9 examples, while the completed Developer Hub remains a noncanonical developer control plane.

## Generated reference boundary

DOC-9 is task-oriented documentation. Machine-derived NatSpec, ABI, RPC/API/SDK reference, event/error catalogues, deployment registries and similar generated material belong to DOC-10 and will be linked from these guides rather than copied by hand.

Handwritten DOC-9 pages may name the interface or operation a developer needs, explain the safe sequence and identify the owning authority. They must not become a second manually maintained ABI, event catalogue or deployment-address registry.
