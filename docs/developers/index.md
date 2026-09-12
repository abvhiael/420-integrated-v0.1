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

1. **DOC-9.1 — Developer documentation foundation and integration model** — establish developer audiences, source-of-truth rules, authority map, prerequisite/tooling matrix, navigation and the boundary between task guides and generated DOC-10 reference.
2. **DOC-9.2 — Quickstart and local development** — repository setup, toolchains, local/devnet bootstrap, starter workflow, project structure and first read/write integration.
3. **DOC-9.3 — Networks, testnet and RPC access** — network discovery, chain identity, manifests, testnet/Faucet use, public RPC/WSS, 420RPC boundaries, endpoint health and environment safety.
4. **DOC-9.4 — Contracts, deployments, Registry and verification** — canonical contract discovery, interfaces/versions, deployment workflow, bytecode confirmation, 420Verify evidence, Registry registration and AppStore publication boundaries.
5. **DOC-9.5 — Reads, APIs and 420Indexer** — canonical RPC versus indexed projections, Indexer API patterns, pagination/replay/cursors, provenance, finality/reorg handling and service fallbacks.
6. **DOC-9.6 — Wallet, Smart Accounts and capabilities** — connect versus authorize, transaction preparation, simulation, capability/session scopes, passkeys, recovery-aware integrations and post-submit confirmation.
7. **DOC-9.7 — SDKs, events, errors and reliability patterns** — shared SDK/CLI usage, event consumption, stable error handling, retry/idempotency, deadlines, confirmations/finality and diagnostic correlation.
8. **DOC-9.8 — Storage, AI/Compute and Bridge integrations** — provider-neutral storage/resource flows, 420AI/ComputeMarket jobs, privacy/verification/settlement boundaries and verified cross-chain route/proof/risk handling.
9. **DOC-9.9 — Gaming Protocol integration** — optional-wallet/guest flows, registered game namespaces, entitlements, guest migration commitments, scoped cross-game attestations and no pay-to-win Wallet coupling.
10. **DOC-9.10 — End-to-end examples and developer coverage audit** — production-oriented example integrations, deployment/verification/publishing workflow, security checklist, cross-link audit and phase closeout.

DOC-9 follows the same monolithic phase policy as DOC-8: all DOC-9.x commits remain on one branch/PR and the phase merges once, after DOC-9.10, reconciliation with current `main`, exact-head 420Docs qualification and exact-head full-repository qualification.

## Existing implementation sources

DOC-9 will consolidate rather than replace the implemented Developer Hub and architecture material, including:

- Developer Hub network/environment discovery and canonical contract catalogue;
- TypeScript SDK and CLI;
- Wallet/smart-account SDK;
- local/devnet bootstrap and templates;
- testnet Faucet/test-account flows;
- deployment and 420Verify workflows;
- 420Indexer API integration;
- protocol integration guides;
- application registration/AppStore publishing;
- logs/events/debugging and service-health diagnostics;
- existing DOC-3 through DOC-8 architecture and application documentation.

The existing [end-to-end dApp integration guide](../developer-hub/guides/end-to-end-dapp.md) is an implementation source for DOC-9 examples, while the completed Developer Hub remains a noncanonical developer control plane.

## Generated reference boundary

DOC-9 is task-oriented documentation. Machine-derived NatSpec, ABI, RPC/API/SDK reference, event/error catalogues, deployment registries and similar generated material belong to DOC-10 and will be linked from these guides rather than copied by hand.
