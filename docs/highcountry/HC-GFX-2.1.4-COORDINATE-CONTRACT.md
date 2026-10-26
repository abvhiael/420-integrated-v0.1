# HC-GFX-2.1.4 — Scene Coordinate Contract v1
Status: implemented visual-only browser preview; scoped qualification pending.

- Schema: `hc-cultivation-scene/v1`.
- Fixed art-space: 1920 × 1080; origin top-left, X right, Y down.
- Optional 80-unit placement guide: 24 horizontal columns × 13.5 vertical rows. **Not** a gameplay collision grid.
- Anchor: bottom-center of each sprite; Z: category band followed by bottom-edge Y. Stable ID breaks exact ties.
- Category art-space widths: beds 400, containers 125, irrigation 110, workstations 340, equipment 170, tall equipment 160; per-sprite width overrides allowed. Aspect ratios are explicit reference ratios pending artwork metadata audit, rather than claiming source pixel normalization.
- Placement uses percentage coordinates so backgrounds and overlays scale together.
- Each of the nine regional scenes uses one of three environment positioning profiles; coordinates are editable example placements, not saved gameplay layout or parcel coordinates.
- Sprite alpha backgrounds are expected, but loaded artwork is not rewritten. Individual files must be reviewed for proper alpha and canonical path.
- Out-of-range coordinates, scales, categories, unknown props and environments are rejected.
- Existing plant-state illustration and gameplay continue separately. No parcel ownership, authorization, wallet, or ledger rights follow from this preview.
- Expected upload roots: `apps/highcountry-web/public/assets/cultivation/props/{containers,irrigation,workstations,tools-equipment}/`.
- Future acceptance: actual per-image geometry/ground-contact calibrations, collision volumes, accessible placement editing, persistence, and authoritative parcel-derived context.
