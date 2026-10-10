# DOOBR-AUDIT-3 — compatibility schema, validators and disabled gateway

Audit scope: GEN-SVC-3.9 reserved DOOBR records only, not an independently authorized delivery application.
Main baseline inspected: `f8bbb62e1cdfe68cff25261fd4a036db1840a15c`.
PR: #598, branch `audit/doobr-audit-1-inventory-20261009`.
Qualification: Level 1, scoped GEN-SVC-3.

## Canonical references
- `docs/genesis-services/GEN-SVC-3-TRAVEL.md` (GEN-SVC-3.9)
- `genesis/svc3/travelapp/COMPATIBILITY.md`
- `config/420travel-genesis.json`
- `config/genesis-consumer-services.json`
- `genesis/svc3/travelapp/compatibility.go`, `compatibility_test.go`
- `.github/workflows/gen-svc-3.yml` plus scoped audit workflow.

## Observed implementations
- `ServiceProvider`: schema version, opaque ID, canonical place reference, external identity reference. Structural-only validation; no provider credential verification.
- `ServiceArea`: schema version, provider ID, coarse region/country. Rejects empty/oversized fields and CR/LF/NUL; it does **not** prove geography, legality or absence of address-like one-line strings.
- `DeliveryWindow`: schema version, provider ID, nonzero, ordered time bounds at most 366 days; no authoritative availability promise.
- `ServiceRequest`: schema version, opaque request/provider IDs, requester identity reference, nested window whose provider must match; no persist, authorization, order execution or settlement.
- `GenesisTravelTransactions`: seven methods (`Reserve`, `Quote`, `Pay`, `Escrow`, `CancelAndSettle`, `RequestDelivery`, `DynamicPrice`) return `ErrTravelTransactionDisabled` regardless of input.
- No DOOBR wallet signatures, custody, registry authority, contracts, provider licenses, regulated delivery flows or exposed transaction HTTP routes in this compatibility layer. These should **not** be invented for the Genesis compatibility step.

## Focused regression augmentation
Added `genesis/svc3/travelapp/doobr_audit3_test.go` with:
- positive schema validation for all four records;
- negative version, requester/provider identity, control-character, private-address newline, blank region and invalid ID inputs;
- delivery window zero/reverse/greater-than-366-days bounds;
- mismatched nested provider and nested schema version;
- gateway still disabled with valid and empty requests under active and cancelled context.

## Security classification
- **Verified by source:** reserved compatibility data alone cannot execute transactions; gateway unconditional disabled error.
- **Mitigated by validation:** malformed record shapes and mismatched provider references.
- **Accepted design limitation:** free-text coarse geography, no independently verified regulatory/licensing identity or service availability. Such proof is outside compatibility-scope authority.
- **Future release blockers:** a standalone product needs approval and live identity, regulated provider, payment, privacy and lifecycle design; no feature flag may bypass gateway.
- Runtime qualification requires passing targeted CI at the exact implementation SHA. A skipped/queued job is not PASS.

## Changed files
- `genesis/svc3/travelapp/doobr_audit3_test.go`
- `.github/workflows/doobr-audit-1-level1.yml`
- this evidence document.

## Qualification status
Pending exact-SHA CI execution of `python3 scripts/validate-gen-svc-3.py`, `python3 scripts/verify-doobr-audit-2.py`, `go test ./genesis/svc3/... ./cmd/420travel/...`, `go vet ./genesis/svc3/... ./cmd/420travel/...`, and `go build -o /tmp/420travel ./cmd/420travel`. Level 2 not required; Level 3 deferred. No source gateway, funds, authority, frozen address, or protocol configuration changed.

Next: `DOOBR-AUDIT-4 — Run targeted compatibility regression tests and Genesis validators`.

## Verified exact-SHA Level 1 CI result (2026-10-09)
- Qualifying implementation SHA: `357bc194412661dae06f91602a2470c0ea4a6f57`.
- Workflow run: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37989374640
- Job: `scoped-qualification` (114019333133) — SUCCESS.
- GEN-SVC-3 canonical Python validator: PASS.
- DOOBR-AUDIT-2 architecture verifier: PASS.
- GEN-SVC-3 Go tests (includes `doobr_audit3_test.go`): PASS.
- `go vet ./genesis/svc3/... ./cmd/420travel/...`: PASS.
- Go server build: PASS.
- Exact checkout SHA assertion: PASS.
- No required scoped steps failed or skipped. Level 2 not required for this standalone boundary audit; Level 3 deferred.
- Disposition: DOOBR-AUDIT-3 Level 1 COMPLETE, limited to Genesis compatibility objects and fail-closed gateway; no independent delivery app is authorized or qualified.
