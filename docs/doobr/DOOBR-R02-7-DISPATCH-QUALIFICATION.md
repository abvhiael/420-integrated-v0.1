# DOOBR R02.7 — Matching, scheduling, offers, assignment, capacity, reassignment and conflicts

Canonical step R02.7. Status: **repository implementation pending exact-SHA Level 1 CI**. PR #601, branch `roadmap/doobr-bc-vancouver-infrastructure`.

## Implemented
- `doobr/dispatch.py` implements a tenant-scoped, operator-authorized private shortlist that ranks live active-courier presence by unreserved capacity/freshness with independent eligibility gates. Shortlisting is advisory; never leaks courier identity or coordinates to the public Travel/Maps projection, and does not reserve capacity.
- Operators issue time-bounded offers only for `RETAILER_READY` orders, with fresh R02.2 signed per-order authorization, authoritative eligibility callback, correct region, active courier, fresh private presence and available unreserved capacity. Revision checks, PostgreSQL serializable isolation, order and courier-presence row locks, and unique active offer constraints deny conflicting mutations.
- Courier-owned, signed, exact-resource `ACCEPT_OFFER` authority is required to accept or decline; decisions are one-time, reject stale/expired offers and foreign actor spoofing, recheck current capacity/eligibility, and atomically reserve capacity and change order state. Rejected or expired offers return the order to `RETAILER_READY`.
- Authorized operator release is limited to pre-pickup `ASSIGNED`; independent reason/eligibility authority required, and PostgreSQL atomically releases capacity, preserves historical offers and returns order to `RETAILER_READY`. Subsequent offer/assignment can use a **new** offer ID. Repeated release fails; pickup, handoff and delivered states cannot be reset by this API.
- `0007_dispatch.up.sql`: composite tenant foreign keys; immutable historical offer references, one active offer per order, one active assignment per order; scoped indexes; forced tenant RLS; no public table grants. Assignment PK is per offer, allowing historical reassignments without overwriting released reservations.
- `test_dispatch.py` covers invalid expiries, units, revisions, identity/action denial. `test_pg_dispatch.py` covers real PostgreSQL restricted nonowner actor access, private matching, offer/accept/replay, capacity contention, release/reassignment, revoked/denied policy, and foreign tenant denial.
- Step-scoped workflow `.github/workflows/doobr-r02-7-level1.yml` compiles, applies canonical migrations 0001–0007, runs targeted tests and RLS assertions, and validates exact SHA. It does not run repository-wide Solidity, Genesis, 420 Integrated or global Docs qualifications.

## Trust boundaries and outstanding requirements
- `eligibility` is an external authoritative 420Compliance/credential/courier/region dependency, simulated in CI and **not verified or deployed**. No service endpoint, approval, employer or courier agreement is invented. The service must revalidate eligibility and capacity during operational dispatch and pickup.
- Operational scheduling windows and route optimization must follow approved legal/carrier policy; the current scheduler chooses among fresh candidates and does not claim real navigation/ETA authority or optimal routes.
- The R02.6 canonical order mutation receipt ledger is **not used by dispatch itself**; dispatch uses its own offer and assignment ledger, order CAS, and serializable transactions. Further unified outbox/change-event and payment/custody reconciliation are assigned to R02.11 and R04, with Level 2 at R02.13 and Level 3 at R05.10.
- Live testnet deployment, external issuer credentials and operator acceptance remain R06 and the explicit DOOBR testnet roadmap. Public delivery remains disabled.
- Do not declare R02.7 complete until exact implementation SHA targeted tests actually PASS and repository evidence records their IDs.

Next canonical step only after R02.7 qualification: **R02.8 — Tracking/navigation, geospatial protection, location permission lifecycle.**
