# Budtender Phase 3.19 — durable Level 1 qualification

**Step:** 3.19 — Recommended asset export categories
**Level:** 1 (ordinary app roadmap step)
**Disposition:** PASS against exact tested implementation SHA `8aa9ec8a68d3f1132e52e621eac3fae5ee6babb1`
**Reconciliation base at implementation:** `435d6b122db3e84b745abdc62eba8ef38f6cf841`
**Branch:** `feature/budtender-3-19-export-categories`
**PR:** [#708](https://github.com/abvhiael/420-integrated-v0.1/pull/708)

## Original requirements

Export by function under exactly seven prefixes: `env_` (environment), `fixture_` (fixture), `prop_` (prop), `plant_` (plant), `sign_` (signage), `light_` (lighting), `decal_` (decal).

## Qualified implementation

- `assets/budtender/phase-3.19/export_catalog.json`: deterministic source-to-export naming mappings for **464** production assets: 368 base inventory, 48 Phase 3.16 hotspots and 48 Phase 3.17 state images. Source path, asset byte count and SHA-256 or Git blob identity are recorded; no PNG bytes or existing runtime URLs were rewritten.
- `clients/budtender-web-v1/public/export-categories.js`: seven-prefix export contract and fail-closed validator.
- `clients/budtender-web-v1/test/export-categories.test.ts`: regression coverage for complete catalog mapping, immutable source metadata, category and prefix correctness, invalid source/output paths, duplicates, omissions and invalid sizes.
- `docs/budtender/BUD-3.19-EXPORT-CATEGORIES.md`: documentation of the export-by-function convention, its scope and distinction from the Phase 3.18 rendering z-order.

## Exact-SHA CI evidence

- [Budtender Qualification — 39071240316](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39071240316): **success**. All five jobs passed: `gaming-integration`, `web-client`, `gaming-contract-security`, `gaming-client-hardening`, `core`.
- [420Docs Qualification — 39071240267](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39071240267): **success**; automatic CI result, not a separately requested Level 3.
- [420Oracle audit qualification — 39071240330](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39071240330): **success**; automatic independent CI result.

This certificate is **documentation/evidence only**. It does not change the tested implementation, source art, workflows, tests, dependencies, generated outputs, deployment configuration or frozen inputs. Preserve the original qualification SHA and run identities. No repeated global tests are required solely for this certificate.

**Level 2:** Not initiated or required by this ordinary step.
**Level 3:** Not initiated.
**External/testnet blockers:** None for naming/catalog work.
**Merge:** Reconcile and verify eligibility independently before declaring merged.
