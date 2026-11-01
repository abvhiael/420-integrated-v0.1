---
title: 420Hz architecture and release status
audience: [user, developer, architect, operator]
category: application
status: development
version: current
---

# 420Hz

420Hz is the music-focused application and protocol layer of 420 Integrated. The repository currently implements the chain-authoritative creative/music kernel, catalog metadata and projections, provider-neutral media/playback primitives, and streaming settlement/royalty routing. It does **not** yet contain a production user-facing 420Hz web/mobile application or a live production indexer/API service.

## Canonical implemented layers

### HZ-1 — Creative Protocol kernel
- creator profiles;
- Work and Recording registries;
- contributor credits;
- versioned rights splits and transfers;
- authorization policies and recording licences;
- royalty schedules, vault accounting and routing;
- deterministic Decision #10 fixture and reference indexer coverage.

### HZ-2 — Catalog and public projections
- release catalog lifecycle;
- creator/release presentation manifests;
- PostgreSQL catalog projections;
- deterministic discovery/filtering surfaces.

### HZ-3 — Media and playback
- immutable media-manifest revision history;
- bounded provider-neutral current storage-source set with retained historical source records;
- playback resolution against canonical content identity;
- replay-protected, bounded playback aggregate submission.

### HZ-4 — Streaming settlement
- settlement epoch commitments and finalization;
- deterministic per-recording allocation from HZ-3 playback aggregates;
- STREAM-only routing into the canonical RoyaltyRouter420/RoyaltyVault420 path;
- replay-safe settlement projections.

## Trust model

Canonical ownership, rights, authorization, settlement and royalty accounting are on-chain. PostgreSQL is a rebuildable non-authoritative projection. Raw listening events remain off-chain; authorized submitters commit aggregate playback batches and roots. HZ-4 settlement submitters are explicitly allowlisted and finalization is governance-controlled.

No frontend, indexer, search service or storage provider becomes rights or settlement authority merely by serving data.

## Current ecosystem integration

The implemented contracts compose internally through the Creative Protocol modules and use the shared governance timelock model. Native 420 value is the current royalty settlement asset. The repository does not yet contain direct production bindings from 420Hz to 420Wallet, 420Names, 420Identity, 420Notifications, 420Analytics, 420Search, 420Verify, 420Storage, 420Pay, or 420Registry service discovery.

Those missing bindings are application/release work, not hidden protocol authority.

## Build and test

Solidity is built and tested by `.github/workflows/contracts-foundry.yml`. The Creative Reference Indexer is built and tested against PostgreSQL by `.github/workflows/creative-indexer.yml`.

From a local checkout:

```sh
cd contracts
forge build
forge test

cd ../creative-indexer
npm install
npm run build
npm test
```

The indexer tests require PostgreSQL and the Decision #10 fixture as documented in `creative-indexer/README.md`.

## Deployment order for the implemented protocol

1. governance timelock / shared governance authority;
2. CreatorProfileRegistry420;
3. WorkRegistry420 and RecordingRegistry420;
4. RightsRegistry420 and contributor/authorization/licence modules;
5. RoyaltyScheduleRegistry420 and RoyaltyVault420;
6. RoyaltyRouter420 and settlement-source allowlisting;
7. catalog registries;
8. MediaManifestRegistry420, StorageSourceRegistry420, PlaybackResolver420, PlaybackAccounting420;
9. StreamingSettlementEpoch420;
10. StreamingRevenueAllocator420;
11. StreamingRoyaltySettlement420;
12. allowlist StreamingRoyaltySettlement420 as a RoyaltyRouter420 settlement source;
13. deploy/rebuild the Creative Reference Indexer projection.

Exact production addresses are not frozen for 420Hz in the Genesis application catalog.

## Release classification

420Hz is a first-year flagship application, not one of the frozen Genesis public applications in `config/genesis-applications.json`.

The current repository can qualify the protocol implementation and reference projections. It cannot yet qualify a complete user-facing testnet or production application because the live service/runtime, API, frontend, deployment manifests, ecosystem bindings, operational monitoring/recovery, and public testnet evidence do not yet exist.

See `docs/audit/420HZ-AUDIT-REMEDIATION-ROADMAP.md` for the exact remaining gates.
