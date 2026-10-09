# DOOBR-AUDIT-1 — recursive repository inventory and canonical source discovery

Audit date: 2026-10-09
Qualification: Level 1, source/inventory evidence only
Baseline main implementation SHA: `aacf7ddcf587224ab48fb2dcd28af1ee133745f1`
Audit branch: `audit/doobr-audit-1-inventory-20261009`

## Method and completeness
- Queried GitHub's recursive Git tree endpoint `GET /repos/abvhiael/420-integrated-v0.1/git/trees/main?recursive=1`.
- Result: 8,125 tree entries; `truncated=false`; tree SHA `aacf7ddcf587224ab48fb2dcd28af1ee133745f1`.
- Case-insensitive path search for `doobr`: **zero path matches**. This proves no path *named* DOOBR exists at this baseline, not that no file contents mention DOOBR.
- Searched indexed default-branch contents for `DOOBR`, `doobr_compatibility`, `420/service/doobr`, and `DOOBR ROADMAP`; inspected canonical files explicitly.
- Queried branch search for `doobr` / `DOOBR`: no current matching branch names.
- Queried PR search for `DOOBR`: related PRs #337, #340, #356; none establishes a standalone DOOBR implementation PR.
- Queried commit search for `DOOBR`: `815519d991c4f79dfa17d2166cf568dc9a0bde66` (Travel merge), `e23061f5d598803a0f4c869357f43c2c8c22cd5a` (reserved schemas/gateway), `ebb00087994b7fca77c71e9cfefd4a790b50fa65` (documentation).

## Canonical source inventory
- `config/genesis-applications.json`: frozen Genesis catalog; no independent DOOBR entry established.
- `config/genesis-consumer-services.json`: Travel service listed; `travel.doobr_transactions` defaults false; no standalone `420/service/doobr` entry.
- `docs/genesis-services/GEN-SVC-0-ROADMAP.md`: shared permissions, API, provenance, SDK, on/off-chain, service-promotion rules.
- `docs/genesis-services/GEN-SVC-3-TRAVEL.md`: GEN-SVC-3.9 DOOBR compatibility; `ServiceProvider`, `ServiceArea`, `DeliveryWindow`, `ServiceRequest`; transactions disabled at Genesis.
- `config/420travel-genesis.json`: `doobr_compatibility.enabled_at_genesis=false`, four reserved objects and `DOOBR_TRANSACTION_FLOWS` deferred.
- `genesis/svc3/travelapp/COMPATIBILITY.md`: structural-only schemas and disabled transaction methods.
- `genesis/svc3/travelapp/GEN-SVC-3-ROADMAP.md`, `QUALIFICATION.md`, `README.md`: related Travel release/evidence context (not independent DOOBR roadmaps).
- `scripts/validate-gen-svc-0.py`, `scripts/validate-gen-svc-3.py`: Genesis configuration invariants.
- `.github/workflows/gen-svc-3.yml`: app-scoped CI (Travel); paths: Travel config/docs/script, `genesis/svc3/**`, `cmd/420travel/**`, `go.mod`, workflow itself.

## Located executable source and tests
- `genesis/svc3/travelapp/compatibility.go`: ten Travel compatibility records including four DOOBR records; `travel-compat/v1`; structural `Validate()` methods; `GenesisTravelTransactions` methods `Reserve`, `Quote`, `Pay`, `Escrow`, `CancelAndSettle`, `RequestDelivery`, `DynamicPrice` return `ErrTravelTransactionDisabled` unconditionally.
- `genesis/svc3/travelapp/compatibility_test.go`: valid and malformed schema cases, mismatched delivery provider and all seven fail-closed gateway methods.
- No filename/path with `DOOBR` in the complete non-truncated main tree. No independent DOOBR build, frontend, contract, backend, indexer, deployment or CI path identified by tree naming or scoped code searches. These are **not** proof that future standalone application requirements were satisfied or that unnamed files cannot relate to DOOBR.

## Authority and release interpretation
DOOBR's *documented current Genesis commitment* is forward-compatible Travel records and **disabled** delivery transactions. Neither the shared consumer registry nor the frozen Genesis catalog authorizes a standalone DOOBR launch. Do not convert the fail-closed gateway into a feature flag. Do not infer permissions to deliver cannabis, identity verification, service-area licensing, provider onboarding, payment, escrow or live provider integrations from these schemas.

## Qualification scope and evidence limits
- Static source inspection: performed against baseline `aacf7ddcf587224ab48fb2dcd28af1ee133745f1`.
- Targeted canonical CI definition: `.github/workflows/gen-svc-3.yml` includes `python3 scripts/validate-gen-svc-3.py`, `go test ./genesis/svc3/... ./cmd/420travel/...`, `go vet` and `go build`.
- No execution of Go/Python tests or CI workflow was performed in this inventory action; do **not** call these passing evidence. A doc-only inventory does not justify full Foundry, Genesis, global Qualification or Level 3 runs.
- CI trigger caveat: this audit record alone falls outside the GEN-SVC-3 workflow's path filters. It must not be classified as a passing required CI run.
- Level 2: not triggered. Level 3: deferred until whole DOOBR audit phase closeout.
- No contract or application code changed; no canonical requirements altered.

## DOOBR-AUDIT-1 exit check
- [x] Complete recursive **path** inventory on current main, non-truncated.
- [x] Canonical known DOOBR references and shared/frozen scope located.
- [x] Current DOOBR-named branch search and related PR/commit history recorded.
- [x] Relevant implementation, tests, and CI trigger logic identified.
- [ ] Executed Level 1 verification / reproducible full-text occurrence scan of every one of the 8,125 tree entries. GitHub indexed code search is not a bytewise content enumeration; treat coverage accordingly.
- [ ] Exact-SHA passing CI evidence (if required by qualification policy).

**Disposition:** PARTIAL — inventory and scope discovery documented, but do not claim a fully qualified step until the remaining Level 1 verification/evidence requirement is met.

Next proposed roadmap step after complete qualification: `DOOBR-AUDIT-2 — Reconcile standalone DOOBR requirements with the frozen Genesis application decision and consumer-services architecture`.
