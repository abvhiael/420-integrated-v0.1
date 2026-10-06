# CMP-5.1 — Folding@home adapter

Status: **COMPLETE — Level 1 exact-head qualified on `aa8ebaeb243946b679766fb6d023f39acec42dc2`.**

Canonical roadmap step: **CMP-5.1 — Folding@home adapter**.

## Purpose

CMP-5.1 defines the first external distributed-compute adapter. It converts externally supplied Folding@home contribution material into stable 420Integrated commitments without forcing Folding@home workloads to be re-executed as native CMP jobs.

The adapter is intentionally **non-authoritative**. Repository code cannot assume a caller-supplied Folding@home record is true merely because it is well formed.

## Canonical normalized record

`ComputeFoldingAtHomeAdapter420.FoldingRecord` binds:

- Folding@home project number;
- committed external work-unit identity;
- donor identity commitment;
- optional team identity commitment;
- assignment commitment;
- result commitment;
- assignment/completion timestamps;
- credited points;
- external evidence commitment.

Raw usernames, team names, API credentials, work-unit bytes, scientific outputs and external service credentials are not stored by this adapter.

## Contribution identity

`contributionId` is domain-separated and binds the external system, project number, work-unit commitment, donor identity and assignment commitment.

Result metadata, team membership, timestamps and points do not redefine that identity. They are instead bound by the full normalized record commitment.

This split allows later CMP-5.6 duplicate/reward controls to reason about one stable contribution identity without treating mutable display/accounting observations as a new contribution.

## Record commitment

`recordCommitment` binds the protocol commitment, contribution identity, result, optional team, timestamps, points and exact external evidence commitment.

The contract rejects:

- project number zero;
- missing work-unit, donor, assignment, result or evidence commitments;
- zero assignment time;
- completion before assignment;
- zero credited points.

Team identity is optional because team participation is not a prerequisite to a valid external donor contribution, but if present it is cryptographically bound.

## Authority boundaries

CMP-5.1 does **not**:

- query or authenticate Folding@home servers;
- assert that a Folding@home work unit was accepted by the external system;
- decide scientific correctness;
- create a canonical CMP verification verdict;
- reserve, release, settle or refund Vault funds;
- create reward entitlement;
- slash stake;
- prevent replay/double reward across observations;
- grant governance, wallet, validator, bridge or scheduler authority.

**CMP-5.7 — External-result attestation** owns trusted external-result truth.  
**CMP-5.6 — Double-reward prevention** owns deduplication/economic replay protection.  
**CMP-6** owns useful-computation reward economics.

## Security and failure behavior

The adapter is stateless and pure. Malformed records revert before producing commitments. Domain separation prevents accidental reuse of these commitments as unrelated CMP objects.

A commitment produced by this adapter is evidence of deterministic normalization only. It is never evidence that Folding@home, a university, a project owner or a 420 verifier has attested the record.

## Qualification

CMP-5.1 is an ordinary **Level 1** roadmap step.

Required exact-head qualification:

- affected Compute contracts compile;
- dedicated `ComputeFoldingAtHomeAdapter420.t.sol` tests pass;
- retained Compute Market Solidity regressions pass;
- verification scripts compile;
- CMP-5.1 mechanical verifier passes;
- exact-head Compute Market Qualification passes.

No Level 2 milestone is required at CMP-5.1. Level 2 is deferred until multiple external adapter families converge. Repository-wide Level 3 remains reserved for **CMP-5.8**.

## Intentionally deferred

- CMP-5.2 BOINC adapter;
- CMP-5.3 research-cluster adapter;
- CMP-5.4 University/HPC gateway;
- CMP-5.5 external proof/credit adapters;
- CMP-5.6 double-reward prevention;
- CMP-5.7 external-result attestation;
- live Folding@home endpoint/API integration or administrative permission;
- CMP-6 reward economics;
- CMP-5.8 Level 3 closeout.

## Exit criteria

CMP-5.1 is complete when one exact implementation SHA proves the implementation/configuration above, the dedicated negative/boundary tests, mechanical verifier and Compute Market Level 1 workflow all pass.

## Qualification evidence

Compute Market Qualification **#443** / run `37515056292` / job `112445946047` passed on exact implementation SHA `aa8ebaeb243946b679766fb6d023f39acec42dc2`, including exact-head verification, affected Compute contract build, retained `Compute*.t.sol` regressions, verifier-script compilation and the CMP-5.1 mechanical verifier.

Durable evidence: [CMP-5.1 qualification](CMP-5.1-QUALIFICATION-EVIDENCE.md).

## Next canonical step

**CMP-5.2 — BOINC adapter**
