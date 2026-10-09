# HZ-GCA-16 — Website and product navigation integration

Status: **COMPLETE — targeted Level 1 PASS, broader app milestone / Level 3 deferred**.

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

Targeted exact-SHA Level 1 qualification **PASS**: implementation SHA `f5a7eb8a9d63563ca14be53833f3b271291ff35c`, workflow `HZ-GCA-16 Website Level 1`, run https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37879652476, job `113656154554`, SUCCESS. Exact SHA verified; website verifier PASS (`errors: []`), all 10 retained Generate Studio web tests PASS (0 failures), JavaScript syntax checks PASS. Verify existing `420Hz Web Qualification` web verifier job against same SHA when triggered; do not substitute stale evidence. HZ-GCA-14 live integrations and HZ-GCA-15 production-equivalent security remain HZ-GCA-18 testnet gated. No live endpoints, Wallet, Search, Indexer, nominations, votes or awards seasons are asserted operational. Level 2 app milestone and Level 3 at HZ-GCA-17 remain separate.

Original HZ-GCA-16 exit criteria are satisfied for the pre-testnet repository website. No unavailable action is advertised as live. Evidence-only commit may inherit the above qualified implementation SHA; later substantive code or workflow changes require requalification. Next canonical step: **HZ-GCA-17 — Repository phase qualification and closeout**.
