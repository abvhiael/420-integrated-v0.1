# BUD-CHAR-01.1 — Character art direction and production standard

**Status:** specification drafted for art-direction approval, not approved production art.

## Existing constraints (qualified foundations)

Characters must fit the Budtender illustrated starter-shop scene, preserve the store's original image files and composition, and use `09_CUSTOMERS` and `10_STAFF` of the exact 15-layer Phase 3.18 occlusion hierarchy. Phase 3.19's seven export categories remain unchanged pending explicit extension. All sprites must be presentation-only, never generating customers or transactions.

## Proposed baseline — requires visual approval

- **View:** storefront-compatible 2D cutouts with consistent perspective, no camera rotation between poses.
- **Canvas:** 256 × 384 RGBA PNG per full-body frame; transparent exterior, no baked scene shadows; maintain a fixed baseline anchor at x=128, y=368; leave 16 px safety padding inside canvas. Proportions fit the current storefront at CSS scale; adjust only through an approved versioned change.
- **Facing:** front, left and right are separate authored poses. Do not rely on mirroring where badges, text, handedness or asymmetrical clothing would reverse incorrectly.
- **Style:** clear silhouette at small viewport, bounded dark outlines, restrained highlights consistent with forest-green/walnut/gold storefront; avoid photoreal portraits or disjoint cartoon proportions. Colours are guidance, not proof of approved palette swatches.
- **Lighting:** soft upper-front indoor ambient consistent with the starter shop; optional night shifts belong to scene overlays, not embedded sprite palettes.
- **Expressions:** neutral, curious, happy, impatient and disappointed; expressions must be legible at gameplay size without changing identity or implying demographic stereotypes.
- **Clothing:** two fully drawn ensembles per archetype, complete coverage for role-applicable motion states, no texture clipping, no change to facial ID or baselines. Staff require visually recognizable staff presentation.
- **Animation:** recommended idle 4 frames / 500 ms looping; walking 8 frames / 640 ms looping; waiting 4 frames / 800 ms looping; browse 6 frames / 900 ms looping; one-shot actions explicitly declare frame count and completion. These are art-production defaults until validated at runtime, not factual promises of completed frames.
- **Registration:** each frame records stable character ID, adult role, outfit ID, action, facing, frame sequence, duration, canvas dimensions, baseline anchor, source path and SHA-256 after output exists. Reject missing/duplicate frames and mismatched canvas/pivots.
- **Accessibility:** non-motion state equivalent for reduced motion; faces are not the sole status indicator; avoid flashing and preserve interaction hit regions.

## Approval gate

Before BUD-CHAR-01.2 art production: review and explicitly approve one lineup/style sheet with one staff and one adult customer from the front and both profiles, five expression thumbnails, two outfit treatments and a four-frame motion sample, verified against the existing 4:3 storefront. These are required future artwork deliverables and **have not yet been drawn or approved**. Record approval and any versioned spec adjustments in the repo. Do not label 01.1 PASS solely because text, schema or tests pass.
