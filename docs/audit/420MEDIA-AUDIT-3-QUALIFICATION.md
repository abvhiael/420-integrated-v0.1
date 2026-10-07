# 420Media — MEDIA-AUDIT-3 qualification evidence

## Step

**MEDIA-AUDIT-3 — Operator discovery and service control plane**

Status: **COMPLETE**

Qualification level: **Level 1 — app-scoped fast qualification**

## Authoritative implementation

- implementation SHA: `e0d938cd78a92a6c28ff88c641c9f3b332ffba20`
- base/main SHA: `d86a3810d2901dc1082b65dc9061896c46e1911d`
- audit branch: `audit/420media-complete-20261006`
- active PR: **#536**
- historical source PR reviewed: **#86**
- PR #86 status: OPEN / not authoritative as a branch
- reconciliation policy: only the Phase 3.1 operator-discovery/control-plane subset was carried forward; later orchestration, assigned-job contract changes, failover/recovery and geographic-resilience changes were intentionally excluded.

## Implementation completed

MEDIA-AUDIT-3 now provides:

- event-index acceleration from `OperatorCapabilityChanged`;
- deterministic ordered replay of capability state;
- strict malformed/removed-log rejection;
- strict block/log quantity validation;
- direct canonical `operators(bytes32)` and `isOperationalFor(bytes32,bytes32)` revalidation;
- fail-closed canonical/RPC behavior with no partial candidate set;
- duplicate operator suppression;
- off-chain profile resolution keyed by canonical metadata commitment/revision;
- bounded profile validation including reliability basis points;
- hard filtering for price, latency, geography, capacity and reliability;
- deterministic weighted ranking and stable tie-breaking;
- a bounded service control-plane response that excludes endpoints, credentials, metadata payloads and raw media references;
- replay-based reorg recovery: each discovery pass reconstructs from the current canonical log view and then revalidates canonical state.

## Files introduced or changed for this step

- `docs/420-MEDIA-PHASE-3-OPERATOR-DISCOVERY.md`
- `media/discovery/types.go`
- `media/discovery/source.go`
- `media/discovery/selector.go`
- `media/discovery/ethereum.go`
- `media/discovery/source_test.go`
- `media/discovery/selector_test.go`
- `media/discovery/ethereum_test.go`
- `media/controlplane/discovery.go`
- `media/controlplane/discovery_test.go`
- `.github/workflows/420media-audit.yml`
- `scripts/verify-420media-audit.py`
- `docs/420MEDIA-AUDIT.md`

## Requirements satisfied

- PR #86 reconciled/superseded against current main without wholesale merge.
- Event-index state is explicitly non-authoritative.
- Every indexed candidate is revalidated against canonical registry state.
- Canonical/RPC failure returns no partial selection.
- Removed/malformed logs fail closed.
- Malformed block/log ordering quantities fail closed before replay.
- Repeated discovery passes recover from a changed canonical log view rather than retaining stale authority.
- Invalid/unavailable service metadata excludes only the affected provider.
- Provider constraints are applied before scoring.
- Ranking is deterministic for a fixed snapshot and stable under exact ties.
- Duplicate indexed IDs cannot create duplicate providers.
- Service control-plane requests cannot broaden selector eligibility.
- Service responses exclude secret-bearing or raw-media fields.
- Existing Phase 1 and Phase 2 behavior remains protected by the retained Media gate.

## Exact-head Level 1 qualification

Workflow: **420Media audit**

- run: **37497230251**
- run number: **24**
- job: **112385219487**
- exact implementation SHA assertion: **PASS**
- canonical Media audit verifier: **PASS**
- discovery/control-plane formatting check: **PASS**
- `go test ./media/... ./cmd/420media-node`: **PASS**
- `go vet ./media/... ./cmd/420media-node`: **PASS**
- Media Solidity build: **PASS**
- retained Phase 1 protocol/hardening tests: **PASS**
- Media Anvil integration: **PASS**
- workflow conclusion: **SUCCESS**

Superseded/cancelled workflow runs on intermediate SHAs are not qualification evidence.

## Security / adversarial results

PASS for the Level 1 scope:

- stale indexed state cannot authorize an operator;
- canonical revalidation is mandatory;
- canonical read failure fails the whole pass closed;
- malformed/removed/reordered-log inputs fail closed;
- invalid bool/revision/ABI data is rejected;
- duplicate candidate amplification is prevented;
- deterministic ranking is preserved;
- provider responses do not expose credentials, endpoints, metadata payloads or raw media;
- reorg recovery does not depend on a persistent authoritative cache.

## Milestone status

MEDIA-AUDIT-3 is an ordinary roadmap step. It does **not** trigger Level 2.

The next documented Level 2 milestone remains **MEDIA-AUDIT-5 — Basic livestreaming service**.

## Intentionally deferred

Level 2:
- broader retained Media cross-component integration at the MEDIA-AUDIT-5 milestone.

Level 3:
- full repository Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- repository-wide security/static/deployment closeout.

Later roadmap work:
- stream orchestration/assigned-job semantics are not imported from PR #86 by this step;
- Storage-backed uploads remain MEDIA-AUDIT-4;
- canonical Pay/Compute integration remains MEDIA-AUDIT-7;
- general public Media indexing/Search integration remains MEDIA-AUDIT-8;
- stable public `/v1` API remains MEDIA-AUDIT-9.

## Blockers

None for MEDIA-AUDIT-3 Level 1 completion.

## Next canonical roadmap step

**MEDIA-AUDIT-4 — 420Storage video upload and media-asset lifecycle**
