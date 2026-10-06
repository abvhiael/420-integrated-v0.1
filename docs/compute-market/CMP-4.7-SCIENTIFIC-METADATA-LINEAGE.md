# CMP-4.7 — Scientific metadata and lineage

Status: **CLOSEOUT CANDIDATE — LEVEL 1 EXACT-HEAD QUALIFICATION PENDING.**

Canonical roadmap step: **CMP-4.7 — Scientific metadata and lineage**.

CMP-4.7 attaches project-authenticated, versioned scientific metadata commitments to already-canonical CMP-4.6 result provenance and creates explicit parent-provenance edges for derived scientific results.

It does not create a second job, result, dataset, verification, publication, access-control, payment or correctness authority.

## Canonical metadata model

A metadata record binds:

- exact CMP-4.6 provenance ID;
- exact CMP-4.1 scientific work-unit commitment;
- project-authorized publisher;
- nonzero metadata-schema commitment;
- nonzero metadata-content commitment;
- optional lineage-relation commitment;
- canonical ordered parent-provenance set commitment;
- parent count and record timestamp.

Raw metadata, papers, notes, labels, personally identifying research data, dataset bytes, credentials, mutable URLs and secrets remain off-chain. Canonical state stores commitments and provenance references only.

## Publisher authority

Metadata is canonical only when published by the owner of the exact historical CMP-4.2 project revision embedded in the scientific work-unit commitment.

The caller supplies the project/revision and the four CMP-4.1 binding witnesses not recoverable from CMP-4.6 alone. The registry:

1. resolves the exact historical project commitment and owner from CMP-4.2;
2. resolves the child CMP-4.6 provenance and canonical result-source context;
3. reconstructs the CMP-4.1 scientific work-unit commitment;
4. requires the reconstruction to equal the commitment frozen in CMP-4.6;
5. requires the caller to equal the exact historical project owner.

This prevents arbitrary actors from front-running a canonical metadata slot.

## Lineage semantics

A root result has no parents and therefore must use a zero relation commitment.

A derived result:

- requires 1–32 parent provenance IDs;
- requires a nonzero relation commitment describing the committed derivation semantics;
- requires every parent provenance to remain canonical;
- requires every parent to already have a CMP-4.7 lineage record;
- requires parents to be strictly sorted and unique;
- rejects self-parenting.

The parent-first registration rule creates an append-only topological order, so cycles cannot be introduced through later records.

Cross-project derivation is permitted when the child project's authorized publisher references already-canonical parent provenance. CMP-4.7 records the relationship; it does not grant access to parent datasets or outputs.

## Canonicality and drift

`isCanonical(lineageId)` requires:

- the child CMP-4.6 provenance to remain canonical;
- the lineage record to remain the unique record for that provenance;
- every direct parent provenance to remain canonical;
- every direct parent to retain an existing lineage record.

It does not re-run result verification or recursively reinterpret scientific truth.

## Security boundaries

Fail closed on:

- zero/unknown provenance;
- noncanonical child or parent provenance;
- outsider metadata publication;
- substituted project revision/commitment;
- altered scientific-unit witness fields;
- zero metadata schema/content commitment;
- more than 32 parents;
- zero, duplicate, unsorted or self parent IDs;
- missing parent lineage records;
- relation commitment on a root or missing relation on a derived result;
- conflicting second metadata/lineage record for one provenance;
- canonical source drift.

The record grants no dataset access, publication right, verification outcome, settlement, reward, slash, governance, worker or verifier authority.

## Qualification model

CMP-4.7 is an ordinary **Level 1** step.

CMP-4.6 already established and passed the first CMP-4 Level 2 convergence milestone across scientific units, result/receipt evidence and verifier state. CMP-4.7 adds a project-authorized metadata/lineage overlay without introducing a new shared authority or cross-service lifecycle requiring another Level 2 milestone.

Required on one exact SHA:

- affected Compute contracts compile;
- dedicated `ComputeScientificMetadataLineage420.t.sol` tests pass;
- retained CMP-4.1–CMP-4.6 compatibility verifiers pass;
- CMP-4.7 mechanical verifier passes;
- exact-head Compute Market Qualification passes.

Level 2 is not required again at CMP-4.7. Level 3 remains CMP-4.10.

## Intentionally deferred

- publication / retention policy — CMP-4.8;
- research dashboard — CMP-4.9;
- comprehensive Level 3 scientific-framework closeout — CMP-4.10;
- SDK/API/indexer expansion — CMP-7;
- Compute UI — CMP-8;
- live scientific workload demonstration — CMP-9.13.

## Next canonical step

**CMP-4.8 — Publication / retention policy**
