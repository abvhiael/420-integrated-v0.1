# DOOBR-AUDIT-4 — targeted Genesis and compatibility qualification

Roadmap step: DOOBR-AUDIT-4 — Run targeted compatibility regression tests and Genesis validators.
Audit stage: Level 1.
PR: #598. Branch: `audit/doobr-audit-1-inventory-20261009`.
Inspected main: `f8bbb62e1cdfe68cff25261fd4a036db1840a15c`.
Implementation candidate: `0cb236c8057aec5dbaa1a51687b989a70ae8a4e8`.

## Scope / acceptance
Canonical GEN-SVC-0 architecture preserves frozen application catalog and service boundaries. GEN-SVC-3.9 keeps DOOBR compatibility schemas forward-compatible and all transaction operations fail-closed. App-scoped qualification is required; no standalone DOOBR execution is authorized.

## Required directly applicable validation
- `python3 scripts/validate-gen-svc-0.py` — shared consumer-service and frozen-catalog governance.
- `python3 scripts/validate-gen-svc-3.py` — Travel Genesis dependency, deferred-transaction, UI and release boundaries.
- `python3 scripts/verify-doobr-audit-2.py` — DOOBR-specific architecture authority invariants.
- `go test -count=1 ./genesis/svc3/travelapp -run '^(TestGenesisCompatibilitySchemas|TestGenesisTransactionMethodsAlwaysDisabled|TestDOOBRAudit3BoundaryMatrix|TestDOOBRAudit3GatewayCannotBeEnabledByInput)$' -v` — targeted positive, invalid schema, timing, provider-reference, and disabled-gateway assertions. The `-count=1` flag prevents cached results.
- `go test ./genesis/svc3/... ./cmd/420travel/...` — directly affected package regression suite.
- `go vet ./genesis/svc3/... ./cmd/420travel/...` — targeted static analysis.
- `go build -o /tmp/420travel ./cmd/420travel` — relevant server compile.
- Assert checkout HEAD equals triggering `GITHUB_SHA`.

The scoped workflow is `.github/workflows/doobr-audit-1-level1.yml`; existing Travel `.github/workflows/gen-svc-3.yml` may also be triggered by changed travel test paths. Do not substitute that broader result for the exact targeted audit-4 criteria.

## Change classification and retained work
The only executable change for this step is the scoped CI workflow adding shared Genesis validator and non-cached targeted DOOBR Go regression invocation. No compatibility source code, APIs, contracts, authority, deployments or frozen addresses changed. Prior AUDIT-3 regression tests remain intact.

## Evidence status
PENDING until exact-SHA CI job conclusions and individual required steps are verified. Missing/queued/skipped required checks are NOT PASS. After verified results, append exact run/job IDs and outcomes as an evidence-only commit (do not force duplicate qualification).

## Levels
Level 2 not required for this step. Level 3 deferred to app-phase final merge candidate. Full Foundry / global Genesis / 420 Integrated / Docs are deliberately not required. Unrelated Cloudflare Worker failures are out of app scope.

## Next step
DOOBR-AUDIT-5 — Define any separately authorized DOOBR service, payment, identity and delivery integrations required by the approved scope.
