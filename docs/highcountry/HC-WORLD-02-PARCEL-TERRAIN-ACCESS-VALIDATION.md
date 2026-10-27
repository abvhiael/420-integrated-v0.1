# HC-WORLD-02 — Terrain-aware parcel access implementation (bounded verification)

**Baseline:** merged PR #869, merge SHA `d4e0887138deebc8bbf54c1969a9704802129703`. All existing 31,260 parcel IDs and approved rural/urban/commercial counts remain unchanged.

`scripts/highcountry/hc-world-02-parcel-access.mjs` provides fail-closed region physical-survey admission:
- Owner-approved, source-hashed terrain survey required; a synthetic geographic planning grid is never sufficient.
- Every surveyed parcel must fit within the authorized allocatable polygon, avoid environmental exclusion rectangles and Original Sixteen protected boundaries.
- Each parcel must have a physically adjacent, positive-length frontage to a road surface, or authenticated recorded easement; corner-only touching is rejected.
- Road surfaces must belong to the connected graph reachable from approved roots; unauthorized/disconnected roads fail.
- Every parcel needs unique access evidence; IDs, non-issuance and null ownership remain enforced.
- A bounded baseline audit returns **31,260 blocked** synthetic reservations (the correct result until source-backed map surveys and parcel placements are available).

The included **12 targeted unit/adversarial tests** exercise successful fixture cases and fail-closed exclusion/access/admission cases. These isolated fixtures test the verifier algorithm; they are NOT actual approved county surveys or proof that every real-world-model parcel has connected frontage.

## Outstanding for a genuine all-parcels survey
1. Supply verifiable, owner-approved county masks for EC, GP and RM, with complete terrain-source hashes and the locked physical landmark geometries.
2. Replace the synthetic parcel bounding boxes in the generated inventory with source-tied cadastral positions while retaining immutable parcel IDs, footprints, inventories, non-overlap and heritage exclusions.
3. Produce county road surfaces, actual centerline geometry, junctions, traversal edges, valid roots and frontage or registrable easement evidence for each parcel.
4. Check terrain-aware land-area allocation (65/10/10/10/5) on a disjoint surveyed allocatable mask, rather than only the currently passing synthetic bands.
5. Qualify the **complete** 31,260-parcel instance against that independent physical survey evidence and document final SHA/run IDs.

**Milestone remains OPEN.** This scoped module strengthens checks but does not issue titles or upgrade draft atlases to owner-approved surveyed geography. Keep unrelated historical CI results; run only the relevant HC-WORLD-02 Level 1 test additions for this branch.
