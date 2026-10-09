# DOOBR-AUDIT-2 — Genesis and consumer-services architecture reconciliation

Date: 2026-10-09
Qualification: Level 1 (architecture/configuration source assurance)
Contemporary main inspected: `f8bbb62e1cdfe68cff25261fd4a036db1840a15c`
Audit branch: `audit/doobr-audit-1-inventory-20261009`
Prior work: `DOOBR-AUDIT-1-INVENTORY.md` in the same PR #598.

## Authority hierarchy / canonical scope

1. `config/genesis-applications.json` is frozen `420-genesis-application-decision-v9`. No `DOOBR` application is listed. Neither a shared-service document nor this audit can add a new Genesis app.
2. `config/genesis-consumer-services.json` is an explicitly non-promoting composition/implementation registry (`420-genesis-consumer-services-v1`). It lists `420/service/travel/v1`, not a standalone `420/service/doobr/v1`; `travel.doobr_transactions` has `genesis_default=false`.
3. `docs/genesis-services/GEN-SVC-0-ROADMAP.md` prohibits implicit catalog promotion. The consumer-services registry does not confer consensus/identity/financial/custodial authority.
4. `docs/genesis-services/GEN-SVC-3-TRAVEL.md`, section GEN-SVC-3.9, defines **only** forward-compatible DOOBR records (`ServiceProvider`, `ServiceArea`, `DeliveryWindow`, `ServiceRequest`) and mandates disabled transaction execution.
5. `config/420travel-genesis.json` independently enforces deferred `DOOBR_TRANSACTION_FLOWS` and `doobr_compatibility.enabled_at_genesis=false`.
6. `genesis/svc3/travelapp/compatibility.go` owns Go records and fail-closed `GenesisTravelTransactions` without payment, escrow, identity or regulated-delivery execution.

## Reconciled decision

**Current authorized scope:** Genesis-facing 420Travel compatibility schema and fail-closed gateway. This is not an authorized standalone DOOBR delivery application, Genesis contract, registry authority or payment service. The word "DOOBR" and its four reserved objects are an integration placeholder rather than delivery-service certification.

**Absent decision, not an implementation defect:** The app-audit request asks whether a full independent DOOBR application exists, but current frozen Genesis and consumer-service architecture do not require or promote it. An independent DOOBR release requires an explicit separate design/release decision and governance review. It is not permissible to mark a hypothetical backend, contract, wallet checkout or website MISSING from the existing Genesis compatibility scope merely because a complete standalone delivery product would need them.

## If a future independent DOOBR scope is approved

- Decide application role and whether post-Genesis or Genesis-facing; an explicit frozen-catalog decision is required for the latter.
- Define legal jurisdictions, provider qualification/license, age/identity and consent checks, restricted-location handling and revocation. Structural validation is **not** authorization.
- Specify service ownership, privacy boundaries, canonical place reference, service area granularity, availability, idempotent request lifecycle and cancellation/return authority.
- Govern custody/payment/refund/arbitration authority through approved Pay/Swap/Registry/Identity/Verify and other dependencies *only when separately authorized*. No application record may manufacture payment or regulatory authority.
- Define APIs, SDK, event provenance, indexer/search privacy, notification visibility, error/replay/recovery paths, audit trail, operational monitoring, deployed testnet acceptance and production risk review.
- Preserve disabled Genesis Travel gateway unless a separately approved adapter with its own verified authority is introduced; do not enable by simply toggling an existing flag.

## Gap matrix

| Requirement | Canonical source | Status | Resolution |
|---|---|---|---|
| Frozen Genesis app remains unchanged | Genesis v9 catalog | COMPLETE | Preserve authority |
| Consumer-services registry is non-promoting | GEN-SVC-0 / config | COMPLETE | Preserve rule |
| Standalone DOOBR service not falsely registered | Consumer services registry | COMPLETE | Do not fabricate ID |
| Genesis delivery transactions fail closed | Travel config/spec/source | COMPLETE at source | Retain existing GEN-SVC-3 runtime evidence; separately qualify changes |
| Four compatibility objects recorded | GEN-SVC-3.9 / Go schema | COMPLETE | Retain compatibility version |
| Production delivery authority | No approved standalone DOOBR specification | BLOCKED | Explicit architecture/governance decision |
| Independent DOOBR deployment | No approved standalone DOOBR scope | NOT APPLICABLE to current Genesis compatibility | Decide post-Genesis release scope |
| Current app architecture reconciliation evidence | This audit + verifier | PARTIAL pending CI | Execute exact-SHA scoped verification |

## Exit criteria and scope
- Verify frozen and consumer registries, Travel config/spec, and Go compatibility fail-closed authority at one SHA.
- Commit a machine-checkable, limited static verifier and record passing exact-SHA CI before COMPLETE.
- No Solidity, address maps, SDKs, contracts, runtime gateways or release flags changed here. Level 2 is not triggered and Level 3 remains deferred.
- Unrelated Cloudflare worker builds are not app-scoped acceptance tests and are excluded without changing required repository protection policies.

Next step: `DOOBR-AUDIT-3 — Audit the four existing Travel compatibility objects, their validators and fail-closed transaction gateway`.
