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

## Failure-domain invariants

- **MEDIA-GEO-INV-001:** A recovery replacement must never be selected from the failed geography.
- **MEDIA-GEO-INV-002:** Missing replacement geography metadata is ineligible and cannot weaken the failed-domain exclusion.
- **MEDIA-GEO-INV-003:** Geographic recovery preserves Phase 3.3 failed/current, occupied-operator and attempted-replacement exclusions.
- **MEDIA-GEO-INV-004:** Geographic recovery preserves bounded attempt semantics and fails closed on exhaustion.
- **MEDIA-GEO-INV-005:** Prefer-diversity mode selects a fresh healthy geography when one is available without changing canonical discovery ranking.
- **MEDIA-GEO-INV-006:** Prefer-diversity mode may fall back to a healthy occupied geography only when no fresh geography is eligible; it may never fall back into the failed geography.
- **MEDIA-GEO-INV-007:** Require-diversity mode fails closed rather than collapsing multiple stream roles into the same healthy geography.
- **MEDIA-GEO-INV-008:** Geographic recovery does not relax capability, price, latency, allow-list, capacity, reliability, operator-authority, lifecycle, settlement, or recovery-attempt constraints.

## Current Phase 3.4 boundary

The first Phase 3.4 increment provides deterministic geography-aware replacement selection and unit qualification for hard failed-domain exclusion, fresh-domain preference, strict diversity, fallback behavior, metadata fail-closed handling, and preservation of Phase 3.3 attempt/operator exclusions.

The next Phase 3.4 increments are:

1. propagate geography/failure-domain state through live stream orchestration so occupied geographies are derived from the active DAG rather than supplied manually;
2. add multi-node regional outage qualification where multiple operators in one geography become unavailable together;
3. prove relay continuity across regional transcoder loss while preserving healthy remote renditions;
4. add live Anvil qualification for geographic reroute and recovery execution;
5. define controlled rebalancing/failback rules so restored regions are not immediately trusted without health/reputation evidence.
