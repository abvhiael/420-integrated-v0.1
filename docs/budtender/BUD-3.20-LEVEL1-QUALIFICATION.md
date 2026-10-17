# Budtender Phase 3.20 — Level 1 qualification certificate

**Canonical step:** 3.20 — Production priority tiers
**Qualification level:** Level 1 (ordinary roadmap step)
**Disposition:** PASS for implementation SHA `bb22e64ebeadb5baf5fdcf28ca2b6b4ef9c44544`
**Original reconciliation base:** `30321d02437d7abb2d4fd95d5c8dd8820350420c`
**Branch:** `feature/budtender-3-20-production-priority-tiers`
**PR:** [#711](https://github.com/abvhiael/420-integrated-v0.1/pull/711)

## Original three-tier production requirements

Tier 1, first playable visual upgrade (11 groups): starter-shop background shell, primary counter, rear shelving, product jars/packages, POS register, queue posts, waiting nook, core plants, primary menu board, logo/signage, canonical lighting overlay.

Tier 2, progression support (7 groups): shelf stocking variants, side-display modules, upgrade visual states, alternate décor, more plants, premium fixtures, expansion seam states.

Tier 3, polish (6 groups): secondary props, alternate signs, time-of-day variants, minor clutter, decorative posters, more product variations.

The exact ordered groups and their registered artwork sources are documented in `assets/budtender/phase-3.20/priority_tiers.json`. Existing source image files and registry URLs are unchanged.

## Implementation and tests

Tier 1 artwork is composed into the playable storefront. Tier 2 visual variants are derived without mutation from inventory and `state.progression.upgrades` / `state.progression.unlockedExpansions`. Tier 3 artwork is available as optional decoration. The 15-layer canonical ordering remains authoritative. Presentation controls do not grant simulation or economic authority.

Changed implementation and tests include `clients/budtender-web-v1/public/index.html`, `public/app.js`, `public/scene-variants.js`, `public/styles.css`, `test/artwork.test.ts`, `assets/budtender/phase-3.20/priority_tiers.json`, and `docs/budtender/BUD-3.20-PRODUCTION-PRIORITY.md`.

An earlier SHA exposed a stale scene-count assertion; it was corrected without weakening layer-order assertions. A later browser-smoke failure resulted from decoding hidden lazy-loaded sprites; the correction retains full asset-registry validation and decodes displayed images for readiness. The final exact-SHA browser smoke and Web Client tests pass.

## Final exact-SHA successful GitHub Actions evidence

- [Budtender Qualification 39077174486](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39077174486): **success** against `bb22e64ebeadb5baf5fdcf28ca2b6b4ef9c44544`. All five jobs passed: `web-client`, `gaming-contract-security`, `gaming-client-hardening`, `gaming-integration`, `core`.
- [420Docs Qualification 39077174559](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39077174559): **success**, automatically triggered by repository policy.
- [420Oracle audit qualification 39077174431](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39077174431): **success**, automatically triggered by repository policy.

Docs and Oracle are not substituted for a phase-level Level 3 closeout. No global CI rerun is requested for this certificate.

## Evidence-only preservation / merge gate

This certificate is a separate non-executable documentation-only commit. It changes no implementation, tests, workflows, dependencies, configuration, frozen manifests or runtime images. Successful qualification continues to refer to the exact implementation SHA above, not to this evidence commit. Verify reconciliation with current main, PR review requirements and merge eligibility before merging.

**Level 2:** not initiated; ordinary step qualification only.
**Level 3:** not initiated.
**External/testnet blockers:** none for this storefront presentation step.
**Limitations:** appearance and spatial art direction approval are not inferred from passing automated tests.
