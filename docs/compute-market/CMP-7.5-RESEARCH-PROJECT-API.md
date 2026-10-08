# CMP-7.5 — Research project API

Status: **COMPLETE — Level 1 + first CMP-7 Level 2 exact-head qualified on `e2095a027660157382d35456d73bf7219257611d`.**

## Canonical purpose

Expose project and result discovery for scientific Compute consumers while preserving the CMP-4 project, result-provenance, lineage and publication-policy authorities.

## Requirements

- chain-scoped project lookup by canonical project ID;
- expose owner, project/metadata commitments, active state, revision and result count;
- expose bounded result projections linked to work unit, provenance, verification decision and publication policy;
- never expose raw datasets, credentials or private scientific bytes;
- mark all projections non-authoritative with explicit finality;
- fail closed on unavailable backends or an unbounded result page.

## Implementation

`@420/compute-api` adds:

- `GET /v1/compute/research/projects/:projectId`
- `GET /v1/compute/research/projects/:projectId/results`

The result collection is capped by the API contract at 200 records per backend page. Project creation/update, dataset access grants and publication changes remain Wallet-authorized canonical operations.

## Level 2 milestone

CMP-7.5 is the first CMP-7 Level 2 boundary because job submission plus job/worker/verifier/research read APIs now converge on one developer service and the shared `@420/sdk` authority boundary.

Level 2 therefore runs the complete retained SDK test suite plus the complete Compute API suite on one exact accumulated SHA. Repository-wide Level 3 remains deferred to CMP-7.10.

## Next canonical step

**CMP-7.6 — Compute indexer**

## Qualification marker

This document change intentionally selects the first CMP-7 Level-2 retained SDK + API integration milestone after repair of the milestone workflow. The implementation and authority semantics are unchanged.
