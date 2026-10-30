# HC-PLACE-03-B.4 — Economic invariants and adversarial qualification

This step hardens the comprehensive custody audit to cover both sides of aggregate accounting. Every non-exited, source-backed unit must reconcile to the associated available/reserved bucket, and every aggregate bucket must reconcile to real units: orphan aggregate balances no longer escape detection. Listed unit reservations must be bound to an active/settling listing with matching owner, asset and unit ID.

The bounded adversarial suite checks BUDS issued-minus-burned conservation alongside custody conservation across place/list/buy/cancel/release; phantom inventory, forged aggregates, orphaned listing bindings, conflicting purchases and operation replay. These are in-memory atomicity tests, not real PostgreSQL concurrent-worker certification. B.5 remains responsible for cross-module PostgreSQL recovery and race evidence.

Qualification owner: `.github/workflows/highcountry-hc-place-03b4-l1.yml`. No global Level 3 is required for this ordinary step.
