# HZ-AUDIT-3 — Registry and authority wiring

Status: COMPLETE — Level 1 qualified on exact implementation SHA `6711c24f2cdc7c77dd9e1a5227367afba5eeb734`.

## Canonical purpose

HZ-AUDIT-3 closes the repository-side authority and canonical-discovery gap left deliberately open by HZ-AUDIT-2.

This step defines and qualifies:

- GovernanceTimelock-only post-deployment wiring across HZ-1 through HZ-4;
- playback and streaming-settlement submitter grant semantics;
- the complete 20-module `CreativeProtocolRegistry420` inventory;
- the canonical external `ProtocolRegistry` component and service identities for 420Hz;
- the registration commitments and dependency root required to prove that external discovery resolves the exact HZ root;
- fail-closed behavior for unauthorized callers, zero submitters, unapproved extension service publication, and version replay.

HZ-AUDIT-3 does **not** execute production/testnet governance transactions and does not fabricate live submitter addresses, deployed addresses, transaction hashes, runtime hashes or Registry receipts. Those are environment evidence retained at the public-testnet stage.

420Hz remains a first-year flagship application, not a frozen Genesis application. No new fixed Genesis address is introduced.

## Canonical dependencies

The frozen Genesis address authority remains authoritative for shared governance/discovery contracts:

- GovernanceTimelock: `0x0000000000000000000000000000000000000429`
- ProtocolRegistry: `0x0000000000000000000000000000000000000434`

HZ contracts remain Registry-resolved and receive no fixed Genesis predeploy.

## Retained implementation

- `contracts/src/creative/deployment/HzRegistryAuthorityPlan420.sol`
  - freezes the canonical HZ component/service identities and Registry commitment hashes;
  - freezes the exact 20 Creative module keys;
  - derives a deterministic dependency root from ordered module key, implementation address and runtime code hash commitments.
- `contracts/config/creative/420hz-authority-registry-bundle.json`
  - records the exact governance wiring sequence;
  - records runtime-only submitter authority inputs without inventing addresses;
  - records the exact 20-module registration inventory;
  - records external `ProtocolRegistry` registration/publication identities and ordering;
  - leaves all live evidence empty/null.
- `contracts/test/HzRegistryAuthority420.t.sol`
  - proves internal governance wiring and submitter grants;
  - proves all 20 module registrations resolve the exact HZ deployments;
  - proves the external component and service both resolve the same `CreativeProtocolRegistry420` root;
  - proves Registry profile commitments and dependency root;
  - proves unauthorized mutations fail;
  - proves zero submitters fail;
  - proves extension service publication fails before governance approval;
  - proves service version replay fails.
- `scripts/verify-420hz-audit-3-authority.py`
  - validates frozen shared authority addresses;
  - rejects any HZ fixed Genesis address;
  - validates exact module/action inventories and Registry identities;
  - checks focused-test coverage markers;
  - rejects fabricated live evidence.
- `.github/workflows/420hz-audit.yml`
  - validates exact qualification head;
  - runs HZ-AUDIT-2 and HZ-AUDIT-3 verifiers;
  - formats/builds affected deployment/authority Solidity;
  - runs both focused HZ deployment and authority test contracts.

## Governance wiring sequence

The exact governance-only internal wiring is:

1. `WorkRegistry420.setRightsRegistry(RightsRegistry420)`
2. `RecordingRegistry420.configureDependencies(RightsRegistry420,AuthorizationRegistry420)`
3. `RightsRegistry420.setRoyaltyAccounting(RoyaltyVault420)`
4. `AuthorizationRegistry420.setLicenseRegistry(LicenseRegistry420)`
5. `LicenseRegistry420.setRoyaltyRouter(RoyaltyRouter420)`
6. `RoyaltyVault420.setRoyaltyRouter(RoyaltyRouter420)`
7. `RoyaltyRouter420.setSettlementSource(LicenseRegistry420,true)`
8. `RoyaltyRouter420.setSettlementSource(StreamingRoyaltySettlement420,true)`
9. `PlaybackAccounting420.setSubmitter(playback_submitter,true)`
10. `StreamingSettlementEpoch420.setSubmitter(settlement_submitter,true)`

The submitter addresses are target-environment operator identities. HZ-AUDIT-3 freezes the roles and grant semantics; it does not invent live operators.

## CreativeProtocolRegistry module inventory

All modules register at version 1 with the retained module-manifest commitment:

