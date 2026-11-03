# Canonical Old Town PNG images for Tiled

This branch provides a build script and a manually dispatched packaging workflow.

## To obtain the actual artwork map
1. Open **Actions → HC Old Town Tiled canonical PNG preview package** in this PR's GitHub repository and select branch `hc-tiled-old-town-canonical-artwork` (if workflow dispatch is available).
2. Run the single packaging workflow and download the artifact **hc-old-town-tiled-originals**.
3. Unzip the artifact intact. Open `tools/tiled/old-town/port-alder-old-town-art-preview.tmj` in Tiled.
4. Do not move the `apps/` directory relative to `tools/`: the tileset refers to the unchanged original PNG filenames.

Or, in a full local checkout of this branch, run `node tools/tiled/old-town/build-canonical-preview.mjs` then open the same `.tmj` file.

The script refuses any PNG whose bytes differ from the canonical SHA-256 registry; reads the actual PNG IHDR pixel dimensions; and generates 20 image-collection tiles + image objects in a distinct **Canonical artwork — PREVIEW ONLY** layer. The source review-map parcel boundaries are preserved.

**Not approved for game placement.** Image-object sizes are deliberately conservative _canvas-fit previews_, NOT measured structural foundations. Positions are provisional site-centre viewing markers, NOT certified right-edge ground contacts. This does not repair Old Town production placement, does not alter the registry or original images, and does not assert that any sprite correctly fits its lot. It is a convenient visual starting point in Tiled while 20 sprite-local foundations and authoritative survey reconciliation remain outstanding.
