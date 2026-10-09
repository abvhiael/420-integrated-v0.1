# HZ-GCA-12 — Awards UX and permanent history

Canonical definition: `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`, HZ-GCA-12.

A responsive, keyboard accessible fixture-only public Awards experience is implemented in `hz/awards-web/index.html` and `hz/awards-web/app.js`, with deterministic projection/fixtures in `hz/awards-web/model.js`. This includes Awards overview, current-season deadline and public status, versioned category/eligibility browser, demonstrative nomination and voting controls, finalist ballot state, finalized winners and badges, season archive, and Recording–Work–Creator–rights provenance reference display.

Public model exposes no voter account key, proof, ballot-scoped nullifier or unpublished private source. Real voting and nomination functionality intentionally fail closed until fully authorized Wallet/Identity/Creative service bindings are qualified. Buttons are explicitly labeled demonstrations and no production action is asserted.

Test suite `hz/awards-web/model.test.js` validates deterministic visibility, privacy exclusion, nomination idempotency, time windows, frozen ballot voting, duplicate-vote rejection, immutable archive projection and provenance. Targeted `.github/workflows/420hz-gca-12.yml` enforces exact checked-out SHA, JS syntax, UI regressions and retained Generate/Awards suite.

Limitations: This is a static fixture experience and not yet deployed to a live 420Hz website. Production write pathways, durable independent history indexes, signing/eligibility, live results/rights resolvers, and browser E2E against a deployed service still require integration. No fake Wallet authenticity or Identity uniqueness is implied.

Qualification status is recorded separately in `docs/audit/HZ-GCA-12-QUALIFICATION.md`. Level 2 is appropriate at the later Awards integration milestone, not a global Level 3 now.

Next canonical step: **HZ-GCA-13 — Rewards and prize settlement**.
