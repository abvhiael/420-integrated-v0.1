# CMP-1.3.15 — Release-candidate wiring, publication readiness, and dependency reconciliation

Status: **COMPLETE — EXACT EVIDENCE-RECORDING HEAD QUALIFIED. LIVE DEPLOYMENT/PUBLICATION REMAINS BLOCKED.**

## Canonical definition

The controlling roadmap requires CMP-1.3.15 to reconcile the hardened post-1.3.7 WorkerRegistry graph with the deployment/publication package by:

- refreshing canonical wiring and runtime code-hash manifests for all changed components;
- refreshing deployment descriptors and ProtocolRegistry publication requirements;
- reconciling dependency declarations with CMP-1.5 and canonical public-testnet availability;
- exact-head repository qualification;
- preserving truthful fail-closed blockers where live deployment prerequisites do not exist;
- never fabricating addresses, transactions, blocks, runtime hashes, or publication evidence.

Exit: the final WorkerRegistry release candidate is repository-qualified and has a truthful, dependency-aware deployment/publication package.

## Authoritative baseline and gap analysis

Baseline main at step start:

`2a45a2c8847f40b7aa1b27ae4556bf8d547a1f91`

The historical CMP-1.3.7 deployment package remains valid evidence for the graph that existed at that step and is intentionally preserved.

The post-1.3.7 audit found the historical package stale for the hardened release candidate:

1. `cmp-1.3.7-worker-deployment-evidence.json` does not describe the full post-1.3.8–1.3.14 graph.
2. The historical verifier does not require the authorization adapter, capacity reservation component, canonical read model, or the complete capability-consumption chain.
3. The historical wiring contract gained capacity during CMP-1.3.10 but still does not pin the full canonical client/read graph.
4. WorkerRegistry and snapshot code changed substantially after CMP-1.3.7, so historical runtime-hash slots cannot qualify the release candidate.
5. ProtocolRegistry itself now has an explicit Genesis-grade `publishRegisteredService` path whose publication profile includes component type, manifest hash, dependency root, and interface hash.
6. No repository evidence establishes a canonical public testnet deployment or a qualified live CMP-1.5 compute-stake/collateral source. Live addresses, transactions, blocks, runtime hashes, graph hash, bindings, and publication evidence therefore must remain unset.

## Implementation

### Release-candidate wiring

Added:

`contracts/src/compute/ComputeWorkerReleaseCandidateWiring420.sol`

It pins exact runtime code hashes and canonical bindings for:

- ComputeJobRegistry420;
- ComputeJobWorkerSnapshotEvidence420;
- ComputeAuthorization420;
- ComputeWorkerRegistry420;
- ComputeWorkerCapabilityProfile420;
- ComputeWorkerAttestedEligibility420;
- ComputeWorkerCapabilityEligibility420;
- ComputeWorkerAttestation420;
- ComputeWorkerTrust420;
- ComputeWorkerStake420;
- ComputeWorkerCapacityReservation420;
- ComputeWorkerReadModel420.

The wiring verifies authorization identity, provider/node/resource ancestry, profile and attested-eligibility composition, snapshot dependencies, capacity controller ownership, read-model dependencies, governance bindings, chain identity, and exact runtime code hashes.

It grants no authority and performs no publication or deployment action.

### Adversarial wiring qualification

Added:

`contracts/test/ComputeWorkerReleaseCandidateWiring420.t.sol`

Coverage includes:

- exact hardened graph acceptance;
- wrong read-model runtime hash rejection;
- structurally valid but mismatched read-model/capability graph rejection;
- wrong governance rejection.

These checks complement the retained WorkerRegistry, authorization, capability, provenance, capacity, attempt-lifecycle, read-model, and CMP-INV-001–030 suites.

### Release-candidate evidence manifest

Added:

`contracts/config/compute-market/cmp-1.3.15-worker-release-candidate.json`

This is a new release-candidate manifest rather than a rewrite of CMP-1.3.7 history.

It inventories every release component and reserves live evidence fields for:

- deployed address;
- deployment transaction;
- deployment block;
- runtime code hash;
- release graph hash;
- canonical graph bindings;
- network identity;
- governance publication transaction;
- ProtocolRegistry service entries.

All such live fields remain null while deployment prerequisites are absent.

### Mechanical readiness verifier

Added:

`scripts/verify-cmp-1-3-15-release-candidate.py`

Repository-ready mode verifies:

- the historical CMP-1.3.7 evidence file still exists;
- all hardened release roles are present in canonical order;
- every source exists;
- no live deployment evidence has been fabricated;
- the complete binding inventory exists and remains unset pre-deployment;
- frozen ProtocolRegistry address `0x0000000000000000000000000000000000000434`;
- canonical `publishRegisteredService` publication API;
- post-1.3.7 prerequisite gates CMP-1.3.8 through CMP-1.3.14;
- CMP-1.5 remains the required compute-collateral authority for stake-required live admission;
- validator stake, wallet balance, and payer escrow are not substituted for compute collateral;
- no fixed Genesis predeploy is allocated;
- ProtocolRegistry remains the discovery path;
- public-testnet and live CMP-1.5 gates remain fail-closed.

Default/live mode intentionally fails until real canonical-chain evidence exists.

### CI integration

420Docs Qualification is updated so the CMP-1.3.15 repository-readiness verifier runs on relevant pull requests and main pushes.

## ProtocolRegistry publication readiness

A release publication is valid only after real deployment evidence exists and the authorized governance publisher uses:

