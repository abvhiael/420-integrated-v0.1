# HZ-GCA-13 — Rewards and prize settlement: Level 1 qualification

Status: **COMPLETE — repository-local Level 1 PASS**.

Canonical source: `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`, HZ-GCA-13.
PR: #565; branch `feature/420hz-generate-community-awards-roadmap`.
Observed main/base: `ffc6a4028676907c266714b5c1ae8ba3af9a7137`.
Candidate implementation SHA: `18a2af4f0acd9a852a3e4a6277a032b257d162b4`.

App-scoped modified files: `hz/generate/src/award-prizes.js`, `hz/generate/test/award-prizes.test.js`, `hz/generate/src/index.js`, `hz/generate/package.json`, `.github/workflows/420hz-gca-13.yml`, `docs/architecture/420hz/HZ-GCA-13-PRIZES.md`.

Exit coverage intended: zero-prize and funded-prize accounting conservation; immutable season/category schedule, legitimate finalized result requirement, deterministic exact recipient/amount/currency/purpose/commitment binding, canonical Treasury/Grants/Pay delegated funding, eligibility/compliance gate, replay-safe provider key, partial failure and retry, privacy-minimal public accounting. External funding and actual payout remain provider-owned and are not performed by tests.

Required Level 1: `npm run qualify` from `hz/generate` with exact checkout SHA assertion through dedicated workflow `.github/workflows/420hz-gca-13.yml`.
Successful run: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37868649669
Job: `113621325022`; SUCCESS. Exact SHA assertion PASS; retained Generate/Rewards qualification 90 PASS / 0 FAIL / 0 SKIPPED / 0 CANCELLED.

Important production blockers: fixture-only in-memory idempotency; no transactional durable reservation, payment ambiguity reconciliation, canonical wallet recipient authority, live sanctions/abuse attestation, collateral/funding exhaustion handling, on-chain settlement or public deployment qualification. These cannot be represented as qualified financial execution.

Level 2: app milestone retained for later cross-service 420Pay/Treasury integration.
Level 3: all expensive global inventories intentionally deferred to app-phase closeout.
Next canonical step: **HZ-GCA-14 — Notifications, Search, Analytics and Explorer integration**.
