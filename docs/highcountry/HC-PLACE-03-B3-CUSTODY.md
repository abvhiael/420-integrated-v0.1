# HC-PLACE-03-B.3 — Exact-unit marketplace and transfer integration

The market now creates per-unit custody records from verified inventory receipts, deterministically reserves unique units for listings, and binds listing receipts to those unit IDs. Purchases transfer precisely the listed units into buyer custody in the same serializable transaction as BUDS settlement. Cancellation and expiry release only their own reservations. The qualified placement allocator excludes listed units, and market selection excludes placed units.

Canonical settlement retains independent on-chain finality proof and durable prepared intents. Finalized canonical transfers mark escrow units `exited` instead of creating a duplicate off-chain buyer entitlement. Closure and proven nonexecution release the escrow mirror without inventing buyer inventory. Every escrowed unit retains immutable source receipt and revision lineage; the active reservation is per unit.

This step does not relax previously enforced canonical receipt checks, deterministic transfer operation IDs, wallet/identity binding, or the independent cancellation proof. Current market issuance remains limited to one verified source receipt per owner/asset bucket; mixed provenance migration remains later economic integration work.

Level 1 owner: `.github/workflows/highcountry-hc-place-03b3-l1.yml`. Full real PostgreSQL cross-module qualification is B.5; full economic invariants B.4. Neither is represented as completed by this step.
