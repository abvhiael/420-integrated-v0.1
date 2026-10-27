# HC-PLACE-03 — durable placement transaction foundation
Status: **PARTIAL IMPLEMENTATION — NOT QUALIFIED FOR PRODUCTION ENABLEMENT**.

This draft introduces `HighCountryPlacementTransactions`, serializable placementInstances/placementOperations/placementScenes fields in the existing High Country Postgres economy state, and bounded transactional fixture tests. The existing market assets ledger is reserved and released within the same `PostgresBudsStore.transact` callback that writes placed-object records, scene revisions and operation receipts. Failed callbacks roll back. Replay keys are scoped by authenticated principal and payload digest. A process restart using the same persisted Postgres row restores records and idempotency receipts; production restart tests and physical DB multi-worker contention are still required.

**Security limits / blocking dependencies:**
- Trusted `registeredPrincipal`, `canPlaceOnParcel`, `validateWorld`, `qualifiedGeometrySnapshot`, canonical asset IDs and geometry resolution MUST come from independent server authority. No supplied browser flag is proof of rights.
- The evidence and geometry snapshot currently arrive before the transaction and are not bound to a durable world revision checked under the same lock. This is a TOCTOU risk and prevents operational admission until fixed.
- The existing economic `assets` ledger is fungible by owner/asset, not instance provenance; production must certify unique item issuance, custody/reservations, and double-use across other market routes.
- Collision coverage here handles qualified floor tile geometry and attachment slot exclusivity only; HC-PLACE-04/05/06/08/09 provide full masks, anchor permissions, terrain, paths and navigation. Parent transformations, safe detach and full restore are not enabled.
- `remove` moves an object into stored state. Restoring a stored instance and intentional transfer are not implemented yet. No HTTP endpoints have been exposed.
- Testing with a synchronous transactional test store does not prove PostgreSQL failure injection, restart recovery, process races, or deployed production wiring.
- The constructor deliberately fails closed when provider dependencies are missing; do not enable routes while these requirements remain outstanding.

Preserve 64px coordinate convention and all existing catalogue IDs, BUDS prices, asset sources and HC-WORLD-02 protections. Never market this milestone as complete until bounded Level 2 integration and adversarial checks plus real PostgreSQL recovery evidence pass.