1. `CREATIVE_PROTOCOL_REGISTRY` → `CreativeProtocolRegistry420`
2. `CREATOR_PROFILE_REGISTRY` → `CreatorProfileRegistry420`
3. `WORK_REGISTRY` → `WorkRegistry420`
4. `RECORDING_REGISTRY` → `RecordingRegistry420`
5. `CONTRIBUTOR_REGISTRY` → `ContributorRegistry420`
6. `RIGHTS_REGISTRY` → `RightsRegistry420`
7. `AUTHORIZATION_REGISTRY` → `AuthorizationRegistry420`
8. `LICENSE_REGISTRY` → `LicenseRegistry420`
9. `ROYALTY_SCHEDULE_REGISTRY` → `RoyaltyScheduleRegistry420`
10. `ROYALTY_VAULT` → `RoyaltyVault420`
11. `ROYALTY_ROUTER` → `RoyaltyRouter420`
12. `CATALOG_REGISTRY` → `CatalogRegistry420`
13. `CATALOG_METADATA_REGISTRY` → `CatalogMetadataRegistry420`
14. `MEDIA_MANIFEST_REGISTRY` → `MediaManifestRegistry420`
15. `STORAGE_SOURCE_REGISTRY` → `StorageSourceRegistry420`
16. `PLAYBACK_RESOLVER` → `PlaybackResolver420`
17. `PLAYBACK_ACCOUNTING` → `PlaybackAccounting420`
18. `STREAMING_SETTLEMENT_EPOCH` → `StreamingSettlementEpoch420`
19. `STREAMING_REVENUE_ALLOCATOR` → `StreamingRevenueAllocator420`
20. `STREAMING_ROYALTY_SETTLEMENT` → `StreamingRoyaltySettlement420`

The first eleven labels preserve the Decision #10 HZ-1 fixture naming. HZ-AUDIT-3 extends the same explicit naming model to HZ-2 through HZ-4.

## External ProtocolRegistry identity

HZ-AUDIT-3 establishes the first retained external discovery identity because no earlier committed HZ service/component identity existed.

- root implementation: `CreativeProtocolRegistry420`
- component ID preimage: `420/component/hz/creative-protocol-registry/v1`
- component semantic version: `1.0.0`
- component lifecycle: `ACTIVE`
- service ID preimage: `420/service/hz/v1`
- service version: `1`
- service active: `true`
- registration profile component type: `APPLICATION`
- service descriptor commitment: `420/HZ/SERVICE/DESCRIPTOR/V1`
- metadata commitment: `420/HZ/RELEASE/METADATA/V1`
- manifest commitment: `420/HZ/AUDIT-3/REGISTRY-MANIFEST/V1`
- interface commitment: `420/HZ/CREATIVE_PROTOCOL_REGISTRY/INTERFACE/V1`

Because 420Hz is not a frozen Genesis service ID, governance must execute:

1. `ProtocolRegistry.registerComponent(...)`
2. `ProtocolRegistry.approveServiceId(...)`
3. `ProtocolRegistry.publishRegisteredService(...)`

The component and service must resolve to the exact same `CreativeProtocolRegistry420` deployment. The service dependency root commits the ordered 20-module implementation/code-hash inventory.

## Security and authority invariants

- unrelated deployers/operators cannot perform GovernanceTimelock-only wiring;
- playback/settlement submitters cannot be zero;
- submitter grants do not imply governance or Registry authority;
- the HZ extension service cannot publish before explicit governance service-ID approval;
- publication version 1 cannot be replayed as version 1;
- external Registry discovery binds the same root whose internal module inventory is committed;
- no Registry or Indexer projection grants execution authority;
- no local EVM result is promoted to live deployment evidence.

## Live evidence boundary

Live execution evidence remains HZ-AUDIT-7 — Public-testnet deployment.

Until then the retained bundle must keep these fields empty/null:

- network and chain ID;
- live GovernanceTimelock/ProtocolRegistry observations;
- playback and settlement operator addresses;
- HZ deployment addresses and runtime hashes;
- governance/module/Registry transaction receipts;
- live Registry resolution evidence.

## Level 1 exit criteria

HZ-AUDIT-3 is COMPLETE only when one exact implementation SHA passes:

- `scripts/verify-420hz-audit-3-authority.py`;
- affected Solidity format/build;
- `HzRegistryAuthority420Test`;
- the retained HZ-AUDIT-2 focused regression;
- directly applicable canonical Solidity contract CI triggered by the PR shape.

Level 2 is not automatically required for this ordinary step. HZ-AUDIT-3 introduces the first complete cross-HZ authority/discovery convergence, so it is a candidate milestone for a later retained HZ integration run if the audit roadmap adopts one; the ordinary step itself remains Level 1.

Level 3 remains deferred to the single complete 420Hz audit-phase closeout.

## Next canonical roadmap step

**HZ-AUDIT-4 — STREAM economics initialization.**


## Durable qualification evidence

