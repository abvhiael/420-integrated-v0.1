# 420 Developer Hub — DEVHUB-0 Architecture Freeze

## Status
DEVHUB-0 defines the architecture, authority boundaries, source-of-truth rules, and initial repository shape for the 420 Developer Hub.

The Developer Hub is the developer-facing control plane for 420 Integrated. It does not become a new source of protocol truth.

## Core rule
The Hub consumes canonical protocol state and signed/canonical manifests. It must not silently duplicate or override chain, registry, wallet, indexer, verification, app-store, governance, bridge, oracle, storage, AI, or game authority.

## Primary responsibilities
The Developer Hub may provide:

- network discovery and environment configuration
- canonical contract catalogue and ABI/interface distribution
- SDK and CLI entry points
- local/devnet tooling
- testnet faucet access
- deployment and verification workflows
- 420Indexer-backed query surfaces
- 420 Wallet and smart-account integration helpers
- protocol integration guides and starter projects
- application manifest validation and publishing workflows
- developer project metadata, service credentials, diagnostics, and status surfaces

## Explicit non-responsibilities
The Developer Hub must not:

- define canonical balances, ownership, identity, entitlements, governance, or protocol lifecycle state
- replace 420Registry or canonical protocol registries
- become the canonical application registry when 420AppStore/registry state exists
- treat indexed projections as authoritative chain state
- authorize capabilities that belong to protocol contracts
- mint or control production assets outside the canonical protocol path
- weaken wallet, signature, replay, expiry, chain-id, or capability checks for developer convenience

## Source-of-truth map
| Concern | Canonical source | Developer Hub role |
| --- | --- | --- |
| chain state | 420 chain / RPC | read, simulate, display |
| indexed projections | 420Indexer | query non-authoritative projections |
| protocol addresses | canonical network manifest / registry | resolve and display |
| protocol ABI/interface | verified build artifact / canonical catalogue | distribute |
| identity and capabilities | 420Identity / protocol authorization | integrate only |
| wallet/account authority | 420 Wallet / smart-account contracts | connect and submit |
| contract verification | 420Verify + canonical bytecode/source flow | orchestrate and display |
| app registration | 420Registry / 420AppStore path | validate and publish |
| service health | 420Status and service health endpoints | aggregate and display |
| test funds | testnet faucet | request only |

## Repository shape
DEVHUB-0 reserves the following structure:

```text
developer-hub/
  README.md
  package.json
  manifests/
    local.example.json
  schema/
    network-manifest.schema.json
  test/
    architecture-contract.test.mjs
```

Later phases may add:

```text
apps/developer-hub/
packages/420-sdk/
packages/420-contracts/
packages/420-config/
packages/420-cli/
packages/420-devkit/
examples/
```

Those later directories are not created in DEVHUB-0 unless implementation requires them.

## Canonical network manifest
A network manifest is configuration, not governance. It MUST identify the network and canonical integration endpoints while remaining fail-closed when required data is absent.

Required top-level fields:

- `schemaVersion`
- `network`
- `nativeCurrency`
- `rpc`
- `services`
- `contracts`

The schema intentionally separates:

- chain identity
- transport endpoints
- service endpoints
- canonical contract references

A Hub client must reject unsupported schema versions and malformed chain identifiers rather than guessing.

## 420Indexer boundary
The shared `420-indexer` package is the preferred off-chain query source for blocks, transactions, logs, protocol projections, and search-style developer experiences.

Indexed output remains a projection. Any security-sensitive or authorization-sensitive operation must resolve canonical state from the appropriate chain contract or canonical RPC path before execution.

## Versioning
Developer-facing manifests and packages use explicit semantic versions. Breaking schema or API changes require a version increment and compatibility handling; silent interpretation changes are forbidden.

## Security invariants
DEVHUB-INV-001 — Hub-derived data never overrides canonical authorization state.

DEVHUB-INV-002 — Indexed projection data is never treated as sufficient proof for a security-sensitive state transition.

DEVHUB-INV-003 — Unknown network-manifest schema versions fail closed.

DEVHUB-INV-004 — Chain ID is explicit and never inferred from a hostname, wallet label, or UI environment name.

DEVHUB-INV-005 — Production and testnet faucet behavior remain strictly separated; faucet capability is testnet-only.

DEVHUB-INV-006 — Contract catalogue entries include an explicit address and canonical source label; the Hub does not invent missing deployments.

DEVHUB-INV-007 — Service credentials do not confer on-chain protocol authority.

DEVHUB-INV-008 — Publishing workflows validate manifests before submitting them to canonical registry/app-store paths.

## DEVHUB-0 exit criteria
DEVHUB-0 is complete when:

1. architecture and authority boundaries are documented;
2. the Developer Hub repository root exists;
3. the network-manifest schema exists;
4. a non-production example manifest exists;
5. automated tests enforce the initial architecture contract;
6. no canonical protocol state is introduced by the Hub foundation;
7. the phase is qualified on a branch and ready for PR review.

## Next phase
DEVHUB-1 will implement network/environment discovery against the frozen manifest contract, including canonical chain metadata, RPC endpoints, Explorer/Indexer/Verify/Status service references, and contract catalogue resolution.