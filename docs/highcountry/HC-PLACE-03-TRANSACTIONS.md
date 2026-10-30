# HC-PLACE-03 — Durable placement transaction foundation

Status: **IMPLEMENTED IN BRANCH; SCOPED LEVEL 1/2 QUALIFIED; NOT QUALIFIED FOR PRODUCTION ENABLEMENT OR PHASE CLOSEOUT.**

## Implemented and qualified in branch

- `HighCountryPlacementTransactions` persists placement instances, operation receipts and scene revisions in serializable PostgreSQL state; individual inventory custody is reserved/released under the same transaction and rolled back on failure.
- Independent parcel/world authority admission is checked against locked authoritative revisions, evidence IDs, geometry qualification and authenticated runtime session epochs at commit. Operator provisioning, revocation and verified, contiguous event ordering are implemented with fail-closed guards.
- Canonical individual custody-unit issuance/reservation, exact-unit stored-instance restoration, marketplace coordination, economic conservation and PostgreSQL cross-module tests are implemented.
- Intentional **stored-instance-only** ownership transfer requires independently verified consent from sender and recipient, live authenticated epochs, exact eligible custody, replay protection and verified ordinary (noncanonical) provenance. Canonical-chain custody transfers are denied without the separate finality-gated path.
- Optional server-side composition forwards `placement` from `createOrdinaryRuntime` through `composeOrdinaryMarketRuntime`; no placement HTTP routes are enabled. Browser previews do not authorize writes.

## Exact-SHA evidence

At `94d0ee5f2dff2d70d596b8eb0e6debc2e94e5880`:
- Ordinary market regression `ordinary runtime requires same identity store and verified inventory receipts`: **PASS**, test 68 in R04 Level 2 economy-service run **40786053482**, job **123159391739** (165 passed, 0 failed); independently **PASS** in R04.5 Level 1 run **40786053525**, job **123159391537** (165 passed, 0 failed). Corrected parameter-forwarding commit: `197fa9e3676937434b9e92e43ba3f211bcbabae5`.
- HC-PLACE-03 transaction L1 **40786053579**; authority PostgreSQL L2 **40786053509**; custody B1 L1 **40786053687**; exact custody B3 L1 **40786053534**; economic invariants B4 L1 **40786053710**; cross-module PostgreSQL B5 L2 **40786053657** (job **123159392201**); authority lifecycle C L1 **40786053630**: all completed successfully.
- This evidence applies to the specified exact SHA. Earlier passing evidence remains historical, not transferable to an executable reconciliation commit.

## Still blocking production/phase closeout

- Complete supporting-parent semantics, typed detach, authoritative geometry/rotation/attachment rules and subsequent HC-PLACE-04–10 cross-phase gates. Current floor/slot checks do not substitute for those phases.
- Server transport/API security and browser integration remain HC-PLACE-11; do **not** enable gameplay placement routes in HC-PLACE-03.
- Confirm remaining restart, failure-injection, authority and source-provenance coverage against repository exit criteria before final phase qualification. Postgres fixture and adversarial tests do not prove production infrastructure.
- Reconcile this branch with current `main` and qualify the reconciled exact SHA before any merge decision.
- Independently provisioned live operator keys, event feeds, chain finality/reorg handling, TLS Postgres recovery and deployment-code hashes remain testnet release gates under `HIGHCOUNTRY-TESTNET-WORK-ROADMAP.md`.

Preserve 64px logical grid, approved footprints, authoritative surveyed coordinates, existing asset IDs and prices, HC-WORLD-02, immutability, inventory conservation and sole-owner governance. No production placement permission is authorized.

## Package 1 — parent/child transaction-side lifecycle (qualification pending)

The HC-PLACE-03 transaction engine now verifies, inside the same serializable custody transaction, that an attachment references an existing parent of the same owner and scene, that active attachments have a placed parent, and that traversed ancestry is acyclic. It rejects support movement, rotation, removal or reattachment while placed descendants depend on the support. It rejects duplicate occupied sibling slots and validates parent-first restore ordering. Typed `detachTarget: 'storage'` moves an attached child into durable stored state, releases its exact reserved unit, and retains its immutable parent/slot association for authorized restoration. Detach-to-floor, dynamic reparenting and wall/tabletop geometry remain fail-closed pending their canonical HC-PLACE-05/06 implementations. Stored descendants also prevent ownership transfer of their support; transferred ownership cannot leave an orphaned different-owner child. All transitions share atomic idempotent operation receipts.

Scoped fixture tests added for parent support mutation rollback, unsupported detach, missing support, actual attached-child storage/restore and exact-unit recovery. **No new exact-SHA CI pass is claimed until completed.** Existing passing runs on the previous reconciliation SHA remain historical evidence.

## Package 4 — internal runtime composition and integration

The optional production/ordinary server composition carries placement only through the trusted
`store` and `identity` instance already used by the market. It rejects a mismatched
identity datastore, missing independent world verifiers, and incomplete geometry/asset
resolver wiring. Its registry, transactions and stored-instance transfer services share the
same durable store and signed runtime authority; no secondary placement ledger or client
permission source is created. An omitted placement configuration keeps the capability absent.

The targeted authority-lifecycle Level 1 integration assertions cover the shared store,
runtime identity, negative wiring and route non-exposure. The established runtime HTTP
server continues to reject direct placement mutation endpoints; HC-PLACE-11 owns any
future authenticated placement transport. This is not a claim of production enablement.
Qualification evidence belongs to the exact resulting SHA; Package 3's passing
B5 PostgreSQL evidence remains on its original SHA.
