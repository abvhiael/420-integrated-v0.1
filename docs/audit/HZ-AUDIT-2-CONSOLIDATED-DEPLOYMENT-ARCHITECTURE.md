# HZ-AUDIT-2 — Consolidated deployment architecture

Status: IMPLEMENTED — Level 1 qualification required on the exact implementation head.

## Canonical purpose

HZ-AUDIT-2 closes the repository-side deployment-architecture gap identified by the 420Hz repository audit. It does not perform a live testnet deployment and does not promote 420Hz into the frozen Genesis application catalogue.

The step must provide one deterministic deployment model covering every on-chain HZ-1 through HZ-4 component, preserve immutable GovernanceTimelock authority, make post-deployment governance actions explicit, emit a machine-readable address manifest, and retain fail-closed evidence that local/synthetic deployment is not live qualification.

## Retained implementation

- contracts/src/creative/deployment/HzDeploymentGraph420.sol
  - canonical 20-contract HZ-1..HZ-4 constructor graph;
  - requires nonzero GovernanceTimelock and protocol treasury;
  - contains no owner/bootstrap backdoor and performs no governance impersonation.
- contracts/script/HzConsolidatedDeploy420.s.sol
  - deploys the graph from runtime HZ_GOVERNANCE_TIMELOCK and HZ_PROTOCOL_TREASURY inputs;
  - writes artifacts/contracts/420hz-deployment.json with schema 420.hz.deployment.v1;
  - never serializes private keys or claims live Registry state.
- contracts/config/creative/420hz-deployment-package.json
  - exact deployment order;
  - exact governance-only internal wiring actions;
  - explicit HZ-AUDIT-3 authority/Registry handoff;
  - explicit HZ-AUDIT-4 STREAM-economics handoff;
  - deliberately empty live deployment evidence.
- contracts/test/HzDeploymentGraph420.t.sol
  - complete constructor/dependency binding checks;
  - governance binding checks;
  - authority-only initialization checks;
  - RoyaltyRouter settlement-source wiring checks;
  - playback/settlement submitter wiring checks;
  - zero-governance and zero-treasury fail-closed checks.
- scripts/verify-420hz-audit-2-deployment.py
  - validates exact inventory/order and source materialization;
  - rejects fabricated live network/address/transaction evidence;
  - enforces later-step ownership boundaries.
- .github/workflows/420hz-audit.yml
  - exact-head Level-1 workflow;
  - verifier, affected Solidity format/build and focused deployment tests only.

## Deployment order

1. CreativeProtocolRegistry420
2. CreatorProfileRegistry420
3. WorkRegistry420
4. RecordingRegistry420
5. ContributorRegistry420
6. RightsRegistry420
7. AuthorizationRegistry420
8. LicenseRegistry420
9. RoyaltyScheduleRegistry420
10. RoyaltyVault420
11. RoyaltyRouter420
12. CatalogRegistry420
13. CatalogMetadataRegistry420
14. MediaManifestRegistry420
15. StorageSourceRegistry420
16. PlaybackResolver420
17. PlaybackAccounting420
18. StreamingSettlementEpoch420
19. StreamingRevenueAllocator420
20. StreamingRoyaltySettlement420

## Governance initialization boundary

The deployment transaction set only creates contracts with their immutable constructor bindings. The following state changes must be executed by the configured GovernanceTimelock after deployment:

1. WorkRegistry420.setRightsRegistry(RightsRegistry420)
2. RecordingRegistry420.configureDependencies(RightsRegistry420, AuthorizationRegistry420)
3. RightsRegistry420.setRoyaltyAccounting(RoyaltyVault420)
4. AuthorizationRegistry420.setLicenseRegistry(LicenseRegistry420)
5. LicenseRegistry420.setRoyaltyRouter(RoyaltyRouter420)
6. RoyaltyVault420.setRoyaltyRouter(RoyaltyRouter420)
7. RoyaltyRouter420.setSettlementSource(LicenseRegistry420, true)
8. RoyaltyRouter420.setSettlementSource(StreamingRoyaltySettlement420, true)

This separation is intentional. A deployer that is not GovernanceTimelock must not gain an initialization bypass.

## Explicit later-step ownership

HZ-AUDIT-3 owns authority and canonical discovery wiring:
- playback submitter grant;
- streaming-settlement submitter grant;
- CreativeProtocolRegistry module registrations;
- external ProtocolRegistry component/service publication and authority verification.

HZ-AUDIT-4 owns STREAM economics initialization:
- supported RecordingClass coverage;
- RevenueType.STREAM schedule splits;
- version/effective-at/terms-hash commitments.

No values for those later decisions are invented in HZ-AUDIT-2.

## Manifest and live-evidence rules

The generated deployment manifest is a deployment output, not proof of a public-testnet deployment. Repository-retained configuration therefore leaves network, chain ID, addresses, code hashes and transaction evidence empty/null until an approved live environment exists.

No fixed HZ addresses are introduced. 420Hz remains a first-year flagship application using a Registry-resolved deployment model rather than a frozen Genesis predeploy map.

## Level 1 exit criteria

HZ-AUDIT-2 is COMPLETE only when one exact implementation SHA passes:

- the 420Hz deployment-package verifier;
- Solidity format/build for the affected deployment graph/script/test;
- HzDeploymentGraph420Test;
- directly-triggered canonical contract CI required by the repository's PR classification.

Broad Level-2 retained application integration and all Level-3 repository-wide closeout suites are intentionally deferred. Live deployment, Registry publication and STREAM schedule initialization are not HZ-AUDIT-2 exit criteria.