`ProtocolRegistry.publishRegisteredService`

For each published release service, the durable evidence must include the implementation, runtime code hash, metadata hash, sequential version, active state, component type, manifest hash, dependency root, and interface hash. Extension service IDs must first be governance-approved through the Registry's extension-ID path.

Registry publication is discovery/version authority only. It grants no worker mutation, execution, custody, settlement, verifier, stake, slash, governance, bridge, validator, or arbitrary-wallet authority.

## Dependency reconciliation

### CMP-1.5

CMP-1.3.5 deliberately binds stake-required worker admission to a future canonical CMP-1.5 compute-collateral source.

Current release-candidate state therefore remains:

- CMP-1.5 live compute-stake source qualified: **false**;
- stake-required production admission: **fail closed**;
- validator stake substitution: **forbidden**;
- wallet-balance substitution: **forbidden**;
- payer-escrow substitution: **forbidden**.

The repository-qualified WorkerRegistry release candidate can exist without claiming live stake-required admission.

### Public testnet

Repository evidence does not establish an available canonical public testnet for this release package.

Therefore:

- public testnet available: **false**;
- live deployment qualified: **false**;
- ProtocolRegistry publication complete: **false**;
- live addresses/transactions/blocks/runtime hashes: **null**.

These are truthful deployment blockers, not repository-qualification failures.

## Security and invariant conclusions

CMP-1.3.15 adds no custody, matching, verification, settlement, stake movement, slashing, governance, validator, bridge, or wallet authority.

The refreshed package preserves the CMP-1.3.14 invariant evidence and specifically prevents release-time graph drift in the authorization, capability, provenance, stake-reference, capacity, accepted-attempt, and public read-model paths.

## Qualification gate

Before this document may be changed to COMPLETE, the exact final reconciled HEAD must pass all relevant triggered workflows and retained qualification, including at minimum:

- Solidity Contracts, including every required PR shard;
- 420 Integrated Qualification;
- 420Docs Qualification, including the CMP-1.3.14 invariant verifier, historical CMP-1.3.7 repository verifier, and new CMP-1.3.15 release-candidate verifier;
- 420Indexer if triggered;
- any other required workflow triggered by the changed files.

Skipped aggregate wrappers are acceptable only where workflow design intentionally skips them and all required underlying shards pass.

Per the repository owner's explicit CMP-1.3.15 instruction, if durable evidence recording creates a new commit, the retained qualification suite must be rerun on that new exact evidence-recording HEAD.

## Pre-evidence exact-head qualification evidence

The implementation head immediately preceding this durable evidence update was:

`979532ca792b3e57c909cb889aa08e1e3cbc236c`

It was reconciled with then-current `main` `2a45a2c8847f40b7aa1b27ae4556bf8d547a1f91` (ahead 7, behind 0) and passed the complete set of workflows triggered for that PR head:

- Solidity Contracts #3354 — run `36655684432` — **success**; all 16 required `pr-shards` passed. The aggregate `foundry` wrapper was intentionally skipped by PR workflow design.
- Genesis Address Authority #191 — run `36655684467` — **success**; `cross-manifest-authority` and all 16 `full-foundry-pr-inventory` shards passed.
- 420 Integrated Qualification #5991 — run `36655684409` — **success**; `fault-matrix`, `geth-engine`, `production-dependencies`, and `offline-core` passed.
- 420Docs Qualification #3367 — run `36655684490` — **success**, including the retained invariant/readiness checks and CMP-1.3.15 repository-readiness verifier.
- 420Indexer #974 — run `36655684502` — **success**.
- EXP-1.9 CI Qualification Automation #86 — run `36655684406` — **success**.
- EXP-1.10 Phase Closeout Qualification #92 — run `36655684410` — **success**.

This evidence proves the implementation state at `979532ca792b3e57c909cb889aa08e1e3cbc236c`. It is not inherited as final qualification for the evidence-recording commit. Per the repository owner's explicit exact-SHA rule, the workflows required by the PR after this evidence update must complete successfully on the new evidence-recording HEAD before CMP-1.3.15 can be marked COMPLETE.

## Evidence-recording-head qualification

The evidence-recording head `8653e105661c15ef66ad2236c467d0e63994cd1c` subsequently passed the complete required workflow set:

- Solidity Contracts #3360 — run `36662815029` — **SUCCESS**, all 16 required PR shards passed; aggregate `foundry` wrapper intentionally skipped by PR workflow design;
- Genesis Address Authority #197 — run `36662815001` — **SUCCESS**, cross-manifest authority plus all 16 full-foundry inventory shards passed;
- 420 Integrated Qualification #5997 — run `36662815016` — **SUCCESS**, all four jobs passed;
- 420Docs Qualification #3373 — run `36662815011` — **SUCCESS**;
- 420Indexer #980 — run `36662815010` — **SUCCESS**;
- EXP-1.9 CI Qualification Automation #87 — run `36662815024` — **SUCCESS**;
- EXP-1.10 Phase Closeout Qualification #93 — run `36662815032` — **SUCCESS**.

PR #408 merged that exact qualified head into `main` at merge commit `5a2a273d8d6e0d9ab3428aab80ba0212f7bbb1bc`.

## Completion

**COMPLETE.** The final CMP-1.3.15 evidence-recording head `8653e105661c15ef66ad2236c467d0e63994cd1c` passed every required exact-head workflow before merge. Repository qualification is complete; live deployment/publication remains truthfully blocked until its external prerequisites exist.
