# DOOBR R02.3 — Retailer licence and prepaid seller-of-record gate

Status: **IN PROGRESS — NOT QUALIFIED**. PR #601. Do not promote to R02.4 or enable live deliveries.

## Repository-side implementation candidate
- `doobr/retailer.py` requires tenant/retailer/site/municipality/licence-scoped, effective and non-revoked independent regulatory evidence; denial or regulator-service outage fails closed.
- The prepaid order adapter requires the exact independently confirmed legal seller, retailer order reference, settled amount/currency and a non-reversed canonical payment reference. A wallet display, self-declared receipt or `420Verify` software verification is insufficient.
- `0003_retailer.up.sql` retains digest references, expiry, tenant-specific authorization, and one-to-one prepaid/order/payment references with forced RLS. Do not store raw sensitive licences or customer details in public/on-chain records.
- Scoped negative tests check revocation, expiry, cross-tenant and municipality confusion, seller/amount/currency mismatches, regulator outages and reversal.
- Targeted workflow: `.github/workflows/doobr-r02-3-level1.yml` on exact implementation SHA.

## Explicit outstanding exit criteria
1. Verify that current independent 420Identity/Verify/Registry and BC regulator-accepted retailer evidence sources actually support authoritative licence and municipal scope, issuer revocation, renewal and independently approved reviewer governance. The current Protocol fixtures are **not live verification**.
2. Connect the seller-of-record order adapter to a genuine retailer source and canonical 420Pay prepaid confirmation/reversal feed; prove signature/authentication, transaction finality, stale/replay/duplicate callback resistance and recovery.
3. Add durable transaction-side API/service enforcement so each order admission binds approved licence, municipality, retail site, retailer actor, the exact order and retailer-prepaid evidence atomically; prevent race-condition admissions after licence revocation or proof reversal.
4. Complete transaction-integrated negative paths and tenant-isolated restricted-role database tests, migration reversal/recovery and exact-SHA CI success, then commit passing Level 1 evidence.
5. Reconcile production regulatory interpretation and partner signoffs via 420Compliance and official sources prior to testnet/live acceptance. Unapproved BC/Vancouver candidate details are not operative rules.

## Qualification
Pending targeted CI completion and additional repository integration work. R02.13 Level 2 and R05.10 Level 3 remain deferred. No claims of live licence, retail merchant or payment authorization. Current `main` diverged from this branch during initial reconciliation; preserve phase-based integration policy and do not merge PR #601 now.
