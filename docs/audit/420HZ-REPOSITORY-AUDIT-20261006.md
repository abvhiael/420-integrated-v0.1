# 420Hz repository audit — 2026-10-06

Repository: `abvhiael/420-integrated-v0.1`

420Hz is a first-year flagship application, not a frozen Genesis application. The authoritative implementation lineage is HZ-1 PR #4, HZ-2 PR #90, HZ-3 PR #100, and HZ-4 PR #105. HZ-1..HZ-3 were merged; HZ-4 existed only on a stale open branch and is recovered onto this current-main remediation branch for exact-head qualification.

## Implemented architecture

- HZ-1: CreatorProfileRegistry420, WorkRegistry420, RecordingRegistry420, ContributorRegistry420, RightsRegistry420, AuthorizationRegistry420, LicenseRegistry420, RoyaltyScheduleRegistry420, RoyaltyVault420, RoyaltyRouter420.
- HZ-2: CatalogRegistry420, CatalogMetadataRegistry420, PostgreSQL catalog/discovery projections.
- HZ-3: MediaManifestRegistry420, StorageSourceRegistry420, PlaybackResolver420, PlaybackAccounting420.
- HZ-4: StreamingSettlementEpoch420, StreamingRevenueAllocator420, StreamingRoyaltySettlement420, PostgreSQL streaming-settlement projection.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| Creative identity/work/recording kernel | PR #4 / Decision #10 | present | Creative kernel + acceptance | creative README | COMPLETE | none |
| Rights, authorization, licensing | PR #4 | present | kernel + acceptance | creative README | COMPLETE | none |
| Royalty schedules/vault/router | PR #4 | present | kernel + acceptance | creative README | COMPLETE | live wiring later |
| Catalog lifecycle | PR #90 | CatalogRegistry420 | CatalogRegistry420.t.sol | code + PR record | COMPLETE | none |
| Presentation manifests | PR #90 | CatalogMetadataRegistry420 | CatalogMetadataRegistry420.t.sol | code + PR record | COMPLETE | none |
| Public catalog projection/discovery | PR #90 | creative-indexer SQL/TS | catalog/discovery tests | creative-indexer README | COMPLETE | deploy live indexer later |
| Media manifests | PR #100 | MediaManifestRegistry420 | focused Foundry tests | code + PR record | COMPLETE | none |
| Storage replicas/failover | PR #100 | StorageSourceRegistry420 | focused Foundry tests | code + PR record | COMPLETE | qualify real providers later |
| Playback resolution | PR #100 | PlaybackResolver420 | focused Foundry tests | code + PR record | COMPLETE | qualify real providers later |
| Playback accounting | PR #100 | PlaybackAccounting420 | focused Foundry tests | code + PR record | COMPLETE | live submitter configuration later |
| Settlement epochs | PR #105 | StreamingSettlementEpoch420 | StreamingSettlementEpoch420.t.sol | this audit | COMPLETE | exact-head CI |
| Revenue allocation | PR #105 | StreamingRevenueAllocator420 | StreamingRevenueAllocator420.t.sol | this audit | COMPLETE | exact-head CI |
| STREAM royalty routing | PR #105 | StreamingRoyaltySettlement420 | StreamingRoyaltySettlement420.t.sol | this audit | COMPLETE | exact-head CI + live allowlist/schedules |
| Settlement projection | PR #105 | SQL/TS projection | projection tests | this audit | COMPLETE | exact-head CI |
| Dedicated 420Hz frontend | no canonical committed requirement found | absent | none | limitation recorded | NOT APPLICABLE | future roadmap only if adopted |
| Consolidated HZ-1..HZ-4 deploy/init manifest | release-readiness requirement | absent | absent | gap recorded | MISSING | create before testnet promotion |
| Live Registry/address bindings | release-readiness requirement | absent | none | gap recorded | BLOCKED | public testnet/deployment |
| Live RPC/storage/indexer qualification | release-readiness requirement | local/reference only | repository CI only | gap recorded | BLOCKED | public testnet/infrastructure |

## Security determination

No critical repository-local vulnerability was identified in the reviewed HZ-1..HZ-4 architecture. Verified/mitigated controls include explicit creator authorization, bounded catalog/playback batches, replay protection, immutable/finalized settlement lifecycle, deterministic revenue conservation, exact-value royalty routing, canonical Router/Vault reuse, and fail-closed playback content-hash matching.

Accepted design risks / trust assumptions:
- playback and revenue roots are submitter commitments rather than independently proven facts;
- governance controls playback/settlement submitter allowlists;
- RoyaltyRouter governance must allowlist StreamingRoyaltySettlement420;
- PostgreSQL projections are non-authoritative and must remain rebuildable;
- live provider integrity, reorg handling, monitoring, key management and incident recovery are environment-level obligations.

## Build/test model

Solidity: Foundry, Solidity 0.8.24, Cancun, optimizer, via-IR. The repository-wide Solidity PR shards qualify mixed/non-Compute contract changes.

Indexer: Node.js >=22, TypeScript, PostgreSQL 16. The Creative Reference Indexer workflow generates the Decision #10 fixture, builds TypeScript, and runs serialized projection tests.

## Deployment/readiness gap

`contracts/script/Decision10DeploySeed420.s.sol` is an HZ-1 deterministic development fixture, not a full HZ-1..HZ-4 deployment manifest. Before public-testnet promotion, 420Hz still needs an exact deployment order and retained manifest covering HZ-2/HZ-3/HZ-4 addresses, governance timelock, submitters, STREAM schedules, RoyaltyRouter settlement-source allowlisting, Registry publication, network identity, live indexer/RPC configuration, monitoring and recovery evidence.

420Hz must therefore distinguish repository qualification from live deployment readiness.
