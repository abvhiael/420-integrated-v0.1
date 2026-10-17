# Budtender Phase 3.17 — Level 1 qualification certificate

**Scope:** Store Environment State Variants — Sheets A, B and C (48 production assets).

**Qualified implementation SHA (immutable):** `693aa782deda755284284edc15c3dac1f0795060`

**Qualification disposition:** Level 1 PASS for the qualified implementation SHA, supported by GitHub Actions results:
- [Budtender Qualification — run 39058050635](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39058050635): **success** (includes the web-client smoke test).
- [Global Level 3 Artifact Preflight — run 39058050561](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39058050561): **success**, preflight only; **not** a Level 3 qualification.
- [420Oracle audit qualification — run 39058050506](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39058050506): **success** (independent, not presented as Budtender qualification).

## Requirements and evidence
1. All 48 uploads are present in `assets/budtender/phase-3.17/` and in the Phase 3.17 registry, covering 16 A activity, 16 B lighting and 16 C condition images.
2. The 38 double-`.png` filenames were normalized using the **same Git blob SHAs**, without altering their bytes. The subsequent scoped image correction resized 38 undersized RGBA PNG files to a minimum 256-pixel height, preserving aspect ratio; the other 10 files remained unchanged. The registry was refreshed with the resulting byte counts and blob identities.
3. The Budtender production web server now explicitly allowlists and serves the 48 Phase 3.17 images. The earlier 368-asset inventory remains intact; the served registered artwork total is 416.
4. Scoped asset checks enforce phase membership, exact filenames and ordering, uniqueness, PNG/RGBA integrity, image dimensions, and stored Git blob identity. Scoped web tests cover registry count, all 48 responses, PNG MIME, unknown-path 404, non-GET 405, and game-state nonmutation.
5. The storefront and Chromium smoke test expect the actual 416-asset inventory. The successful Budtender Qualification run is tied to the exact implementation SHA above.

## Preservation and reconciliation
- This qualification certificate is **documentation only** and must not change qualified executable or artwork inputs.
- Preserve successful CI evidence above; do not relaunch global qualification solely because the certificate was committed.
- Mainline compatibility and GitHub merge eligibility must be checked separately immediately before merge. A successful preflight must not be represented as full Level 3.
- Further unrelated changes to qualified implementation inputs require reassessment; this certificate does not grant future-SHA qualification.
