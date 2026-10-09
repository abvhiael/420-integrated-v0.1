# HZ-GCA-16 — Website and product navigation integration

Status: **IMPLEMENTED — Level 1 exact-SHA CI qualification pending**.

Canonical roadmap: `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`.
PR: #565 on `feature/420hz-generate-community-awards-roadmap`.

## Repository-side implementation

- The existing primary Generate navigation and hero CTA **Generate your own song** are preserved.
- Added primary Community, Charts, Awards and Creator Studio navigation with matching semantic in-page targets.
- Added non-live Community and Charts sections describing the qualified domain capabilities without inventing public community data or chart rankings.
- Added current Awards season module with **no verified live season** and disabled nomination/voting controls. No fixture nomination, ballot or award season appears as production state.
- Added the four AI recording-disclosure class legend labels as explanatory metadata, not invented release claims; actual per-recording disclosure remains gated on source-authentic live catalog.
- Kept the canonical logo image and favicon in header/hero/footer, the existing Generate mock/dev workflow, public pre-testnet gating and disabled Wallet/publish actions.
- Added responsive layout and keyboard focus treatment.
- Extended `scripts/verify-420hz-web.py` to verify all links/targets, disclosure classes, current-season module and fail-closed states.
- Added `.github/workflows/420hz-gca-16.yml` as targeted exact-SHA Level 1 qualification: website verifier, JS syntax, retained web studio tests.

## Remaining gates

Qualify the new implementation commit with HZ-GCA-16 Website Level 1 and inspect every mandatory job/step conclusion. Verify existing `420Hz Web Qualification` web verifier job against same SHA when triggered; do not substitute stale evidence. HZ-GCA-14 live integrations and HZ-GCA-15 production-equivalent security remain HZ-GCA-18 testnet gated. No live endpoints, Wallet, Search, Indexer, nominations, votes or awards seasons are asserted operational. Level 2 app milestone and Level 3 at HZ-GCA-17 remain separate.

Do **not** mark COMPLETE until exact-SHA CI confirms all Level 1 exit criteria.
