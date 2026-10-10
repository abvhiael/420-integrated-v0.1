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

## Latest qualification candidate and workflow reconciliation
- Latest executable/workflow SHA: `b71cb25b87c51e2638ebca8e657c29455dda448c` (supersedes earlier `0cb236c8057aec5dbaa1a51687b989a70ae8a4e8`).
- Canonical `.github/workflows/gen-svc-3.yml` was updated with GEN-SVC-0 validator, DOOBR authority verifier and noncached targeted DOOBR regressions, in addition to existing Travel Go tests, vet and build. This ensures an app-scoped canonical workflow can qualify AUDIT-4 even if the audit-only workflow's independent trigger is unavailable.
- At recording time GitHub has not exposed completed required validation jobs for the final executable SHA. **Do not mark AUDIT-4 COMPLETE until exact-SHA passes appear**.
- Earlier queued canonical validation runs at older SHAs cannot qualify the updated workflow commit.

## Final qualified Level 1 closeout — 2026-10-09

**Status: COMPLETE (DOOBR-AUDIT-4 only).**

- Exact qualified implementation/workflow SHA: `e8893b7eabc0d3ee32a1e2e14a606738335ef3ef`.
- GitHub Actions [DOOBR Audit Level 1](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37995733609), run ID `37995733609`, job ID `114041195838`: completed SUCCESS, no failed required steps.
- Checkout triggering commit — PASS; exact checkout SHA assertion — PASS.
- Python syntax compilation of validators — PASS.
- GEN-SVC-0 shared Genesis architecture validator — PASS.
- GEN-SVC-3 canonical Travel validator — PASS.
- DOOBR-AUDIT-2 architecture authority verifier — PASS.
- DOOBR noncached compatibility/fail-closed regression tests — PASS.
- GEN-SVC-3 scoped Go tests — PASS.
- GEN-SVC-3 scoped `go vet` — PASS.
- Travel Go server build — PASS.
- Root cause of older startup failures: malformed YAML with truncated Go regexp, duplicate run keys/steps and stray `-v`; fixed in `.github/workflows/doobr-audit-1-level1.yml` and `.github/workflows/gen-svc-3.yml`. Earlier zero-job workflow failures are superseded, not reclassified as passing.
- No runtime DOOBR transaction authority was enabled; the existing Genesis compatibility gateway remains fail-closed.
- Inspected main at implementation time: `f8bbb62e1cdfe68cff25261fd4a036db1840a15c`; PR #598 is not yet merged.
- No Level 2 milestone required here. Level 3 deferred to audit-phase reconciliation on final merge candidate. Unrelated Cloudflare Worker failures excluded from DOOBR Level 1 without altering repository-wide checks.
- Evidence-only append commit is not a new executable implementation SHA; no recursive qualification needed.
- Next roadmap step: `DOOBR-AUDIT-5 — Define any separately authorized DOOBR service, payment, identity and delivery integrations required by the approved scope`.
