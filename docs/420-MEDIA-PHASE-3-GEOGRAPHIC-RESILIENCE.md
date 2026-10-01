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

## Coordinated multi-node regional recovery

Phase 3.4C adds `PlanRegionalRecovery`, which plans recovery for every node in one derived regional outage as a single deterministic batch.

Affected node IDs are sorted before planning. For each node, the planner starts from the graph-derived healthy occupied operators/geographies, applies that node's original discovery constraints and Phase 3.3 attempt state, then carries every prior replacement selected in the same batch forward as newly occupied state. This prevents two independently recovered nodes from selecting the same operator.

By default, Phase 3.4C also prevents two replacements in the same regional recovery batch from collapsing into the same new geography. Each selected replacement geography becomes occupied for the rest of the batch. If the remaining affected node cannot be placed in a distinct healthy geography, the batch fails closed and returns no partial recovery plan.

An explicit `AllowSharedReplacementGeography` policy can relax only the intra-batch geography anti-affinity rule. It does not relax operator uniqueness, the hard failed-geography exclusion, existing healthy occupied-operator protection, capability/price/latency/reliability/capacity constraints, or bounded attempt semantics.

`PlanRegionalRecovery` is planning-only. It does not create jobs, execute operators, settle funds, mutate the canonical plan, or partially apply earlier decisions. Phase 3.3 attempt-scoped execution remains the only execution path after a complete regional plan is produced.

## Relay continuity across regional transcoder loss

Phase 3.4D adds `RecoveryBindingsFromRegionalPlan` and `CreateReadyWithRegionalRecovery` at the lifecycle boundary. A coordinated regional recovery plan must cover the complete affected-node set exactly once before it can be converted into authoritative recovery bindings.

The conversion validates the original canonical operator for every affected node, rejects decisions for healthy nodes outside the outage, rejects duplicate replacement operators, rejects missing or zero-attempt decisions, and preserves the hard failed-geography exclusion. An incomplete batch cannot unlock downstream work.

After validation, Phase 3.4D deliberately reuses the qualified Phase 3.3C dependency-resolution path. Canonical successful dependencies remain canonical. A terminal-failed affected transcoder contributes only the output of its explicitly bound successful recovery attempt. Pending or terminal-failed recovery attempts do not satisfy the dependency.

For a relay with multiple renditions, `inputRefWithRecovery` sorts dependency node IDs before hashing the manifest. This means a regional outage may replace several failed rendition outputs while healthy remote rendition outputs remain unchanged, yet the relay still receives one deterministic manifest under the canonical relay job ID. Original failed transcoder lifecycle records are never rewritten.

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
- **MEDIA-GEO-INV-015:** Coordinated regional recovery must produce decisions in deterministic affected-node order.
- **MEDIA-GEO-INV-016:** Two nodes in the same regional recovery batch must never receive the same replacement operator.
- **MEDIA-GEO-INV-017:** Default coordinated recovery must not collapse multiple replacements into the same replacement geography.
- **MEDIA-GEO-INV-018:** Every replacement chosen earlier in a batch becomes occupied state for every later selection in that batch.
- **MEDIA-GEO-INV-019:** A regional recovery batch is atomic at the planning boundary: any unplaceable affected node returns no partial decision set.
- **MEDIA-GEO-INV-020:** Missing recovery input for any affected node makes the regional plan incomplete and fails closed.
- **MEDIA-GEO-INV-021:** Explicit shared-geography mode may relax only intra-batch geographic anti-affinity; operator uniqueness and all Phase 3.3/3.4A safety constraints remain mandatory.
- **MEDIA-GEO-INV-022:** Coordinated regional planning never mutates canonical DAG state or assumes execution/settlement authority.
- **MEDIA-GEO-INV-023:** A regional recovery batch must cover every affected node exactly once before downstream dependency resolution may consume it.
- **MEDIA-GEO-INV-024:** A regional recovery decision for a healthy node outside the derived outage fails closed.
- **MEDIA-GEO-INV-025:** Regional continuity preserves canonical-success dependencies and substitutes output only for terminal-failed dependencies with explicitly bound successful recovery attempts.
- **MEDIA-GEO-INV-026:** A downstream relay cannot become ready while any affected dependency recovery is missing, pending, terminal-failed, or identity-inconsistent.
- **MEDIA-GEO-INV-027:** Healthy remote rendition lifecycle state and output references remain unchanged during regional recovery propagation.
- **MEDIA-GEO-INV-028:** Original failed canonical transcoder lifecycle history remains unchanged after recovery and downstream relay creation.
- **MEDIA-GEO-INV-029:** Mixed canonical/recovered relay input manifests remain deterministic and the relay retains its canonical job identity.

## Phase 3.4 status

### 3.4A — geographic recovery selection

Complete and qualified. Provides hard failed-domain exclusion, fresh-domain preference, strict diversity, controlled fallback, metadata fail-closed behavior, and preservation of Phase 3.3 attempt/operator exclusions.

### 3.4B — DAG-derived failure-domain awareness

Complete and qualified. The orchestration layer derives regional outage scope, healthy occupied geographies/operators, and effective recovered placements from the live plan/recovery graph. Qualification covers multi-node same-region outage detection, healthy remote placement preservation, effective recovery placement, lookup/missing-metadata failure, graph-derived request construction, and rejection of healthy nodes outside the outage.

### 3.4C — coordinated multi-node regional recovery

Complete and qualified. Multiple affected DAG nodes are planned as one deterministic recovery batch, with replacement-operator anti-collision, default replacement-geography anti-affinity, graph-derived healthy placement protection, complete-batch fail-closed semantics, and an explicit opt-in shared-geography mode that does not relax operator or failed-domain safety.

### 3.4D — relay continuity across regional transcoder loss

Implemented. Complete regional recovery batches are validated before conversion into Phase 3.3C recovery bindings. Qualification covers two failed regional renditions plus one healthy remote rendition, deterministic mixed-output relay manifest creation, healthy-rendition preservation, canonical failure-history preservation, pending-recovery blocking, incomplete-batch rejection, healthy-node injection rejection, and failed-domain replacement rejection.

The next Phase 3.4 increments are:

1. add live Anvil qualification for geographic reroute and recovery execution;
2. define controlled rebalancing/failback rules so restored regions are not immediately trusted without health/reputation evidence.
