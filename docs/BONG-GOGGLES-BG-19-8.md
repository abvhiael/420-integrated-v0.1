# BG-19.8 — Discovery, reviews, search and recommendations

Status: web presentation/model implementation committed; exact-head CI and end-to-end integration pending.

Implemented: `bong-goggles/web/core/discovery.js`, `discovery-ui.js`, `test/discovery.test.js`, and `/discover` route wiring in `app-shell.js`.

The public search surface consumes a qualified indexed projection and distinguishes unavailable transport from no results. Result classes PROFILE, PAGE, GROUP, EVENT, POST and DISCOVERY are normalized and filtered for active, explicitly accessible, public, nonblocked and nonhidden records before canonical deep links are rendered. Search accepts bounded query, type, cursor and page-size inputs; paging never fabricates a cursor. Recommendations are visibly non-authoritative and do not alter social, moderation or reward state.

Discovery subjects, current reviews, correction commitments and verification attestations are presented only from canonical indexed records. Review publication/withdrawal, correction submission and verification attestation are modeled as qualified `BongGogglesDiscoveryRegistry420` Wallet intents. No browser-generated review or verification becomes canonical without the contract write and refreshed projection. The web UI does not infer text from content hashes or invent review summaries.

**Integration gates:** The existing web `app.js` does not yet request qualified search/discovery projections or parse/dispatch search forms, detail deep links, pagination and Wallet intents; an HTTP transport and deployment-bound contract ABI/address registry must be provided and qualified. `/posts` is not yet a registered route; search POST links must remain unadvertised as usable until that canonical detail surface is integrated. In the meantime, the UI fails closed on missing projections. Access must be revalidated on each result/detail/action, and blocked/hidden/private records must not be returned by the service. End-to-end journeys, SEO/deep-link handling and production readiness remain BG-19.11/19.14/19.15 gates.

**Note:** Green unit/static CI for BG-19.8 verifies the added projection and presentation rules, not end-to-end live search or on-chain write functionality.
