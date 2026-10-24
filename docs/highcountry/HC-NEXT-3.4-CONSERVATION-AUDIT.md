# HC-NEXT-3.4 — Inventory and Resource Reconciliation

## Canonical supply identity

For each resource ID, inventory's immutable ResourceLedger enforces:
`issued[id] == availableTotal[id] + reservedTotal[id] + consumed[id]`.
`reconciles(id)` exposes this equality without enumerating holders. A resource type cannot be compared to other types as an amount without an explicitly reviewed recipe conversion. The aggregates are modified only by the InventoryRegistry-controlled movement functions and are updated atomically with owner balances.

- Authorized issuance and one-time harvest imports increase both issued and available.
- Reservation and release move units between available and reserved without changing issued.
- Consumption moves units from available or reserved to consumed, not to another spendable balance.
- Available transfers preserve overall available; reserved transfers move reserved to recipient available.
- Manufacturing reserves exact versioned inputs, consumes them on completed jobs, and issues exact versioned outputs in the same transaction; failure rolls back the whole operation.
- Manufacturing cancellation burns configured losses and refunds the balance; its resource debits must reconcile.
- Equipment manufacture converts inventory output into a single equipment identity via a unique earning, while consuming the corresponding count; repair burns parts and recycling mints its catalogue-authorized recovery output once.

## Findings and deferred release blockers

The reconciliation equation proves **accounting conservation for each SKU**, not physical mass conservation across different recipe SKUs or truthfulness of administrator-granted issuance. Administrator issuer powers and recipe material ratios remain trust assumptions and require a reviewed catalogue/provenance policy.

The InventoryRegistry ledger pools reservations by owner and SKU, not by originating reservation ID. This means generic owner-release functions can release units held for another concurrently active workflow; a later settlement will fail and roll back rather than duplicate stock. Fully preventing cross-workflow collateral substitution requires origin-scoped reservations and migrations of manufacturer/market/utility consumers with compatibility tests. Do not claim custody isolation before this work is completed.

The equipment registry's standalone issuer authority can create a catalogue item without burning inventory if a privileged issuer is configured outside ManufacturedEquipmentIssuer. Production release must restrict that issuer set to independently verified, one-time provenance modules and audit grants on-chain. Utility settlement through the regional coordinator and direct cultivation-update capability require separate denial-of-bypass acceptance.

## Evidence

Focused tests in InventoryRegistry and ManufacturingEngine check aggregates through harvest import, delegated market transfer, reserve/release, manufacturing completion and cancellation. R04 integration remains required for lifecycle recycle/equipment provenance, and fresh exact-SHA Level 1/Level 2 qualifications must be green before merging.
