# CMP-7.6 — Compute indexer

Status: **COMPLETE — Level 1 exact-head qualified on `f3f3e6280fd47df5793b07623f9db75c5e9b1c38`.**

## Canonical purpose

Add a Compute-specific, reorg-rebuildable projection layer to 420Indexer without turning indexed state into protocol authority.

## Requirements

- artifact-derived event descriptors for canonical job/request, worker, verifier, research-project and useful-reward families;
- deployment addresses are injected/bound explicitly and never guessed;
- canonical replay ordering by block/transaction/log position;
- chain-scoped direct projections with provenance;
- fail closed on malformed IDs, creation-order contradictions and private-field contamination;
- all returned states are explicitly `authoritative:false`;
- raw workloads, datasets, credentials and result bytes are never indexed by this surface.

## Implementation

420Indexer adds `compute-descriptors.ts`, a repository descriptor manifest, and `compute-read-model.ts`. The read model reconstructs job/request lifecycle, worker/verifier lifecycle, research-project lifecycle and useful-reward accounting from the existing typed protocol-event journal. It reuses the indexer's existing rollback/replay machinery rather than introducing a second database.

## Qualification

Level 1 runs the complete 420Indexer TypeScript build/test suite, including descriptor ABI-drift checks, replay-order checks, lifecycle contradiction tests, privacy rejection and reward non-authority assertions.

## Next canonical step

**CMP-7.7 — Historical analytics**

## Public API

The stable Indexer HTTP transport exposes optional direct Compute routes for jobs, requests, workers, verifiers, research projects and reward-accounting records under `/v1/compute/...`. These routes return 503 when Compute projection support is not installed and never fall back to invented state.
