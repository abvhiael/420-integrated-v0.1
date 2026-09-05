# 420Media Phase 3.2 — Stream Orchestration

## Purpose

Phase 3.2 converts the qualified Phase 3.1 provider set into a deterministic execution graph for a live stream. The orchestration planner is an off-chain control-plane component: it does not process media itself and it does not bypass canonical provider discovery.

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

## Completion boundary

This increment establishes deterministic provider assignment and job-graph construction. The next Phase 3.2 increments should bind this plan to job creation/lifecycle coordination and enforce state transitions from planned → accepted/funded → running → completed/failed.

Cross-node failover and geographic rerouting remain later Phase 3 work and are intentionally outside this initial planner.
