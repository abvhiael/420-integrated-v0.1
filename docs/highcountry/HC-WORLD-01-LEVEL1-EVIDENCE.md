# HC-WORLD-01 Level 1 reconciliation evidence
- Scoped verification commit: `949bbd8e0b3171e07ddc24d1b6e3f2b86d9f8bef`
- Workflow: **HighCountry HC-WORLD-01 Level 1**
- Run ID: `40428058863`
- GitHub run conclusion: **success** (completed), observed 2026-10-26.
- Script: `node --test scripts/highcountry/hc-world-01.test.mjs`
- Scope: founding schema, three regions, 45 settlement slots now named, town capacities, eight district classification reservations per region, 65/10/10/10/5 land-budget policy, exact 64 Original Sixteen fragment site and objective references, negative regressions for ID/budget/capacity/heritage tampering.
- Source truth: `deployments/highcountry/hc-world-founding-spec.v1.json`, `deployments/highcountry/original-sixteen-archive.v1.json`, `deployments/highcountry/original-sixteen-discovery-journeys.v1.json`, `docs/highcountry/HC-WORLD-01-APPROVED-SETTLEMENT-LORE-AND-FESTIVALS.md`.
- This evidence-only document is added after the tested implementation SHA; it does not change the manifest, verifier, or workflow. Do not claim other workflows pass from this record.
- Explicit limits: all detailed atlas coordinates and cadastral geometries remain unassigned; district entries are classification reservations rather than surveyed cadastral districts; founder sites retain null map positions. HC-WORLD-02 and later county mapping must complete those surveys before Genesis issuance. This Level 1 pass proves schema and current source-lore reconciliation, not finalized atlas geography or release readiness.
