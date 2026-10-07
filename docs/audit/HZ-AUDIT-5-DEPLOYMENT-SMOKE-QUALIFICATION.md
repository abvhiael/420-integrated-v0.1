# HZ-AUDIT-5 — Deployment smoke qualification

Status: IMPLEMENTED — Level 1 and post-step Level 2 qualification required on the exact implementation head.

## Canonical purpose

HZ-AUDIT-5 is the repository-local convergence smoke for the deployment architecture and initialization work completed in HZ-AUDIT-2 through HZ-AUDIT-4.

The step preserves the existing roadmap name **Deployment smoke qualification**. The repository does not define a narrower competing interpretation, so this step qualifies the minimum complete local deployment path implied by the retained handoffs:

1. materialize the complete 20-contract HZ-1 through HZ-4 constructor graph;
2. apply canonical GovernanceTimelock-only authority wiring;
3. grant the playback and settlement submitter roles;
4. register the exact 20-module CreativeProtocolRegistry420 inventory;
5. publish the canonical HZ component/service identity through ProtocolRegistry;
6. register the HZ-AUDIT-4 ORIGINAL and REMIX STREAM v1 schedules;
7. prove the initialized graph can create and activate a real CreatorProfile, Work and ORIGINAL Recording;
8. prove required initialization fails closed when omitted;
9. retain public-testnet/live evidence for HZ-AUDIT-7 rather than fabricating it locally.

This is a repository/local-EVM smoke step. It is not a public-testnet deployment claim.

## Retained implementation

- `contracts/test/HzDeploymentSmoke420.t.sol`
  - deploys all 20 HZ contracts through `HzDeploymentGraph420`;
  - applies the exact HZ-AUDIT-3 governed wiring;
  - registers all 20 internal module identities;
  - publishes the canonical external HZ component/service identity;
  - registers the exact HZ-AUDIT-4 ORIGINAL and REMIX STREAM v1 schedules;
  - asserts runtime code materialization for every deployed HZ contract;
  - asserts authority, submitter, Router-source and Registry resolution state;
  - creates one CreatorProfile;
  - creates, finalizes rights for and activates one Work;
  - creates, finalizes rights for and activates one ORIGINAL Recording using royalty schedule version 1;
  - verifies the activated Recording retains the expected STREAM schedule version/terms;
  - verifies Work activation and STREAM schedule reads fail closed before required initialization.

- `contracts/config/creative/420hz-deployment-smoke-bundle.json`
  - records exact convergence requirements;
  - records the local-only runtime input policy;
  - records state assertions and failure paths;
  - defines the post-HZ-AUDIT-5 Level-2 boundary;
  - keeps every live/testnet field empty/null.

- `scripts/verify-420hz-audit-5-deployment-smoke.py`
  - validates bundle/schema ownership;
  - validates smoke coverage markers;
  - validates the retained deployment, authority/Registry and STREAM-economics dependencies;
  - validates the Level-2 milestone boundary;
  - rejects fabricated live evidence.

- `.github/workflows/420hz-audit.yml`
  - adds the HZ-AUDIT-5 verifier and focused smoke test to the exact-head Level-1 job;
  - retains HZ-AUDIT-2/3/4 regressions;
  - adds a separate exact-head **Level-2 app-focused integration job** covering the retained HZ kernel, catalog, media, playback, streaming settlement/allocation/routing and HZ-AUDIT-2 through HZ-AUDIT-5 suites.

## Local smoke sequence

The positive smoke path executes against one locally materialized graph:

`HzDeploymentGraph420.deploy`

→ canonical governance wiring

→ complete CreativeProtocolRegistry module registration

→ ProtocolRegistry component registration/service approval/publication

→ ORIGINAL + REMIX STREAM v1 schedule registration

→ CreatorProfile creation

→ Work registration

→ Work rights finalization

→ Work activation

→ ORIGINAL Recording registration with `royaltyScheduleVersion = 1`

→ Recording rights finalization

→ Recording activation

→ Registry/schedule/state assertions.

This validates that the separate repository-qualified phases converge without requiring a second deployment system or local impersonation of public-testnet evidence.

## Failure-path smoke

The retained negative smoke proves that a fresh constructor graph does **not** silently behave as initialized:

- Work activation fails before rights Registry wiring/finalization;
- ORIGINAL/STREAM/v1 lookup fails before HZ-AUDIT-4 schedule registration.

The smoke does not weaken authorization or insert permissive fallbacks merely to make deployment appear healthy.

## Level 1 exit criteria

HZ-AUDIT-5 requires one exact implementation SHA to pass:

- `scripts/verify-420hz-audit-5-deployment-smoke.py`;
- affected Solidity format/build;
- retained HZ-AUDIT-2 deployment regression;
- retained HZ-AUDIT-3 authority/Registry regression;
- retained HZ-AUDIT-4 STREAM economics regression;
- focused `HzDeploymentSmoke420Test`;
- directly applicable Solidity PR qualification.

## Level 2 milestone

HZ-AUDIT-4 identified the post-HZ-AUDIT-5 boundary as the meaningful app integration milestone because deployment, authority/Registry, STREAM economics and smoke behavior have then converged.

Therefore HZ-AUDIT-5 also requires the retained exact-head app-focused Level-2 suite:

- Creative kernel;
- Creative kernel acceptance;
- Catalog registry;
- Catalog metadata registry;
- Media manifest registry;
- Storage source registry;
- Playback resolver;
- Playback accounting;
- Streaming settlement epoch;
- Streaming revenue allocator;
- Streaming royalty settlement;
- HZ deployment graph;
- HZ Registry/authority;
- HZ STREAM economics;
- HZ deployment smoke.

This Level-2 job remains 420Hz-specific. It is not the repository-wide Level-3 closeout.

## Live evidence boundary

Public-testnet execution remains HZ-AUDIT-7. HZ-AUDIT-5 must not claim:

- public network or chain ID;
- deployment transaction hashes;
- deployed production-equivalent addresses;
- runtime EXTCODEHASH evidence;
- governance transaction receipts;
- Registry publication receipts;
- STREAM schedule-registration receipts;
- public-testnet smoke transaction receipts.

All such retained fields remain empty/null in the HZ-AUDIT-5 bundle.

## Level 3 status

Level 3 remains intentionally deferred to the single complete 420Hz audit-phase closeout.

## Next canonical roadmap step

**HZ-AUDIT-6 — Indexer/reorg/rebuild integration.**
