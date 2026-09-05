# 420Media Phase 3.2 — Stream Orchestration

## Purpose

Phase 3.2 converts the qualified Phase 3.1 provider set into a deterministic execution graph for a live stream and then binds that graph to canonical `MediaJobMarket420` lifecycle coordination. The orchestration layer is an off-chain control-plane component: it does not process media itself, bypass canonical provider discovery, impersonate operator accounts, or assume settlement authority.

## Initial orchestration profile

The first profile models three service roles:

1. **Ingress** — receives the broadcaster input and is the root of the graph.
2. **Transcoder** — one assigned job per requested rendition, each dependent on ingress.
3. **Relay** — optional distribution jobs dependent on the complete transcoder set.

The planner asks the Phase 3.1 discovery control plane for eligible providers for each capability, preserving price, latency, geography, capacity and reliability constraints.

## Deterministic assignment

- the top qualified ingress provider is selected first;
- ingress is excluded from later role assignment;
- transcoders are selected in discovery rank order, one per rendition;
- selected transcoders are excluded from relay assignment;
- relay providers are selected in discovery rank order;
- rendition job IDs are stable (`transcode:NNN:<rendition>`);
- relay job IDs are stable (`relay:NNN`);
- relay dependency IDs are sorted before graph emission.

This first profile intentionally avoids reusing the same operator across roles. That is a conservative blast-radius boundary for initial orchestration; later placement policy may allow controlled co-location explicitly.

## Graph validation

Every emitted plan is validated before it leaves the planner. Validation rejects:

- zero stream IDs or operator IDs;
- missing or duplicate job IDs;
- missing dependencies;
- self-dependencies;
- dependency cycles;
- duplicate role/operator assignments;
- malformed plan requests, including duplicate or empty rendition names.

A Kahn traversal verifies acyclicity. Discovery/RPC failures propagate directly and no partial plan is returned.

## Lifecycle coordination

`media/orchestration/lifecycle.go` binds the qualified DAG to canonical media jobs without collapsing requester, operator and settlement authority.

The coordinator:

- derives a deterministic bytes32 canonical job ID from stream ID + orchestration node ID;
- creates only jobs whose dependencies have reached canonical successful terminal states (`VERIFIED` or `SETTLED`);
- never accepts a job on behalf of the assigned operator;
- never confirms funding on behalf of settlement;
- never marks a job running or commits a result on behalf of the worker;
- treats only an explicit `ErrLifecycleJobNotFound` as proof that a job has not yet been created;
- fails closed on all other snapshot/RPC errors;
- verifies canonical job ID and assigned operator identity before trusting lifecycle state;
- stops downstream creation if any dependency reaches failed/cancelled/expired/refunded state;
- passes the ingress root input reference directly to the ingress job;
- passes the verified upstream output reference to single-parent transcoder jobs;
- derives a deterministic manifest reference from all verified transcoder outputs for multi-parent relay jobs.

The manifest is a commitment/reference only. Raw media, URLs and credentials remain outside orchestration state.

## Phase 3.2 invariants

- **MEDIA-ORCH-INV-001:** No orchestration plan may be created without a non-zero stream ID and explicit ingress/transcoder capabilities.
- **MEDIA-ORCH-INV-002:** Provider assignment may use only the qualified Phase 3.1 discovery control plane.
- **MEDIA-ORCH-INV-003:** Discovery failure fails orchestration closed; partially assigned graphs are never returned.
- **MEDIA-ORCH-INV-004:** The initial orchestration profile does not reuse one operator across ingress, transcoder and relay roles.
- **MEDIA-ORCH-INV-005:** Every requested rendition maps to exactly one transcoder job.
- **MEDIA-ORCH-INV-006:** Every transcoder job depends on the ingress job.
- **MEDIA-ORCH-INV-007:** Every relay job depends on the complete transcoder set.
- **MEDIA-ORCH-INV-008:** Job IDs and dependency ordering are deterministic for a fixed request/provider snapshot.
- **MEDIA-ORCH-INV-009:** Missing dependencies, self-dependencies and cycles invalidate the entire plan.
- **MEDIA-ORCH-INV-010:** Orchestration plans contain operator references and dependency structure only; no raw media, ingress credentials, playback secrets or signer secrets.
- **MEDIA-ORCH-INV-011:** A downstream canonical job may be created only after every dependency is canonically `VERIFIED` or `SETTLED`.
- **MEDIA-ORCH-INV-012:** Any failed, cancelled, expired or refunded dependency blocks downstream creation.
- **MEDIA-ORCH-INV-013:** Lifecycle snapshot/RPC errors fail closed; only explicit canonical not-found state may be interpreted as an uncreated job.
- **MEDIA-ORCH-INV-014:** Canonical lifecycle snapshots must match both the deterministic job ID and the operator assigned by the orchestration plan.
- **MEDIA-ORCH-INV-015:** The orchestration requester cannot assume operator acceptance/execution authority or settlement funding authority.
- **MEDIA-ORCH-INV-016:** Single-parent downstream jobs consume only a verified upstream output reference; multi-parent relay jobs consume a deterministic manifest commitment over all verified parent outputs.

## Current completion boundary

Phase 3.2 now has both deterministic provider/DAG planning and requester-side canonical job lifecycle coordination. The next increment is the concrete Ethereum `MediaJobMarket420` lifecycle adapter plus end-to-end orchestration qualification against Anvil.

Cross-node failover and geographic rerouting remain later Phase 3 work and are intentionally outside this lifecycle increment.