- Roadmap step: `HZ-AUDIT-3 — Registry and authority wiring`
- Status: **COMPLETE**
- Qualification level: **Level 1**
- Qualified implementation SHA: `6711c24f2cdc7c77dd9e1a5227367afba5eeb734`
- Audit branch: `feature/420hz-remediation-20261006`
- Pull request: **#556**
- Qualification merge-base/base SHA: `ff4440bfd7b69c0712ee3dd7c4b417cb049ae76d`
- Current `main` observed at closeout: `ea76c951b683a2b75ad2e64902e6e99c3a0b06ea`
- Current branch/main state at closeout: diverged; branch is 34 commits ahead and 72 commits behind current `main`.
- PR #556 is currently reported non-mergeable against the advanced base. This does not invalidate HZ-AUDIT-3 exact-head qualification; reconciliation is intentionally deferred to the applicable milestone/Level-3 merge-candidate step unless an earlier HZ dependency requires it.

### Level 1 results

Exact-head qualification on `6711c24f2cdc7c77dd9e1a5227367afba5eeb734` completed successfully:

- 420Hz Audit Qualification — run `37572409975`, job `112633753104` (`hz-audit-fast`) — **PASS**
  - exact qualification-head checkout — PASS
  - exact-head verification — PASS
  - HZ-AUDIT-2 deployment-package verifier — PASS
  - HZ-AUDIT-3 authority/Registry verifier — PASS
  - affected Solidity format check — PASS
  - consolidated deployment/authority build — PASS
  - retained `HzDeploymentGraph420Test` regression — PASS
  - focused `HzRegistryAuthority420Test` — PASS
- Solidity Contracts — run `37572410139` — **PASS**
  - PR classification job `112633851559` — PASS
  - PR shard 0 job `112634021352` — PASS
  - PR shard 1 job `112634021284` — PASS
  - PR shard 2 job `112634021377` — PASS
  - PR shard 3 job `112634021302` — PASS
  - monolithic `foundry` job `112633852683` — expected SKIP under PR shard routing
  - `compute-fast` job `112634022308` — expected SKIP as irrelevant to this PR shape
- Supplementary exact-head workflows on the same SHA also passed:
  - Genesis Address Authority `37572409979`
  - 420Docs Qualification `37572409998`
  - 420Registry REG-AUDIT-4 `37572409959`
  - 420Indexer `37572409985`
  - Creative Reference Indexer `37572409954`
  - 420Oracle audit qualification `37572409991`

The supplementary workflows are retained as corroborating evidence only and are not promoted into mandatory ordinary-step exit criteria beyond their actual changed-dependency relevance.

### Exit criteria satisfied

HZ-AUDIT-3 now has durable repository evidence that:

1. the exact GovernanceTimelock-only HZ-1..HZ-4 wiring sequence is retained;
2. playback and settlement submitter grants are explicit, nonzero and fail closed for unauthorized callers;
3. the complete exact 20-module `CreativeProtocolRegistry420` inventory is retained and tested;
4. the canonical HZ external component identity `420/component/hz/creative-protocol-registry/v1` is retained;
5. the canonical HZ external service identity `420/service/hz/v1` is retained;
6. non-Genesis extension-service approval is required before publication;
7. component/service discovery binds the exact `CreativeProtocolRegistry420` root and deterministic module dependency commitment;
8. zero submitters, unauthorized authority mutations, unapproved publication and version replay fail closed;
9. no fixed Genesis HZ address or fabricated live/testnet Registry evidence was introduced;
10. the exact implementation SHA passed the HZ verifier/build/regression/focused-test gate and canonical Solidity PR shards.

### Milestone and phase qualification status

Level 2: **not required for this ordinary roadmap step**. HZ-AUDIT-3 is a meaningful authority/discovery convergence point and remains eligible for a retained app-focused milestone run if the canonical audit later defines one, but no broad ceremonial rerun is required for this closeout.

Level 3: **intentionally deferred** to the single complete 420Hz audit-phase closeout. Current-main reconciliation, the full repository Solidity inventory, canonical Genesis/address-authority closeout, global qualification, Docs/global reconciliation and complete merge-candidate qualification belong there unless an earlier canonical step materially requires them.

Live governance execution, actual submitter operator identities, public-testnet deployed addresses/code hashes, Registry transaction receipts and live resolution evidence remain **HZ-AUDIT-7** obligations and are not claimed complete here.

### Evidence-only closeout rule

This COMPLETE bookkeeping changes documentation/evidence only. It does not modify executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements. Therefore the qualified implementation SHA remains `6711c24f2cdc7c77dd9e1a5227367afba5eeb734`; no recursive substantive test run is required for these evidence-only closeout commits.

## Next canonical roadmap step

**HZ-AUDIT-4 — STREAM economics initialization.**
