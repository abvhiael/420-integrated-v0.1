# 420Media Phase 3.2 — Stream Orchestration

## Purpose

Phase 3.2 converts the qualified Phase 3.1 provider set into a deterministic execution graph for a live stream and binds that graph to canonical `MediaJobMarket420` lifecycle coordination. The orchestration layer does not process media itself, bypass discovery, impersonate operator accounts, or assume settlement authority.

## Initial orchestration profile

The first profile models three service roles:

1. **Ingress** — receives broadcaster input and is the graph root.
2. **Transcoder** — one assigned job per requested rendition, each dependent on ingress.
3. **Relay** — optional distribution jobs dependent on the complete transcoder set.

The planner preserves Phase 3.1 price, latency, geography, capacity and reliability constraints. It selects deterministically and avoids operator reuse across roles in the initial profile.

## Graph validation

Every plan is validated before use. Validation rejects zero identities, duplicate or missing job IDs, missing dependencies, self-dependencies, cycles, duplicate role/operator assignments and malformed rendition requests. Discovery/RPC failure returns no partial plan.

## Lifecycle coordination

`media/orchestration/lifecycle.go` derives canonical job IDs from stream + DAG node and creates a job only after every parent is canonically `VERIFIED` or `SETTLED`. Terminal parent failure blocks downstream creation. Only an explicit lifecycle-not-found result is treated as absence; all other canonical read failures fail closed.

Single-parent jobs consume the verified upstream output reference. Multi-parent relay jobs consume a deterministic manifest commitment over all verified parent outputs. Raw media, URLs and credentials stay outside orchestration state.

Requester, operator and settlement authority remain separate: orchestration creates work, operators accept/execute/commit results, and settlement controls funding/release/refund.

## Ethereum lifecycle adapter

`media/orchestration/ethereum_lifecycle.go` is the concrete requester-side adapter for `MediaJobMarket420`.

It:

- submits `createAssignedJob(...)` with deterministic job ID, stream, kind, capability, SLA, input commitment, spend cap, deadline and selected operator;
- reads canonical `jobs(bytes32)` state through `eth_call`;
- reads `reservedOperatorId(bytes32)` while a job is still in `CREATED` state and has not yet populated canonical `operatorId` through acceptance;
- strictly decodes the 13-word public job getter and rejects malformed lengths, enum values and integer overflow;
- maps Solidity lifecycle ordinals into orchestration lifecycle states without exposing enum ordinals to coordinator logic;
- treats `Status.NONE` as explicit canonical not-found rather than a successful empty snapshot.

## Assigned-job reservation

Phase 3.2 uncovered a race in the original Phase 1 market: `createJob` did not bind the planner-selected operator, so another otherwise-qualified operator could accept a fresh job first.

`MediaJobMarket420` now provides a backward-compatible `createAssignedJob(...)` path and a separate `reservedOperatorId` mapping. Existing generic `createJob(...)` behavior is unchanged. Assigned jobs are created only for an operator that is currently operational for the capability, and `acceptJob` rejects any operator that does not match the reservation. The separate mapping preserves the existing 13-word `jobs(bytes32)` getter ABI used by Phase 2 node adapters.

## Live qualification

The existing Anvil gate now also watches `media/orchestration/**`. `scripts/420media-anvil-integration.sh` deploys the Phase 1 contracts, registers an operational operator, and runs a live orchestration test that:

1. builds a valid orchestration DAG;
2. runs `LifecycleCoordinator.CreateReady` against the real Ethereum lifecycle adapter;
3. proves only the ingress/root job is created before dependencies succeed;
4. verifies the canonical deterministic job ID on chain;
5. verifies the selected operator reservation is visible through the live contract.

## Phase 3.2 invariants

- **MEDIA-ORCH-INV-001:** Plans require non-zero stream and required capabilities.
- **MEDIA-ORCH-INV-002:** Provider assignment uses only qualified Phase 3.1 discovery.
- **MEDIA-ORCH-INV-003:** Discovery failure returns no partial graph.
- **MEDIA-ORCH-INV-004:** Initial placement does not reuse one operator across roles.
- **MEDIA-ORCH-INV-005:** Each rendition maps to exactly one transcoder job.
- **MEDIA-ORCH-INV-006:** Every transcoder depends on ingress.
- **MEDIA-ORCH-INV-007:** Every relay depends on the complete transcoder set.
- **MEDIA-ORCH-INV-008:** Job IDs and dependency ordering are deterministic.
- **MEDIA-ORCH-INV-009:** Missing dependencies, self-dependencies and cycles invalidate the plan.
- **MEDIA-ORCH-INV-010:** Plans contain references/structure only, never raw media or secrets.
- **MEDIA-ORCH-INV-011:** Downstream jobs are created only after all parents are `VERIFIED` or `SETTLED`.
- **MEDIA-ORCH-INV-012:** Failed/cancelled/expired/refunded parents block downstream creation.
- **MEDIA-ORCH-INV-013:** Canonical snapshot/RPC errors fail closed except explicit not-found.
- **MEDIA-ORCH-INV-014:** Lifecycle state must bind the deterministic job identity to the planned operator identity.
- **MEDIA-ORCH-INV-015:** Requester orchestration never assumes operator or settlement authority.
- **MEDIA-ORCH-INV-016:** Downstream inputs are derived only from verified parent output commitments.
- **MEDIA-ORCH-INV-017:** Assigned orchestration jobs must reserve the planner-selected operator before acceptance.
- **MEDIA-ORCH-INV-018:** A different operator cannot claim an assigned orchestration job even when otherwise qualified.
- **MEDIA-ORCH-INV-019:** The assigned-job extension must not change the existing public `jobs(bytes32)` getter shape relied on by Phase 2 adapters.
- **MEDIA-ORCH-INV-020:** The live Anvil gate must cross both coordinator and Ethereum adapter boundaries before reporting orchestration job creation success.

## Current completion boundary

Phase 3.2 now includes deterministic provider/DAG planning, dependency-gated lifecycle coordination, the concrete Ethereum lifecycle adapter, operator reservation, and a live Anvil creation gate.

The next Phase 3.2 increment is full multi-stage live lifecycle qualification: accept/fund/run/commit/finalize ingress, then prove transcoder creation unlocks from canonical parent success. Cross-node failover and geographic rerouting remain later Phase 3 work.
