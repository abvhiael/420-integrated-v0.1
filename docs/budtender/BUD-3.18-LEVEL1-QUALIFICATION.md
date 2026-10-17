# Budtender 3.18 — Level 1 qualification certificate

**Step:** 3.18 — Asset layering hierarchy
**Qualification level:** Level 1 (ordinary roadmap step)
**Disposition:** PASS for exact implementation SHA `a5a39cb097cb2588512b743a343b279ca3b02b5f`
**Implementation branch:** `feature/budtender-3-18-layer-hierarchy`
**Pull request:** [#705](https://github.com/abvhiael/420-integrated-v0.1/pull/705)
**Implementation reconciliation base at development:** `37fda93f2054f5fc328497da3c43b100fef5e6ad`

## Original canonical layering order
```text
00_BACKGROUND
01_WALLS_AND_WINDOWS
02_FLOOR
03_ARCHITECTURE
04_FIXED_SHELVING
05_FIXED_COUNTERS
06_PRODUCT_DISPLAYS
07_PROPS
08_PLANTS
09_CUSTOMERS
10_STAFF
11_INTERACTION_EFFECTS
12_LIGHTING
13_FOREGROUND
14_UI
```

## Implementation and exit evidence

The production web renderer defines all 15 ordered layers in `clients/budtender-web-v1/public/scene-layers.js`, validates layer identities before DOM modification, uses deterministic numeric z-indices and stable same-layer order, and does not mutate game state. The starter-shop scene attaches the existing walls/windows, floor and counter artwork to their canonical tiers. Remaining layers are reserved without renumbering. Changes are limited to presentation, scoped tests and Phase 3.18 documentation; no economic, identity, authorization, accounting or simulation authority was changed.

Scoped tests cover exact layer enumeration, deterministic occlusion and stable ties, invalid-layer rejection with no partial mutation, same-origin module serving, and unchanged game state around rendering. The canonical audit spec and affected source are `docs/budtender/BUD-3.18-LAYER-HIERARCHY.md`, `clients/budtender-web-v1/public/scene-layers.js`, `public/index.html`, `public/app.js`, `public/styles.css`, and `test/artwork.test.ts`.

## Successful exact-SHA GitHub Actions evidence

- [Budtender Qualification run 39064684550](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39064684550): **success** for `a5a39cb097cb2588512b743a343b279ca3b02b5f`. Mandatory jobs: `web-client`, `gaming-integration`, `core`, `gaming-client-hardening`, `gaming-contract-security` — all succeeded.
- [420Docs Qualification run 39064684527](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39064684527): **success**, independently triggered by repository PR policy.
- [420Oracle audit qualification run 39064684537](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39064684537): **success**, independently triggered by repository PR policy.

The Docs and Oracle runs are not treated as Budtender Level 2 or Level 3. No comprehensive Level 3 inventory was requested.

## Evidence preservation and merge rule

This certificate is **non-executable documentation only**, recorded in a separate commit from the tested implementation SHA. It does not supersede or change the qualified code, tests, workflows, dependencies, configuration, runtime outputs or frozen inputs. No CI rerun is warranted solely for the certificate commit. Verify current-`main` compatibility, required reviews and merge eligibility before merging. Do not represent a passing run on the original SHA as a run on the certificate SHA.

**Level 2:** Not requested / not due at this ordinary step.
**Level 3:** Not initiated.
**Testnet/external acceptance:** None required for this rendering-only step.
