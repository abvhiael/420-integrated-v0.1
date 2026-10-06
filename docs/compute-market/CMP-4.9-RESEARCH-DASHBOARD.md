# CMP-4.9 — Research dashboard

Status: **CLOSEOUT CANDIDATE — LEVEL 1 + SECOND CMP-4 LEVEL 2 EXACT-HEAD QUALIFICATION PENDING.**

Canonical roadmap step: **CMP-4.9 — Research dashboard**.

CMP-4.9 provides a versioned, read-only canonical consumption surface for the scientific research graph accumulated in CMP-4.2 through CMP-4.8.

It is a dashboard **read model**, not the CMP-8 human-facing 420Compute application.

## Canonical components

`ComputeResearchDashboard420` binds one exact component graph:

- CMP-4.2 `ComputeResearchProjectRegistry420`;
- CMP-4.6 `ComputeScientificResultProvenance420`;
- the canonical CMP-4.6 result-source adapter;
- CMP-4.7 `ComputeScientificMetadataLineage420`;
- CMP-4.8 `ComputeScientificPublicationRetention420`.

Construction fails closed if system identity/version is wrong or if the lineage/publication graph is wired to different project, provenance, result-source or lineage contracts.

## Project views

The dashboard exposes:

- current project state and exact current project commitment;
- exact historical project revision and commitment.

The view preserves owner, research domain, definition commitment, revision, new-work admission state and project status without creating a parallel project registry.

## Scientific result view

A research-result query binds:

- exact CMP-4.7 lineage ID;
- project ID and historical project revision;
- exact CMP-4.2 research-project commitment;
- executable-environment commitment;
- parameters commitment;
- resource class.

The dashboard then reconstructs the CMP-4.1 scientific work-unit commitment from the canonical CMP-4.6 result context and the supplied frozen witness fields.

The query fails closed unless:

- the project revision resolves to the exact supplied project commitment;
- reconstructed CMP-4.1 commitment equals both CMP-4.6 provenance and CMP-4.7 lineage commitments;
- canonical result-source unit/result/evidence/output/verifier fields agree with provenance;
- verification is recorded;
- CMP-4.6 provenance is canonical;
- CMP-4.7 lineage is canonical.

The resulting view exposes bounded commitments and identities for:

- job/unit;
- scientific work unit;
- result and execution evidence;
- worker and verifier;
- output schema;
- metadata schema/content;
- lineage parent-set/count;
- current CMP-4.8 policy identity/commitment/revision/visibility/timing;
- explicit current-policy and publication-authorization booleans.

No raw research bytes are surfaced.

## Missing policy semantics

A canonical CMP-4.7 result may not yet have a CMP-4.8 publication policy.

The dashboard represents that state explicitly with zero policy identity/commitment and false current/publication flags rather than guessing a policy or treating missing policy as public.

## Parent lineage

Direct parent provenance IDs are exposed only when the requested CMP-4.7 lineage remains canonical.

Enumeration/search across projects/results is intentionally not invented on chain. CMP-7 indexer/API work may build rebuildable projections from canonical events/state, and CMP-8 may present those projections to users while preserving chain authority.

## Authority boundary

The dashboard:

- owns no mutable state;
- grants no project/job/dataset/result/publication authority;
- cannot revise project, metadata or publication policy;
- cannot publish or retrieve raw data;
- cannot verify a result;
- cannot settle, reward, slash or govern;
- cannot treat an indexer/cache as canonical state.

It is replaceable by clients that validate the same exact component graph and schema.

## Security / adversarial behavior

Required fail-closed behavior includes:

- wrong system identity/version;
- cross-wired project/provenance/result/lineage/publication graph;
- zero query identities/witnesses;
- wrong project revision or commitment;
- altered environment/parameters/resource witness;
- mismatched result/evidence/output/verifier state;
- missing canonical verification;
- noncanonical provenance;
- noncanonical lineage;
- stale/noncurrent publication policy represented as noncurrent;
- missing policy represented explicitly, never promoted to publication authorization.

## Qualification model

CMP-4.9 requires **Level 1 + a second CMP-4 Level 2 app-integration milestone**.

Level 1 covers the new dashboard/read-model contract, dedicated negative/boundary tests and mechanical verifier.

Level 2 is required here because the final substantive CMP-4 step composes the accumulated project, result-provenance, metadata/lineage and publication-policy graph into one consumer surface. The retained full Compute Market Solidity suite is the app-focused integration gate.

Required on one exact SHA:

- affected Compute contracts compile;
- dedicated `ComputeResearchDashboard420.t.sol` tests pass;
- retained full `Compute*.t.sol` integration suite passes;
- CMP-4.1–CMP-4.8 compatibility verifiers pass;
- CMP-4.9 mechanical verifier passes;
- exact-head Compute Market Qualification passes.

Repository-wide Level 3 remains exclusively CMP-4.10.

## Intentionally deferred

- exhaustive project/result enumeration and indexed search — CMP-7;
- human-facing 420Compute UI — CMP-8;
- public/testnet scientific workload and live data — CMP-9;
- comprehensive current-main reconciliation and Level 3 scientific-framework closeout — CMP-4.10.

## Next canonical step

**CMP-4.10 — Phase closeout**
