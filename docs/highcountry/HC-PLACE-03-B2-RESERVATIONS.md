# HC-PLACE-03-B.2 — Atomic placement reservations

Status: implementation pending exact-SHA Level 1 and affected PostgreSQL Level 2 verification.

Placement admission no longer treats owner/asset aggregate `available` as sufficient evidence. Inside `PostgresBudsStore.transact`, `reservePlacementUnit` deterministically selects one available unit from verified custody receipt lineage, binds an exclusive `place:<instanceId>` reservation, advances the unit revision, and updates the existing available/reserved economic balance. Replays return the retained receipt without selecting a new unit. Competing commands serialize on the same database row.

Removal calls `releasePlacementUnit` with the original placed instance reference and requires exact owner/asset/unit/reservation identity, then advances the unit revision and reverses the inventory movement in the same commit. Missing, forged, reused and mismatched reservations fail without persisting a partial world or balance mutation. No implicit promotion of legacy aggregate balances to verified units.

Qualification owners: HC-PLACE-03 Transactions Level 1 (unit, replay, collision, wrong release and double allocation), HC-PLACE-03-A Authority Level 2 (PostgreSQL serialized placement, rollback and restart receipts), and HC-PLACE-03-B1 Custody Level 1 (issuer/lineage and invariants). Preserve previous passing qualification on earlier SHAs as historical evidence only.

B.2 does not enable market listing, settlement or custody migration; those cross-module transitions remain exclusively B.3/B.4/B.5. The placement command engine remains private and without production HTTP exposure. For safety, its reservation interface is not exposed to untrusted clients.

Qualification/merge evidence is **not** valid until the new implementation SHA passes directly owned suites and the branch divergence with current main is reconciled.
