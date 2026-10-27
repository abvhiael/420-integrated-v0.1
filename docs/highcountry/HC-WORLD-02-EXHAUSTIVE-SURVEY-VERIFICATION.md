# HC-WORLD-02 — Exhaustive physical survey verification

Baseline: PR #869 merged `d4e0887138deebc8bbf54c1969a9704802129703`; PR #876 provides separately scoped parcel access validation. No originally approved parcel sizes, identities, counts, zoning percentages, or existing tests were changed.

## Reproducible final-survey validation contract

`scripts/highcountry/hc-world-02-full-survey.mjs` consumes a complete `HC.WORLD.ALL.REGIONS.SURVEY.V1` JSON object containing precisely three `HC.WORLD.REGIONAL.SURVEY.V1` records. Its input **must contain actual surveyed parcel placements** for all 31,260 titles. Each region carries a source terrain SHA256, approved geometry and explicit approval evidence; land masks, mutually exclusive zoned rectangles, mapped exclusions, heritage geometries, a connected road graph, road surface rectangles, and per-title frontage or registered easement evidence.

The verifier validates each original ID, classification, footprint, municipality and 10,420-per-region title count. It rejects parcel overlaps, map-boundary errors, forbidden intersections, unapproved terrain, missing provenance, zoning area drift from 65/10/10/10/5, disconnected road junctions, missing exact frontage, missing easement registration, and any title already issued or transferred.

Example CLI: `node scripts/highcountry/hc-world-02-full-survey.mjs /path/to/owner-approved-complete-three-region-survey.json`.

## Outstanding source data and qualification boundary

No authoritative owner-approved terrain raster/vector maps, physically surveyed access corridors, measured heritage polygons or complete placements for all 31,260 parcels were present in the source baseline. The draft county atlas contains **invented design coordinates** and is explicitly not field-surveyed; those coordinates cannot truthfully be marked owner-approved. Existing 31,260 schematic rectangles also fail access admission.

Accordingly, this PR implements the **full evidence contract and exhaustive validator**, but does **not** assert that a complete 31,260-parcel real atlas has been surveyed or certified. Final milestone closeout needs 3 approved source-hashed regional terrain datasets; regenerated, terrain-fitted parcel geometry for all titles; surveyed roads and heritage buffers; and successful whole-world verification on the exact resulting SHA.

The new scoped test suite exercises fail-closed states. Unit-test green is not whole-world geographic certification. No Genesis issuance or ownership actions permitted.
