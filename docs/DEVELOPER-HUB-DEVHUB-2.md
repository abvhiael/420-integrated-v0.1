# 420 Developer Hub — DEVHUB-2 Canonical Contract Catalogue

## Status
DEVHUB-2 establishes the Developer Hub contract catalogue and ABI/interface distribution boundary.

The catalogue is a developer distribution surface, not a new authority source. Contract addresses and provenance must originate from canonical genesis, registry, governance, or deployment-manifest state. ABI/interface metadata must identify verified build artifacts.

## Responsibilities
DEVHUB-2 provides:

- chain-scoped contract catalogue entries
- canonical contract name and protocol identity
- deployed address and deployment block
- provenance source
- semantic version metadata
- verified build-artifact path
- Solidity interface path
- ABI SHA-256 identity
- lookup by canonical name or deployed address
- null-on-unknown behavior

## Invariants

- **DEVHUB-INV-009** — catalogue entries never override canonical chain/registry state.
- **DEVHUB-INV-010** — each catalogue entry has a valid address and explicit provenance.
- **DEVHUB-INV-011** — only verified entries are distributable.
- **DEVHUB-INV-012** — every distributed ABI is pinned by SHA-256 identity.
- **DEVHUB-INV-013** — duplicate canonical names or deployed addresses fail closed.
- **DEVHUB-INV-014** — unknown names and addresses resolve to `null`; the Hub must not invent contracts.
- **DEVHUB-INV-015** — catalogue chain identity is explicit and positive.

## Relationship to 420Indexer

420Indexer already derives deterministic event descriptors from canonical artifacts and predeploy data. DEVHUB-2 deliberately does not replace that decoder path. The Developer Hub distributes developer-facing contract metadata while the Indexer keeps its own deterministic projection/decoder boundary.

## Distribution model

A production catalogue entry is expected to point at repository/build outputs that have passed verification. The ABI checksum allows downstream SDKs and tooling to detect mismatched or substituted artifacts before use.

Future package work may expose these entries through `@420/contracts`, but DEVHUB-2 keeps the catalogue representation transport-neutral.

## Exit criteria

DEVHUB-2 is complete when:

1. catalogue input fails closed on malformed or unverified entries;
2. every entry includes canonical name, protocol, address, source, version, deployment block, artifact, interface, ABI checksum, and verification status;
3. duplicate identities are rejected;
4. lookup by name and address is deterministic;
5. ABI/interface references are available without copying authority into the Hub;
6. the test suite covers hostile/malformed catalogue inputs.

## Next

DEVHUB-3 builds the shared TypeScript SDK foundation on top of DEVHUB-1 network discovery and DEVHUB-2 contract metadata.
