# HC-PLACE-03 — Package 5 exit-criteria audit and reconciliation

## Scope and decision

HC-PLACE-03 is the **server-only durable placement transaction and inventory-coordination foundation**, as assigned by `docs/highcountry/HC-PLACE-01-ARCHITECTURE-BASELINE.md`. Its qualification does not turn on gameplay placement routes. The separate HC-PLACE-04 geometry/occupancy authority, HC-PLACE-05/06 attachment geometry, HC-PLACE-08 access, HC-PLACE-09 movement and HC-PLACE-11 API remain independent downstream gates.

## Package 1–4 implementation evidence

- Placement operations, expected revisions, immutable idempotency receipts, stored instance and scene state, owner/authority checks: `src/placement-transactions.js`.
- Qualified independent authority and commit-time signed epoch/parcel revocation: `src/placement-production-authority.js` and `src/placement-authority-registry.js`.
- Exact custody units, reservations, release, market settlement and conservation: `src/custody-records.js`, `src/market.js`, `src/buds-ledger.js`, `src/placement-instance-transfer.js`.
- Durable PostgreSQL encoding, restart recovery, row locking, bounded SQLSTATE 40001 full-transaction retry and nonreplay of ambiguous COMMIT acknowledgments: `src/postgres-store.js` and `src/placement-recovery.js`.
- Server-only composition shares the production ordinary-market store and runtime authority, rejects incomplete wiring; no public placement HTTP mutation route: `src/runtime-service.js`.
- Authoritative geometry, rendering footprint and future client API admission remain disabled and are **not** claimed as HC-PLACE-03 production enablement.

All source paths above are relative to `services/highcountry-economy`.

## Exact-SHA qualification

Package 4 exact-SHA candidate `79bacbb3c7f531059f4d39ea50d22869da0e76c7`:

| Qualification | GitHub Actions run | Outcome |
| --- | --- | --- |
| Authority lifecycle L1; includes server composition boundaries | 41000314497 | Success |
| Placement transactions L1 | 41000314573 | Success |
| PostgreSQL authority L2 | 41000314538 | Success |
| Custody L1 | 41000314661 | Success |
| Exact custody L1 | 41000314640 | Success |
| Economic invariants L1 | 41000314448 | Success |
| Cross-module PostgreSQL B5 L2 | 41000314528 | Success |

Earlier qualified PostgreSQL retry candidate `af404735c08bd971c980955ce3ae8b120d6fa5e3`: manually targeted exact-SHA PostgreSQL B5 run `40996881384`, job `123871955295`, 8/8 tests passed.

## Reconciliation

Reconciled onto the main revision used as the other merge parent of this package's audit commit. Verified there were no overlapping paths in commits landing on main after the last source reconciliation. No HC-PLACE runtime, test, fixture, pricing, asset or workflow source is changed by Package 5. Therefore the recorded exact-SHA source tests are preserved; no redundant CI is requested for a documentation-only merge reconciliation.

## Exit and remaining authority boundaries

The HC-PLACE-03 transaction-foundation implementation and its scoped qualification are complete; this does **not** certify real testnet authority feeds, production TLS/operator key deployment, owner-approved geometry or any placement game endpoint. PR #887 remains an isolated aggregate work branch until an explicit final merge decision. No downstream HC-PLACE packages are implicitly qualified.
