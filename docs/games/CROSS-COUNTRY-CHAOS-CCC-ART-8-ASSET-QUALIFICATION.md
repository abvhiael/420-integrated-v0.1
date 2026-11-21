# CCC-ART-8 — Image/export manifest and asset qualification

This phase qualifies the already approved Cross Country Chaos assets in the authoritative GitHub repository and the deterministic Bong Goggles web build. It does not replace approved artwork or modify the frozen three-stage rules, scoring, private hands, road geometry or CCC-ART-1–7 presentation.

## Approved source/export dimensions and naming

| Asset group | Source | Published export | Dimensions | Transparency |
| --- | --- | --- | --- | --- |
| 49 cards (7 mileage, 6 fixes, 8 upgrades, 4 legendary, 24 regional hazards) | 49 approved PNG masters | 49 corresponding optimized WebP | PNG 640×1080; WebP 480×810, 16:27 | Actual nonopaque, nonempty alpha pixels in both |
| East/Ontario/West atlas underlays | 3 approved WebP images | Pinned identical source bytes | 1920×830 rendered behind 960×415 SVG road | Opaque |
| East/Ontario/West atlas foregrounds | 3 approved WebP images | Pinned identical source bytes | 1920×830 | Actual transparency |
| Vintage vehicle tokens | 6 approved SVG images | Pinned unchanged SVG files | 100×64 viewBox, scalable | Transparent vector |
| Stage/championship trophy and flag | 2 approved inline SVG illustrations | Already embedded in results UI | 175×155 trophy; 144×94 flag | Transparent and decorative |

The full-size PNG masters remain in GitHub source; **do not publish 49 PNG masters** into the mobile web build. Approved optimized WebP is the card-browser export. No extra raster vehicle sprites are introduced because the existing approved SVGs already scale sharply on mobile. All paths are relative, strictly allowlisted, and do not depend on external media services.

## Published machine-readable image manifest

The deterministic validator at `bong-goggles/web/scripts/verify-chaos-image-manifest.mjs` is integrated into the production build. The built public image manifest lives at:

`assets/games/cross-country-chaos/image-manifest.json`

It records each image's stable ID, PNG master/export paths, format, dimensions, transparency, file sizes and SHA-256 digest; six atlas entries retain pinned Git blob identities; six vehicles retain their approved Git blob identities; two decorative inline result graphics retain their viewBox/class identity. It includes no account details, session state, build time, external URL, arbitrary path, private hand or secret. The JSON is **generated from actual source and exported bytes**, never authored manually or trusted as its own proof.

All 49 original PNG masters are collectively pinned to source catalog SHA-256 `3e5248bcb419b85c6904c85d61a466dec3f6275a8e3a4693d3c8fe1c71fe82c0`, taken from previously passed CCC-ART-7 exact-commit web qualification. The old 13 per-card manifest checks and six map/six vehicle Git blob pins continue to apply. The new validator also confirms real alpha pixels, not just an alpha-capable file header. Source replacement now fails closed until an explicitly reviewed art requalification updates the baseline.

`scripts/build.mjs` writes the manifest only after PNG-to-WebP optimization and previously approved master verification. `scripts/qualify-web.mjs` independently regenerates and checks it from exact published bytes, rejects any extraneous assets, checks dimensions, integrity and alpha, and retains all existing image budgets. The only added allowance is **+32 KiB** to the *base-only* static payload (1093 → **1125 KiB**) for the published manifest and scoped mobile image scaling; the 49-card 4 MiB, six-map 780 KiB, six-vehicle 16 KiB, single-JS/CSS 256 KiB and brand budgets are unchanged. Actual build usage is recorded in the PR qualification evidence.

## Mobile and accessibility

Card images preserve their 16:27 aspect ratio with contain scaling and bounded width; vehicle selector and finish podium icons preserve 100:64 proportions; the original 1920×830 atlas artwork is correctly fitted into the unchanged 960×415 highway viewBox via `preserveAspectRatio="xMidYMid meet"`. Narrow mobile layouts avoid clipped images and keep the results-table scroll container. No fonts or third-party image requests are introduced; forced-colours and reduced-motion paths stay available.

## Exit criteria

An exact-head GitHub Actions Bong Goggles web run must pass all existing source/web/public-feed tests, the PNG/WebP source/export manifest checks, both production build configurations, static budgets and accessibility gates. The existing scoped 420Docs and wallet-independent Account Social regression checks must remain green. Tests cover manifest identity, denial of forged/duplicate/opaque/empty pixels, transparent PNG and WebP decoding, real approved source samples, responsive 2–4-seat rendering and the actual build/qualification wiring. Preserve exact-SHA workflow references in the PR.

No merge or production deployment without separately granted authorization. No additional roadmap step is initiated here.