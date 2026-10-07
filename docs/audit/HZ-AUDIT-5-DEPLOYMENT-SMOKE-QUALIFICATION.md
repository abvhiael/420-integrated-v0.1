# HZ-AUDIT-5 — Deployment smoke qualification

Status: COMPLETE — Level 1 and post-step Level 2 qualified on exact implementation SHA `a6ffdef933c8086d944b59f492f7208405c0cbf8`.

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


## Durable qualification evidence

- Roadmap step: `HZ-AUDIT-5 — Deployment smoke qualification`
- Status: **COMPLETE**
- Qualification levels: **Level 1 + required post-step Level 2**
- Qualified implementation SHA: `a6ffdef933c8086d944b59f492f7208405c0cbf8`
- Audit branch: `feature/420hz-remediation-20261006`
- Pull request: **#556**
- Qualification merge-base/base SHA: `ff4440bfd7b69c0712ee3dd7c4b417cb049ae76d`
- Current `main` observed at closeout: `c8e8b58d818611276f7a9bb2b8d2241004450d97`
- Current branch/main state at closeout: diverged; branch is 55 commits ahead and 168 commits behind current `main`.
- PR #556 is currently reported non-mergeable against the advanced base. This does not invalidate the exact-head HZ-AUDIT-5 evidence; reconciliation remains a later integration/Level-3 merge-candidate obligation unless HZ-AUDIT-6 materially requires earlier convergence.

### Level 1 exact-head results

420Hz Audit Qualification run `37588125861`, fast job `112682923345` — **PASS**.

The exact implementation SHA passed:

- exact-head checkout and identity verification;
- HZ-AUDIT-2 deployment-package verifier;
- HZ-AUDIT-3 authority/Registry verifier;
- HZ-AUDIT-4 STREAM-economics verifier;
- HZ-AUDIT-5 deployment-smoke verifier;
- affected Solidity format check;
- consolidated deployment graph build;
- retained HZ-AUDIT-2 focused deployment regression;
- retained HZ-AUDIT-3 focused Registry/authority regression;
- retained HZ-AUDIT-4 focused STREAM-economics regression;
- focused `HzDeploymentSmoke420Test`.

Solidity Contracts run `37588125877` — **PASS**:

- classification job `112683151910` — PASS;
- shard 0 `112683467029` — PASS;
- shard 1 `112683467044` — PASS;
- shard 2 `112683467154` — PASS;
- shard 3 `112683467127` — PASS;
- monolithic `foundry` job `112683153505` — expected SKIP under PR shard routing;
- `compute-fast` job `112683468635` — expected SKIP as irrelevant to this PR shape.

Supplementary same-SHA workflows also passed:

- Genesis Address Authority `37588125901`;
- 420Docs Qualification `37588125914`;
- 420Registry REG-AUDIT-4 `37588125865`;
- 420Indexer `37588125908`;
- Creative Reference Indexer `37588125856`;
- 420Oracle audit qualification `37588125964`.

These supplementary workflows are retained as corroborating same-SHA evidence and are not promoted into ceremonial mandatory coverage beyond their actual dependency relevance.

### Level 2 milestone result

420Hz Audit Qualification run `37588125861`, integration job `112687975300` — **PASS**.

This exact-head app-focused Level-2 milestone revalidated the accumulated 420Hz surface after deployment, authority/Registry, STREAM economics and smoke behavior converged:

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

Level 2 remained 420Hz-scoped and did not duplicate the repository-wide Level-3 closeout.

### Exit criteria satisfied

HZ-AUDIT-5 now has durable exact-SHA evidence that:

1. all 20 HZ-1 through HZ-4 contracts materialize with runtime code;
2. canonical governed internal dependency wiring converges on one deployment graph;
3. playback and settlement submitter roles can be established under the expected authority;
4. the complete 20-module CreativeProtocolRegistry inventory can be registered;
5. the external ProtocolRegistry HZ component/service identity resolves the deployed CreativeProtocolRegistry root;
6. canonical ORIGINAL and REMIX STREAM v1 economics register successfully;
7. a CreatorProfile, Work and ORIGINAL Recording can be created and activated through the initialized graph;
8. the activated ORIGINAL Recording retains the expected schedule version and terms;
9. omitted initialization fails closed rather than silently degrading;
10. retained HZ-AUDIT-2/3/4 regressions remain green;
11. the post-step Level-2 retained 420Hz integration suite passes on the same exact implementation SHA;
12. directly applicable Solidity PR qualification passes;
13. no repository/local result is promoted to public-testnet deployment evidence.

### Security / failure-path result

The deployment smoke preserves fail-closed behavior:

- Work activation does not succeed before required rights wiring/finalization;
- ORIGINAL/STREAM/v1 schedule lookup does not succeed before schedule initialization;
- authority and service publication remain explicit rather than permissive;
- no live addresses, receipts, transaction hashes or runtime EXTCODEHASH values are fabricated.

### Deferred checks and limitations

Level 3: **intentionally deferred** to the single complete 420Hz audit-phase closeout.

Public-testnet/live evidence remains **HZ-AUDIT-7**, including:

- production-equivalent network/chain identity;
- deployed HZ addresses;
- deployment transaction receipts;
- live runtime code hashes;
- governed wiring receipts;
- ProtocolRegistry publication receipts;
- STREAM schedule-registration receipts;
- public-testnet smoke transactions.

No such live evidence is claimed by HZ-AUDIT-5.

### Evidence-only closeout rule

This COMPLETE bookkeeping changes documentation/evidence only. It does not modify executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements. Therefore `a6ffdef933c8086d944b59f492f7208405c0cbf8` remains the authoritative qualified implementation SHA and no recursive substantive test rerun is required for these closeout commits.

## Next canonical roadmap step

**HZ-AUDIT-6 — Indexer/reorg/rebuild integration.**
