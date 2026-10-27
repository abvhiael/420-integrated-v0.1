# HC-PLACE-02 — unified placement records and geometry v1
Status: **Implementation committed; Level 1 CI pending.** Depends on merged HC-PLACE-01 PR #883.

Pure server-side model at `services/highcountry-economy/src/placement-contract.js` exports `defineGeometry`, `rotatedCells` and `definePlacedObject`. The model requires an authoritative caller-provided canonical asset ID set; it never derives authority from a client catalogue, quoted asset footprint, wallet flag, or UI placement preflight.

Geometry is keyed to immutable asset ID, geometry ID and revision. It separates source visual pixel dimensions and render anchor from floor occupancy. Qualified physical masks may be a rectangular tile set or irregular cell set with four quarter-turn transforms. Exclusive wall/table/shelf attachment surfaces must use `occupancy.kind=none`. A geometry with `qualified=false` cannot produce placement occupancy. Qualification references in fixtures are not certification for any asset and must not be treated as production approvals.

The record includes instance, asset, player principal, parcel, building, room, region, surface, layer, integer tile position, orientation, render anchor, exact geometry reference, parent/slot, revision, timestamps, operation history references, state and validation revision. Unknown fields, unknown assets, invalid masks, invalid orientations, invalid regions, malformed geometry, stale geometry references and invalid attachments fail closed.

**Not enabled:** This package is not an authenticated placement API, collision resolver, geometry qualification registry, inventory reservation, persistent datastore, road-access verifier, or movement authority. No individual asset is production-approved by this PR. HC-PLACE-03/04 must complete before server mutation. No changes to marketplace semantics, canonical assets or HC-WORLD-02 evidence.
