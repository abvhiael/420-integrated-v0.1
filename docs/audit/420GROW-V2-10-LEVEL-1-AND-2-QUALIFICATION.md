# GROW-V2-10 — Level 1 and accumulated Level 2 qualification

**Status: COMPLETE for audit-phase Level 1 and app integration Level 2; not a release or regulatory certification.**

- **Step:** GROW-V2-10 — Inventory, traceability and compliance exports.
- **Exact implementation candidate:** `5e05b171bf09edb011f6dd0f1ad8ee30f53f4fd1`.
- **Original main/merge base:** `ffc6a4028676907c266714b5c1ae8ba3af9a7137`.
- **PR/branch:** [#582](https://github.com/abvhiael/420-integrated-v0.1/pull/582), `audit/420grow-v2-01-product-decision-20261008`, draft/unmerged.
- **V2 fast:** [run 37880126261](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37880126261), **SUCCESS** on exact implementation SHA; inventory Go unit/race/vet/format, real PostgreSQL immutable ledger, replay, tenant RLS, nonnegative balance and transfer integrity, accumulated V2-06–10 package integration.
- **Retained original Grow fast:** [run 37880126176](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37880126176), **SUCCESS** on the same SHA.
- **Scope:** versioned private inventory lots preserve the pre-existing `inventory_lots`/`inventory_movements` reservation tables; new `inventory_lots_v2` and `inventory_ledger_v2`, immutable reason/actor/time/source audit, idempotency, bounded nonnegative balances, paired custody moves, harvest-to-observed-source provenance, internal CSV export with jurisdiction selectors and `INTERNAL_UNVERIFIED` label, tenant scope and role checks.
- **Files:** `grow/inventory/{service,postgres,service_test}.go`, `grow/inventory/qualify.sql`, `grow/storage/migrations/0009_inventory_ledger.up.sql`, `scripts/grow-v2-migrate.py`, `.github/workflows/420grow-v2-fast.yml`, [implementation contract](420GROW-V2-10-INVENTORY-TRACEABILITY-EXPORTS.md).
- **Adversarial coverage:** counterfeit cross-tenant ownership, unauthorized export, duplicate movement/replay, negative/fractional units, ledger alteration, unpaired transfers, harvest-parent linkage and invalid input rejection.
- **Level 2:** **COMPLETE**, accumulated V2-06–10 integration at the designated milestone, not a full repository test.
- **Deliberately deferred:** true regulator-specific certifications, official submissions, live operator data, deployment, and final phase Level 3 (V2-15); production-equivalent testnet (V2-16). This is an internal provenance export, not a legally certified filing.
- **Revalidation:** V2-11 later added the `0010` migration and AI app package; [Grow V2 run 37884405196](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37884405196) re-passed all retained V2-10 gates as part of the V2-11 implementation SHA `f93dc2faf76809f7ba20357ef945574edf4a1b39`. No independent full Foundry/Genesis inventory was performed.
- **Next canonical step:** GROW-V2-11 — AI-assisted analysis and human-reviewed recommendations.

This file is historical durable qualification evidence. The implementation SHA above remains distinct from later audit steps and evidence-only documentation commits.
