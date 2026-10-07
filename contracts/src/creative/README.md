# 420 Creative Protocol — Solidity Kernel V1

This package implements the first Decision #10 kernel for the 420 Creative Protocol and the music-specific 420Hz layer.

## Dependency order

1. `shared/CreativeTypes420.sol`, `CreativeErrors420.sol`, `CreativeEvents420.sol`
2. `core/CreativeProtocolRegistry420.sol`
3. `core/CreatorProfileRegistry420.sol`
4. `music/WorkRegistry420.sol`
5. `music/RecordingRegistry420.sol`
6. `rights/ContributorRegistry420.sol`
7. `rights/RightsRegistry420.sol`
8. `rights/AuthorizationRegistry420.sol`
9. `rights/LicenseRegistry420.sol`
10. `economics/RoyaltyScheduleRegistry420.sol`
11. `economics/RoyaltyVault420.sol`
12. `economics/RoyaltyRouter420.sol`

## Kernel invariants implemented

- Work, Recording and Creator IDs are stable typed protocol IDs.
- Work and Recording economic rights are independent 10,000-bp pools.
- Initial splits require every proposed holder to accept before finalization.
- Post-finalization changes occur through explicit propose/accept transfers.
- Rights transfers checkpoint royalty accounting before share mutation so accrued balances do not move with sold rights.
- Authorization policies are immutable by version; derivative activation revalidates Work/source permissions or an issued license.
- AI transformation permissions remain distinct from training permissions.
- Royalty schedules must sum to exactly 10,000 bps and protocol fee is capped at 500 bps by the registry.
- Royalty routing is one-hop: a derivative source bucket credits the immediate source Recording rights pool directly and never recursively runs the source Recording's schedule.
- Holder-level royalty deposits are O(1) using a cumulative-per-basis-point accumulator (`ACC_SCALE = 1e27`).
- Top-level integer remainder goes to the current Recording bucket; protocol never receives rounding dust.
- Settlement IDs are replay protected.
- Native 420 is the V1 settlement asset; payment-asset generalization is deliberately deferred behind the existing 420Pay/canonical-asset layer.

## Decision #10 deterministic deployment / seed fixture

`script/Decision10DeploySeed420.s.sol` deploys the complete kernel in the dependency order above and produces a deterministic reference history for indexer and client integration.

The fixture uses intentionally public, test-only private keys for a deployer plus Alice, Bob, Carol, Producer and Remixer. These accounts must never hold production value. The script:

1. deploys and wires every kernel contract;
2. registers every kernel module in `CreativeProtocolRegistry420` at version 1;
3. creates deterministic CreatorProfiles;
4. registers the V1 ORIGINAL direct-sale, ORIGINAL remix-license and REMIX direct-sale schedules;
5. publishes a Work split Alice 60% / Bob 40%;
6. publishes an original Recording split Alice 70% / Producer 30%;
7. records accepted contributor credits;
8. settles a 100-native-420 original sale (`100 ether` at 18 decimals);
9. issues a paid 20-native-420 remix license to Remixer;
10. publishes a Remix split Remixer 80% / Carol 20%;
11. settles a 100-native-420 remix sale with the one-hop 15% immediate-source bucket;
12. transfers 1,000 bps of the original Recording from Alice to Carol, preserving pre-transfer accrual through checkpointing;
13. settles another 40-native-420 original sale under the new rights version;
14. asserts exact pools, holder balances, rights versions and gross conservation; and
15. writes `artifacts/contracts/creative-kernel-v1.fixture.json` using schema `config/creative-kernel-v1.fixture.schema.json`.

Run from `contracts/`:

```sh
mkdir -p ../artifacts/contracts
forge script script/Decision10DeploySeed420.s.sol:Decision10DeploySeed420 --sig "run()" -vvv
```

The generated manifest contains public accounts, deployed contract addresses, Creator/Work/Recording/License/transfer IDs, contributor-credit IDs, settlement IDs, version numbers and expected economic state. It deliberately excludes all private keys. CI executes the same harness, validates the critical fixture fields and uploads the JSON as the `creative-kernel-v1-fixture` artifact.

## 420Hz layers above the HZ-1 kernel

Current repository layers above Decision #10 are:

- HZ-2 catalog/presentation: creator-authorized releases, ordered active-recording tracklists, versioned content-addressed presentation metadata, and rebuildable public catalog/discovery projections.
- HZ-3 media/playback: immutable media-manifest revisions, provider-neutral storage replicas, deterministic playback resolution, and replay-protected aggregate playback accounting.
- HZ-4 settlement: governance-controlled settlement epochs, deterministic per-recording streaming allocation, exact-value STREAM royalty routing through the existing RoyaltyRouter420/RoyaltyVault420 stack, and a rebuildable streaming-settlement projection.

HZ-4 deliberately does not create a second royalty system. StreamingRoyaltySettlement420 must be explicitly allowlisted by RoyaltyRouter420 governance.

HZ-AUDIT-4 STREAM economics retain version-1 `RevenueType.STREAM` schedules only for the RecordingClass values with canonical kernel split terms: ORIGINAL (12.5% Work / 0% Source / 85% Current Recording / 2.5% Protocol) and REMIX (10% Work / 15% immediate Source / 72.5% Current Recording / 2.5% Protocol). Both schedules use deterministic `effectiveAt = 0` and full-field terms-hash commitments. Other RecordingClass values intentionally have no STREAM schedule until explicit canonical economics are adopted.

The Decision #10 deploy/seed script remains an HZ-1 development/reference harness; it is not a production deployment manifest for HZ-2/HZ-3/HZ-4. The consolidated HZ-AUDIT-2 deployment graph/package and HZ-AUDIT-3 authority/Registry bundle are the retained repository-side production architecture records.

## Deliberately deferred

The repository does not currently define later production layers for disputes, AI Studio/provider execution, Awards, extended creator/fan economy, DDEX/interop adapters, archival operators, or full governance migration. Public-testnet promotion must execute the retained consolidated deployment and authority/Registry bundles in an approved environment, select nonzero playback/settlement operator identities, retain governance and Registry transaction/receipt evidence, verify deployed runtime identities, and complete the later live qualification steps. Repository fixtures and local EVM qualification are not live evidence.
