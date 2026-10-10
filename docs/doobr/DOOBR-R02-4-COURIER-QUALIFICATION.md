# DOOBR R02.4 — Courier eligibility/training/vehicle verification and expiry

Status: IMPLEMENTED REPOSITORY FOUNDATION; Level 1 CI pending. PR #601.

Canonical step: R02.4 — Courier eligibility, training, vehicle credential verification and expiry.

## Scope
- `doobr/courier.py` enforces actor/tenant and carrier-class-scoped independent identity, courier authorization, training and policy-required vehicle evidence, start/expiry, revocation, duplicate evidence rejection and vehicle binding.
- External 420Compliance (not DOOBR) decides which credentials a class/jurisdiction requires. Fail-closed when policy missing or issuer unavailable; no invented BC training, vehicle requirements, issuer grants or legal rules.
- `0004_courier.up.sql` provides tenant-scoped reference and expiry storage under FORCE RLS. DB records alone do not establish independent issuer acceptance or prove an employee belongs to an authorized retailer.
- Targeted unit/adversarial and real PostgreSQL tenant isolation tests run via `doobr-r02-4-level1.yml`. No duplicate Foundry, Genesis, global Docs or Level 2 tests.
- The eligibility checker must be re-run against current revocation and policy before an assignment/pickup/handoff in later R02.6–R02.10 journey integration. It does not by itself enable delivery or approve carrier operations.

## External acceptance deferred
Independent regulatory interpretation, recognized issuer credentials, courier/vehicle/training verification integrations, actual revocation feeds, carrier insurance/employment acceptance, deployed credential service tests and BC/Vancouver legal signoff remain R06.4/R06.5/R06.9 and DOOBR-AUDIT-9/10 requirements. Such operations cannot be certified by a simulated issuer or testnet alone.

R02.13 is next Level 2; R05.10 next Level 3. Subsequent canonical step R02.5 coarse regional presence/geofences/capacity/safe Travel/Maps projection. No live transaction authorization.
