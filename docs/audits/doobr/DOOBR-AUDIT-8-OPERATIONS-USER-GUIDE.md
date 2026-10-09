# DOOBR-AUDIT-8 — Deployment, operations, environment and user guide

**Status:** Documented for the approved Genesis **compatibility-only** scope; Level 1 CI pending.
**PR:** #598. **Main baseline inspected:** `f8bbb62e1cdfe68cff25261fd4a036db1840a15c`.

## What DOOBR currently is (user guide)
DOOBR is **not** an available standalone delivery app in this repository's approved Genesis implementation. 420Travel retains four forward-compatibility record types for potential future DOOBR integration: `ServiceProvider`, `ServiceArea`, `DeliveryWindow`, `ServiceRequest`. These records are structural metadata, not a verified seller, delivery quote, reservation, or legal delivery entitlement. A user cannot book a delivery, pay, track a courier, or request a refund through these Genesis hooks. Do not display compatibility objects as live delivery inventory or claim that a transaction succeeded.

420Travel's currently defined routes are `/travel`, `/travel/map`, `/travel/place/:place_id`, `/travel/events`, `/travel/trips`, and `/travel/business/claim`; **none** is a DOOBR transaction route. Availability, payment, delivery, and settlement are not implied by travel search results or cannabis-related location metadata.

## Developer reference
- Authority: `config/genesis-applications.json` (frozen app catalog); `config/genesis-consumer-services.json` (non-promoting consumer services and `travel.doobr_transactions=false`); `config/420travel-genesis.json` (`doobr_compatibility.enabled_at_genesis=false`, deferred `DOOBR_TRANSACTION_FLOWS`).
- Go namespace: `genesis/svc3/travelapp`, `TravelCompatibilityVersion=travel-compat/v1`. Four types define JSON fields and structural `Validate()` methods.
- `GenesisTravelTransactions` exposes seven **disabled** methods: `Reserve`, `Quote`, `Pay`, `Escrow`, `CancelAndSettle`, `RequestDelivery`, `DynamicPrice`. All return `ErrTravelTransactionDisabled` regardless of supplied identity refs, payload, or context.
- `ServiceArea` stores coarse region/country, not delivery addresses. `IdentityRef` and `RequesterIdentityRef` are untrusted references, not proof of user authentication, age, licensing or legal jurisdiction.
- Interface additions, payment hooks and a standalone DOOBR namespace require separate governance approval. Do not interpret this guide as permission to create an active service or flip a flag.

## Deployment and environment
- **No standalone DOOBR build target, daemon, deploy manifest, approved hostname, secrets schema, provider credentials, on-chain DOOBR address or environment variables have been established by this audit.** Do not fabricate deployment commands, URLs, required secrets or an operational endpoint.
- Existing 420Travel scope is built with `go build -o /tmp/420travel ./cmd/420travel`; this builds the **Travel server**, not a DOOBR delivery service. The audit does not authorize deploying Travel as DOOBR.
- The enabled/disabled source of truth is the canonical JSON configuration; both `doobr_compatibility.enabled_at_genesis` and `travel.doobr_transactions` must remain false. Reject startup/deployment if either is enabled without an independently approved and qualified specification.
- For development and CI, use `python3 scripts/validate-gen-svc-0.py`, `python3 scripts/validate-gen-svc-3.py`, `python3 scripts/verify-doobr-audit-2.py`, `python3 scripts/verify-doobr-audit-5.py`, `python3 scripts/verify-doobr-audit-6.py`, targeted Go tests in `genesis/svc3/travelapp`, `go vet`, and the Travel server build. The app-scoped workflow is `.github/workflows/doobr-audit-1-level1.yml`.
- CI checks out the exact GitHub commit and must pass required validation at that SHA. Do not substitute queued, skipped or failed jobs; evidence-only documentation commits retain their earlier tested source SHA.

## Operations and incident runbook
1. **Preflight:** verify frozen catalog unchanged, transaction feature default false, Travel compatibility flag false and all seven methods still return the disabled error. Confirm no independent DOOBR route/provider connection or transaction work queue was introduced.
2. **Health/monitoring:** use normal existing 420Travel observability where present. This audit does **not** establish DOOBR-specific metrics, logs, dashboards, alerts, SLOs, health endpoint, pager rotation or incident owner; no such coverage should be claimed.
3. **Unauthorized activity or unexpected live transaction:** stop the violating integration/deployment through the responsible service owner; preserve logs without exposing personal records, notify security/governance owners, reconcile independently authorized Pay/Wallet/settlement records if actual funds moved. Never try to "repair" with unreviewed direct transfers.
4. **External identity/provider outage:** remain fail-closed. Do not assume compatibility references authenticate users or license providers. No automatic order retry/fulfillment exists in current scope.
5. **Privacy incident:** do not write home addresses, credentials or private identity proof into public search, indexes, on-chain objects, screenshots or tickets. Follow applicable incident handling and retention obligations of the underlying authority service.
6. **Recovery/rollback:** revert any unapproved service/flag change to last qualified frozen config and compatible source; verify the fail-closed gateway and negative tests, and reconcile side effects separately if an unauthorized live adapter existed. No standalone DOOBR data store or backup procedure exists to restore.
7. **Change control:** implementation/config/workflow changes require new exact-SHA scoped qualification; Level 2 at material milestones and Level 3 only at audit-phase closeout.

## Security, privacy and externally gated acceptance
- Current guarantees: structural validation and unconditional transaction denial. No public delivery-address indexing or funds custody originates from this compatibility package.
- **Not currently certified:** real authentication, credential revocation, provider/regulator licensing, regional age limits, approved payment/refund/escrow reconciliation, webhook retry/idempotency, consumer support, mobile or browser delivery journeys, data export/deletion workflows, external service recovery and operator acceptance.
- Independent DOOBR launch needs explicit approved scope, owners, deployment manifests, encrypted secrets/credential rotation, provider adapter contracts, DB/migration/backup/restore procedures, health and incident alerts, jurisdiction policy and end-to-end testnet qualification. This remains a future work gate, **not** an excuse to flip a disabled Genesis flag.
- No environment promotion, testnet deployment or live external acceptance is required for this documentation-only step in the existing compatibility scope.

## Evidence and completion criteria
Documentation covers (1) current user-facing limits, (2) technical interfaces and dependencies, (3) deployment/environment truth, (4) operations/incident/recovery, (5) privacy/security and external integration gates, (6) qualification and rollback rules. Qualification must validate these claims and the actual configuration at one SHA. Broader Level 2 not triggered; Level 3 intentionally deferred.
