# DOOBr R04.1 — Canonical authority reuse inventory

**Canonical step:** R04.1 — Reuse inventory: no new contract if canonical authority already exists.
**Branch:** `roadmap/doobr-bc-vancouver-infrastructure` · **PR:** #601 (unmerged)
**Main/base SHA inspected:** `835e9ec8a43481f65f0b68ae83b399743efee5b2`. Branch at inspection: 332 commits ahead, 1108 behind. This is not R05.10 reconciliation.
**Level:** 1, app-scoped source inventory and frozen gateway checks.

## Authority ownership — reuse rather than duplicate

| Concern | Canonical owner | DOOBr boundary |
| --- | --- | --- |
| Identity, sessions, issuer and role provenance | 420Identity, 420Verify, 420Registry | Consume trusted identity/verification and revoke; do not self-issue credentials |
| Legal and carrier policy | 420Compliance | Consume signed/versioned jurisdiction decisions; no local policy override |
| Place discovery, coarse region and maps | 420Location / 420Search | Receive only coarse public availability; no exact location in 420Travel |
| Settlement, payment receipts, prepaid order validation | 420Pay | Verify retailer-authorized prepaid settlement; never mint/custody/escrow |
| User approval and consent | 420Wallet | Reuse canonical consent/session permissions, never invent wallet signing |
| Messaging/notices | 420Notifications | Canonical notification transport; DOOBr emits approved references |
| Disputes | 420Arbitration | Route dispute evidence to canonical authority, no local competing arbitration |
| Public consumer presence | 420Travel replacement service | Informational-only card/deep-link; no embedded checkout or courier tracking |
| Delivery runtime/order lifecycle | DOOBr off-chain application | No new genesis application or on-chain transaction authority |

These are **authority boundaries**, not evidence that deployed authenticated services, licenses or approved contracts exist. Independent approval of any on-chain reference/attestation surface belongs to later R04 steps. R04.1 creates **no Solidity contract**, no address/predeploy, no frozen application, and no authority-bearing service.

## Repository evidence and guard

- `config/genesis-applications.json`: frozen application decision.
- `config/genesis-consumer-services.json`: consumer services do not silently promote genesis applications.
- `config/420travel-genesis.json`: Travel replaceable application and DOOBr transaction flows deferred.
- `docs/genesis-services/GEN-SVC-3-TRAVEL.md`: discovery/planning scope, not embedded transactions.
- `genesis/svc3/travelapp/compatibility.go`: **all seven** `GenesisTravelTransactions` operations (`Reserve`, `Quote`, `Pay`, `Escrow`, `CancelAndSettle`, `RequestDelivery`, `DynamicPrice`) fail with `ErrTravelTransactionDisabled`.
- `docs/doobr/DOOBR-R01-R06-ROADMAP.md`: canonical reuse, seller-of-record and disabled policy override.
- `doobr/travel_card.py`: coarse verified presence projection, restricted handoff, hard-failed checkout.
- `scripts/verify-doobr-r04-1.py`: source guard validating catalog freeze, consumer policy, Travel non-promotion, deferred DOOBr transaction scope, canonical authority mention, all seven disabled gateway methods and checkout denial.
- `.github/workflows/doobr-r04-1-level1.yml`: targeted exact SHA pre/post + deterministic Python inventory verifier.

## Qualification status

**Implementation SHA:** `c72cd70ebb20fb3c99f12d996046063c1436e2a5`; **PASS** — GitHub Actions run #38302927304, job #114989977929 (`reuse`) completed successfully with zero failed steps, at exact implementation SHA. Evidence-only commits may reference this SHA if they change no executable/config/test content. No global Foundry, Genesis, Docs or Solidity inventories are required at R04.1. Existing R03.12 clients/Travel Level 2 remains qualified only for its recorded implementation SHA and does not qualify a different executable SHA by inheritance.

**Deferrals:** live credential/registry authority, independently approved retailer/license/carrier policy, financial gateway/provider settlement, real deployed contract/address validity, and regulated business acceptance remain under R06 and DOOBR-AUDIT-9/10, not represented as implemented or authorized.

**Exit criteria:** authoritative reuse mapping recorded; no new canonical contract; frozen catalogue/gateway unchanged and fail-closed; exact-SHA targeted verifier PASS; evidence committed; no move to R04.2 until checked.
**Next canonical step:** R04.2 Only approved provider credential/registry reference contract/adapter.
