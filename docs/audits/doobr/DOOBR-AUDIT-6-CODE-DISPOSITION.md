# DOOBR-AUDIT-6 — implement missing functionality required by the confirmed specification

Status: **scope-complete (no application runtime changes authorized or required); Level 1 qualification pending**.
Date: 2026-10-09.
PR #598; current inspected main `f8bbb62e1cdfe68cff25261fd4a036db1840a15c`.

## Controlling specification and exit criteria
The operative, repository-approved requirement for DOOBR at Genesis is the GEN-SVC-3.9 **forward-compatible schema only**, with **no delivery, payment, escrow, settlement or booking transaction execution**. Sources: `docs/genesis-services/GEN-SVC-3-TRAVEL.md`, `config/420travel-genesis.json`, `config/genesis-consumer-services.json`, `config/genesis-applications.json`, `genesis/svc3/travelapp/COMPATIBILITY.md` and `compatibility.go`. AUDIT-2 and AUDIT-5 explicitly found no approved independent DOOBR product/service or deployable financial/delivery authority.

A hypothetical standalone service would require a **new explicit approval** (scope, regulator/jurisdiction, independent identity, provider credential root, payment and settlement authorities, privacy, safety and live operations). The conditional AUDIT-5 proposal is NOT an implementation authorization. This step must not invent such authorization or describe the absent product as presently required implementation.

## Code gap decision
| Requirement of *confirmed* scope | Existing implementation | Remaining permitted code work |
| --- | --- | --- |
| Four DOOBR compatibility objects | `ServiceProvider`, `ServiceArea`, `DeliveryWindow`, `ServiceRequest` in `compatibility.go` | None; valid structural validators and tests retained |
| Schema versions, IDs, provider consistency, intervals | Existing `Validate()` methods | None identified by AUDIT-3 and targeted regression coverage |
| Booking/payment/delivery denied at Genesis | `GenesisTravelTransactions` returns `ErrTravelTransactionDisabled` for all seven operations | No implementation change; preserve fail-closed |
| Default-off DOOBR feature and deferred scope | Travel and consumer-service configs | No enabling or service registration |
| Independent delivery app, licensed fulfillment, wallet checkout, refunds | Not approved in frozen catalog or consumer service registry | **Not in approved implementation scope**, not a code defect |
| Integration and security design for future service | AUDIT-5 conditional interface and release gates | Documented; remains gated |

## Implementation outcome
**Intentionally no production code, contracts, deployment or config changes.** Adding an independent DOOBR runtime, transport handlers, payment integration or delivery operations under the current frozen authority would be an unauthorized semantic expansion, not remediation. Prior valid and qualified compatibility work remains intact.

This step adds only a machine-checkable static scope verifier and app-scoped exact-SHA CI proof that the existing code still satisfies the current confirmed specification. Do not mark the hypothetical standalone product implemented.

## Level 1 and exit
- Run `scripts/verify-doobr-audit-6.py` against the exact candidate SHA.
- Retain GEN-SVC-0, GEN-SVC-3 and AUDIT-2/5 validators, noncached DOOBR boundary regressions, affected Go tests, vet and build.
- Confirm immutable Genesis/application catalog and no DOOBR transaction operations enabled.
- Mark **DOOBR-AUDIT-6 complete in the current approved compatibility-only scope** only after those checks pass and evidence is committed.
- Independent DOOBR development remains **BLOCKED on explicit authorization**; do not describe the independent app as release-ready.
- Level 2 not triggered (no cross-component implementation). Level 3 deferred to app phase closeout; unrelated Cloudflare builds excluded.

Next canonical proposed step: `DOOBR-AUDIT-7 — Security and adversarial verification of the confirmed DOOBR scope` (verify roadmap authority before proceeding).
