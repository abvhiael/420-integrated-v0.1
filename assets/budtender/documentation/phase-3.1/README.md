# Budtender — Phase 3.1 Environment Base Layers / Background Shell

Seven source-resolution RGBA PNGs converted from user-provided crops.

## Usage

Use alpha compositing to layer these environment shell assets within the approved wide 3/4 starter-store camera. Positioning, scale and depth sorting should be set by the game implementation. These are individual shell parts, not a single flattened scene.

## Preservation

The source artwork's RGB pixel values remain unchanged, and source canvas dimensions are preserved. Transparent regions were identified as light backgrounds connected to the image boundary. At the edge of the cutout, a minimal alpha softening was applied; no image was generated, redrawn or upscaled. The source filenames and SHA-256 hashes are in `asset_manifest.json`.

## Cautions

Source files are small (88–170 px wide). They should be tested at intended in-game scale before acceptance. Automated light-background segmentation can remove pale border-connected portions of the artwork or leave colored halo shadows. Inspect alpha boundaries and make a corrective mask if needed. This is not evidence of final visual acceptance.

## Contents

- Seven `env_starter_*.png` assets
- `asset_manifest.json`
- `preview_sheet.png` (checkerboard shows transparency)
- `README.md`

Expansion seams and counter/display systems are excluded.
