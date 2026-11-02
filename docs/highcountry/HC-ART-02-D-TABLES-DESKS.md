# HC-ART-02-D — Tables, desks and personal workspaces

Implemented in the existing furniture catalogue PR. Ten uploaded universal PNGs are referenced by `apps/highcountry-web/src/tables-desks-catalog.js` and shown on `/marketplace`, including offline browsing. Each record binds its canonical path, SHA-256, 1024×1024 source size, alpha content bounds, region/environment availability and layout metadata.

All three regions share the sprites. Indoor and greenhouse use are enabled in design metadata. Logical layout footprints use 64px tiles: rustic coffee table 2×1, round coffee table 2×2, end table 1×1, console 3×1, sideboard 3×1, writing desk 2×1, corner workstation 3×2, planning desk 2×2, communal table 3×2, secretary 2×1. These are initial layout design values, not an assertion that the visual master specified pixel sizes or that server parcel collision rights exist. Access-clearance labels are advisory and do not implement collision enforcement.

Placement helpers return bottom-center ground contact at (512,960), normalized anchor (0.5,0.9375), instead of the padded canvas bottom. The style helper uses a common square source-canvas scale in 1920×1080 scene coordinates, preserving relative object sizes. Placement metadata does not persist a layout or authorize item ownership, parcel rights or progression bonuses.

Marketplace entries are artwork records with `marketStatus: not-registered`. No BUDS price, sale, issuance or bonus is fabricated. Existing authenticated listing and settlement paths remain authoritative. Actual purchasable furniture requires separately authorized server item registration and owned inventory.

The build now includes all catalogue dependencies imported by the marketplace. Existing seating artwork status is reconciled to the twelve PNG paths verified on main. Marketplace regression tests locate the authenticated market section by its accessible label rather than its former child index.

## Scoped Level 1 evidence

- `node --test apps/highcountry-web/test/hc-art-*.test.mjs apps/highcountry-web/test/hc-next-4-4-marketplace.test.mjs`: 20/20 passing.
- `node apps/highcountry-web/scripts/build.mjs`: passing. Original-sixteen A06 assets are outside this sparse checkout; its output correctly reports pending assets. This run does not qualify A06.
- Built bundle: all 21 transitive browser module imports resolve; all ten copied furniture PNGs match source bytes.
- Uploaded PNGs: verified RGBA headers, 1024×1024 dimensions, exact SHA-256 and ground-contact alpha bounds.
- No unrelated global CI or live purchase qualification claimed. No browser visual qualification was run in this step.
