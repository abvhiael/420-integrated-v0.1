# 420 Developer Hub — DEVHUB-12 Protocol Integration Guides

## Status

DEVHUB-12 turns the existing Developer Hub building blocks into complete developer workflows. It adds a versioned machine-readable guide registry, a validated guide runtime, CLI discovery/view commands, and five human-readable integration guides spanning read-only protocol access, Wallet-authorized writes, deployment, verification, 420Indexer diagnostics, and end-to-end dApp integration.

The guide layer is documentation/orchestration metadata only. It does not inherit chain, Wallet, 420Verify, 420Registry, 420AppStore, or Indexer authority.

## Scope

DEVHUB-12 adds:

- `developer-hub/guides/registry.json` as the canonical Developer Hub integration-guide registry;
- schema/version validation for guide metadata;
- fail-closed guide and step identifiers;
- explicit per-step authority ownership;
- explicit canonical vs projection classification;
- safe documentation-path references;
- CLI guide listing and machine-readable guide views;
- complete human guides for the five primary current Developer Hub integration workflows.

## Guide registry

The registry uses `schemaVersion: 1.0.0`.

Each guide declares:

- stable `id`;
- `title`;
- `summary`;
- repository documentation path;
- ordered workflow steps.

Every workflow step declares:

- stable step `id`;
- Developer Hub/protocol component;
- owning authority;
- whether that step is canonical for the stated workflow;
- the developer action performed at that boundary.

A guide is invalid if it does not identify at least one canonical authority checkpoint. This prevents a projection-only workflow from being presented as sufficient for a security-sensitive integration.

## Included guides

### `read-only-protocol-client`

Connects DEVHUB-1 network discovery, DEVHUB-2 canonical contract resolution, DEVHUB-3 SDK reads and DEVHUB-11 Indexer queries.

The guide makes the key read rule explicit: Indexer may accelerate search/history/projection UX, but a security-sensitive decision must be revalidated against canonical chain/protocol state.

### `wallet-aware-transaction`

Connects SDK-prepared application intent to DEVHUB-4 Wallet/Smart Account authorization and canonical transaction confirmation.

Application code may construct calldata and previews. 420 Wallet/Smart Account remains the authority for account identity, capability checks, user authorization, signing and submission. Developer Hub never becomes a raw-key execution path.

### `deploy-and-verify`

Connects DEVHUB-9 deployment planning to external signing, canonical RPC receipt/runtime-code confirmation and DEVHUB-10 verification evidence.

The workflow preserves three separate meanings:

- deployment planning is non-custodial Developer Hub orchestration;
- deployed code is canonical chain state;
- verification is reproducible 420Verify evidence and is not an audit, safety guarantee or official application registration.

### `indexer-diagnostics`

Documents safe use of DEVHUB-11 and the public 420Indexer v1 API for health, readiness, status and developer queries.

The guide explicitly requires callers to leave the projection layer and query the owning canonical authority before authorization, settlement, governance, Registry legitimacy or wallet-permission decisions.

### `end-to-end-dapp`

Combines discovery, catalogue, SDK, Indexer, Wallet, deployment and verification into one dApp integration path.

It also records the future handoff to DEVHUB-13 for 420Registry/420AppStore registration and publication rather than inventing local application legitimacy before that phase exists.

## Human documentation

DEVHUB-12 adds:

```text
docs/developer-hub/guides/read-only-protocol-client.md
docs/developer-hub/guides/wallet-aware-transaction.md
docs/developer-hub/guides/deploy-and-verify.md
docs/developer-hub/guides/indexer-diagnostics.md
docs/developer-hub/guides/end-to-end-dapp.md
```

These documents explain the same authority boundaries encoded by the machine-readable registry. Browser/dashboard work can therefore consume the registry without creating a second, weaker workflow model.

## CLI

DEVHUB-12 adds:

```text
420 guides
420 guide ID
```

`420 guides` lists stable guide metadata.

`420 guide ID` returns the machine-readable workflow view, including:

- ordered steps;
- owning authority for every step;
- `canonicalSteps`;
- `projectionSteps`;
- `authorityBoundaryPreserved: true`;
- the associated human-readable documentation path.

These commands intentionally load only the checked-in guide registry. They do not require RPC, contract-catalogue, Wallet, Indexer or 420Verify availability just to explain the integration workflow.

## Authority boundaries

DEVHUB-12 preserves the existing architecture rather than flattening it into one generic Developer Hub authority:

| Concern | Owning authority |
| --- | --- |
| network identity | selected canonical network manifest + chain ID |
| contract identity/interface | canonical contract catalogue / Registry source |
| security-relevant chain state | canonical RPC / owning protocol contract |
| SDK call construction | application/SDK convenience only |
| account capability and signing | 420 Wallet / Smart Account |
| deployment signature | Wallet or qualified project adapter |
| deployed bytecode | canonical chain state |
| verification classification | 420Verify |
| search/history/projections | 420Indexer, non-canonical |
| application registration/publication | 420Registry / 420AppStore, implemented through DEVHUB-13 |
| workflow explanation/orchestration | Developer Hub, non-authoritative |

## Invariants

- **DEVHUB-INV-084** — the integration-guide registry is explicitly versioned and unsupported schema versions fail closed.
- **DEVHUB-INV-085** — guide documentation references remain inside the repository `docs/` namespace and unsafe traversal paths are rejected.
- **DEVHUB-INV-086** — every integration guide identifies at least one canonical authority checkpoint; projection-only workflows cannot masquerade as complete security workflows.
- **DEVHUB-INV-087** — SDK/application call preparation is intent construction only and cannot itself authorize a state-changing protocol action.
- **DEVHUB-INV-088** — Wallet/Smart Account remains the authorization/signing boundary for user/account writes; Developer Hub does not acquire raw signing-secret authority.
- **DEVHUB-INV-089** — deployment planning remains non-custodial and canonical RPC remains authoritative for receipt, deployed address and deployed runtime code.
- **DEVHUB-INV-090** — 420Verify verification remains reproducibility evidence and cannot be transformed by a guide into an audit, safety guarantee, official registration or wallet permission.
- **DEVHUB-INV-091** — 420Indexer projections remain non-canonical and cannot authorize settlement, governance, Registry legitimacy, wallet permissions or other security-sensitive transitions.
- **DEVHUB-INV-092** — CLI/browser guide surfaces consume the same checked-in registry and may not redefine or bypass its authority checkpoints.
- **DEVHUB-INV-093** — application registration/publication remains a DEVHUB-13 handoff to 420Registry/420AppStore authority and cannot be locally fabricated by DEVHUB-12.

## Exit criteria

DEVHUB-12 is complete when:

1. a versioned integration-guide registry exists and validates fail-closed;
2. each guide declares ordered components, authorities and canonical/projection boundaries;
3. read-only, Wallet-aware, deploy/verify, Indexer-diagnostic and end-to-end workflows are documented;
4. every registered human-document path exists;
5. CLI guide listing and guide-view commands expose the same registry semantics;
6. tests reject malformed schemas, duplicate identifiers, unsafe document paths and workflows without canonical checkpoints;
7. Developer Hub remains non-authoritative across all guide workflows;
8. the next Registry/AppStore publishing handoff remains reserved for DEVHUB-13.

## Next

DEVHUB-13 adds application registration and publishing workflows, validating application/release metadata and handing canonical registration/publication to 420Registry and 420AppStore without allowing Developer Hub to fabricate ecosystem legitimacy.
