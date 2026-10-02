# CMP-1.5.12 — Release candidate

Status: **IMPLEMENTED. REPOSITORY-READINESS QUALIFICATION PENDING. LIVE DEPLOYMENT BLOCKED.**

## Canonical definition

> Release candidate

The canonical roadmap supplies only the title. Repository precedent from CMP-1.3.15 and CMP-1.4.11 therefore controls the release-candidate pattern: freeze the accumulated graph, pin runtime/dependency bindings, prepare truthful deployment/publication evidence, reconcile blockers, and never fabricate live addresses, transactions, blocks, runtime hashes, graph hashes or Registry publication.

## Purpose

CMP-1.5.12 packages the repository-qualified ComputeStake graph for release readiness without changing stake economics.

It adds a read-only release wiring checker, hostile release-wiring tests, a machine-readable release manifest, ProtocolRegistry publication requirements, dependency reconciliation, and repository-ready/live-blocked verification.

## Release-candidate graph

`ComputeStakeReleaseCandidateWiring420` pins exact runtime code hashes and canonical bindings for:

- exit policy;
- objective slash policy;
- worker collateral;
- verifier collateral;
- slash authorization;
- slash distribution policy;
- slash distribution executor;
- reward policy;
- reward accounting;
- verifier-dispute stake evidence;
- verifier-dispute slash integration;
- WorkerRegistry stake-admission adapter;
- canonical escrow-derived slash-recipient resolver.

It also pins the common dispute engine and canonical entitlement source used by the dispute/slash-recipient path.

The checker validates worker/verifier collateral policy bindings, slash-authorizer/distribution graph, reward-accounting collateral graph, dispute evidence/integration graph, verifier dispute hold, escrow recipient resolver, and WorkerRegistry stake-source binding.

It grants no custody, stake, exit, slash, reward, settlement, publication, deployment or governance authority.

## Hostile release-wiring tests

`ComputeStakeReleaseCandidateWiring420.t.sol` covers:

- exact accumulated graph acceptance;
- wrong runtime code hash rejection;
- mismatched slash-distribution executor rejection;
- WorkerRegistry/stake-source graph mismatch rejection.

These are release-time graph-drift controls, not new economic semantics.

## Release manifest

`contracts/config/compute-market/cmp-1.5.12-release-candidate.json` inventories the accumulated release graph.

Repository mode deliberately leaves all live evidence null:

- network/chain evidence;
- deployed component addresses;
- deployment transaction hashes;
- deployment blocks;
- runtime code hashes;
- release graph hash;
- canonical live binding addresses;
- governance publication transaction;
- ProtocolRegistry service entries.

The frozen ProtocolRegistry publication path remains:

`0x0000000000000000000000000000000000000434`

via:

`publishRegisteredService`

A live service publication must include implementation, runtime code hash, metadata hash, sequential version, active state, component type, manifest hash, dependency root and interface hash.

## Dependency reconciliation

Repository truth through CMP-1.5.11 establishes the full on-chain ComputeStake repository graph.

It does **not** establish:

- a canonical public testnet deployment;
- deployed ComputeStake addresses;
- live runtime hashes;
- deployment transactions/blocks;
- live release graph bindings;
- live ProtocolRegistry publication.

The release package therefore reports:

- repository ready: **true**;
- live qualified: **false**;
- public testnet available: **false**;
- live deployment: **false**;
- ProtocolRegistry publication complete: **false**.

Validator stake, wallet balance and payer escrow remain forbidden substitutes for canonical compute collateral.

Reward backing remains a separate source from collateral and payer escrow.

No fixed Genesis predeploy is allocated by this phase.

## Qualification model

### Level 1

Required on one exact implementation SHA:

- affected Compute contracts compile;
- hostile release-wiring tests pass;
- repository-ready mechanical verifier passes;
- live mode remains fail-closed;
- retained `Compute*.t.sol` suite remains green because release wiring reads the accumulated graph;
- directly applicable exact-head workflows pass.

### Level 2

No new Level 2 milestone is required.

CMP-1.5.11 immediately preceding this step already qualified the hostile economic integration milestone. CMP-1.5.12 adds release wiring/evidence and does not alter stake execution semantics.

### Level 3

Deferred to **CMP-1.5.13 — Phase closeout**.

## Exit criteria

CMP-1.5.12 is repository-qualified when:

1. the release wiring checker pins the complete accumulated stake graph;
2. hostile release-wiring tests reject runtime/binding drift;
3. the manifest inventories release components and canonical bindings;
4. ProtocolRegistry publication requirements are pinned;
5. all live evidence fields remain truthful/null;
6. CMP-1.5.0 through CMP-1.5.11 repository gates are true;
7. repository-ready verification passes on the exact implementation SHA;
8. live verification remains blocked under current repository truth;
9. all directly applicable exact-head CI passes.

This step does **not** claim live deployment readiness.

Next canonical step:

**CMP-1.5.13 — Phase closeout**
