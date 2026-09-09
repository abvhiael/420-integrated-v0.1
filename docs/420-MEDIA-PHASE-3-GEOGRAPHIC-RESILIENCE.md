# 420Media Phase 3.4 — Geographic Rerouting and Failure-Domain Resilience

## Purpose

Phase 3.4 extends the qualified Phase 3.3 recovery path so operator replacement is resilient to geographic failure domains rather than merely operator identity failure. The recovery planner continues to use canonical Phase 3.1 discovery ranking and Phase 3.3 bounded attempt semantics, but adds explicit geography constraints before a replacement may be selected.

## Geographic recovery boundary

`SelectGeographicReplacement` receives the failed DAG node, the failed operator, the failed operator's geography, the stream's occupied operator identities, previously attempted replacements, and the geographies currently occupied by healthy stream work.

The failed geography is a hard exclusion. A replacement with missing geography metadata or a geography equal to the failed domain is never eligible. This prevents a regional outage or network partition from causing recovery to choose a different operator inside the same known failure domain.

All existing Phase 3.3 exclusions remain active: recovery cannot select the failed/current operator, an operator already occupied elsewhere in the graph, a previously attempted replacement, or exceed the bounded recovery-attempt ceiling. Provider capability, price, latency, geography allow-list, capacity and reliability constraints continue to come from the original discovery request.

## Diversity policy

Phase 3.4 supports two explicit diversity modes above the hard failed-domain exclusion:

- **Prefer distinct occupied geographies:** first choose the highest-ranked eligible provider outside every geography currently occupied by healthy stream work. If no such provider exists, recovery may fall back to another healthy occupied geography, but never the failed geography.
- **Require distinct occupied geographies:** the fresh-domain requirement is hard. If no eligible provider exists outside both the failed geography and all currently occupied healthy geographies, recovery exhausts and fails closed.

The discovery selector's deterministic ranking remains authoritative. Geographic recovery never re-scores candidates; it filters the ranked set according to the resilience policy and chooses the first remaining provider.

## DAG-derived failure-domain state

Phase 3.4B removes manually supplied healthy-domain state from the orchestration boundary. `DeriveFailureDomainSnapshot` walks the validated stream DAG and derives the current effective placement of every node.

Canonical nodes resolve their geography through a `GeographyResolver` backed by the same revalidated service-metadata boundary used by discovery. A node with an explicit valid recovery binding uses the replacement operator and its recovery geography as the current effective placement. Inconsistent recovery identity, resolver failure, or missing geography metadata fails closed.

The failed node's canonical operator determines the outage geography. Every node whose current effective placement is in that geography is included in `AffectedNodeIDs`; nodes outside the outage become the derived healthy occupied operator/geography set. This means a regional failure can identify multiple affected ingress/transcoder/relay jobs from one DAG snapshot rather than treating each operator failure as unrelated.

`GeographicRecoveryRequestFromSnapshot` converts an existing bounded Phase 3.3 recovery request into a geographic recovery request using this graph-derived state. A node outside the outage cannot be converted into a regional recovery request.

This preserves the separation between detection and execution: the snapshot determines failure-domain scope, geographic selection chooses a qualified replacement, and Phase 3.3 recovery execution still owns attempt-scoped job creation and downstream propagation.

## Failure-domain invariants

- **MEDIA-GEO-INV-001:** A recovery replacement must never be selected from the failed geography.
- **MEDIA-GEO-INV-002:** Missing replacement geography metadata is ineligible and cannot weaken the failed-domain exclusion.
- **MEDIA-GEO-INV-003:** Geographic recovery preserves Phase 3.3 failed/current, occupied-operator and attempted-replacement exclusions.
- **MEDIA-GEO-INV-004:** Geographic recovery preserves bounded attempt semantics and fails closed on exhaustion.
- **MEDIA-GEO-INV-005:** Prefer-diversity mode selects a fresh healthy geography when one is available without changing canonical discovery ranking.
- **MEDIA-GEO-INV-006:** Prefer-diversity mode may fall back to a healthy occupied geography only when no fresh geography is eligible; it may never fall back into the failed geography.
- **MEDIA-GEO-INV-007:** Require-diversity mode fails closed rather than collapsing multiple stream roles into the same healthy geography.
- **MEDIA-GEO-INV-008:** Geographic recovery does not relax capability, price, latency, allow-list, capacity, reliability, operator-authority, lifecycle, settlement, or recovery-attempt constraints.
- **MEDIA-GEO-INV-009:** Regional outage scope must be derived from the validated DAG and current effective recovery bindings rather than caller-asserted occupied geography state.
- **MEDIA-GEO-INV-010:** All nodes currently placed in the failed geography are marked affected; healthy nodes outside that geography remain outside the outage set.
- **MEDIA-GEO-INV-011:** A valid recovery binding replaces the canonical operator only for failure-domain placement accounting; inconsistent recovery identity fails closed.
- **MEDIA-GEO-INV-012:** Geography lookup failure or missing geography metadata prevents a regional recovery snapshot from being produced.
- **MEDIA-GEO-INV-013:** Healthy occupied operator and geography sets exclude all nodes inside the failed domain and include effective recovered placements outside it.
- **MEDIA-GEO-INV-014:** A node outside the derived regional outage cannot be promoted into geographic recovery through request construction.

## Phase 3.4 status

### 3.4A — geographic recovery selection

Complete and qualified. Provides hard failed-domain exclusion, fresh-domain preference, strict diversity, controlled fallback, metadata fail-closed behavior, and preservation of Phase 3.3 attempt/operator exclusions.

### 3.4B — DAG-derived failure-domain awareness

Implemented. The orchestration layer now derives regional outage scope, healthy occupied geographies/operators, and effective recovered placements from the live plan/recovery graph rather than accepting that state manually. Qualification covers multi-node same-region outage detection, healthy remote placement preservation, effective recovery placement, lookup/missing-metadata failure, graph-derived request construction, and rejection of healthy nodes outside the outage.

The next Phase 3.4 increments are:

1. execute coordinated multi-node regional recovery so multiple affected jobs are rerouted without replacement collisions;
2. prove relay continuity across regional transcoder loss while preserving healthy remote renditions;
3. add live Anvil qualification for geographic reroute and recovery execution;
4. define controlled rebalancing/failback rules so restored regions are not immediately trusted without health/reputation evidence.
