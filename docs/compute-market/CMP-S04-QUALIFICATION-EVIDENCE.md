# CMP S-04 — Level 1 qualification evidence

**Status: OFFLINE IMPLEMENTATION QUALIFIED — CANONICAL S-04 NOT COMPLETE; LIVE/PRODUCTION IDENTITY GATES MOVED TO TESTNET.**

- Canonical step: S-04 — Participant identity and consent.
- Qualification Level: 1, app-scoped.
- Exact qualified implementation SHA: `21cdb83f32fbc17b92d7a70f90791b1d3e03abaa`.
- Documentation-only roadmap follow-up SHA: `d023879d9004b184572f89faf6bbed663174d622`.
- `main` reference checked at initial reconciliation: `04b9f63775754c96cb73d38cccd02e2fc682cbd9`; stacked base from S-03 PR #576: `16be4be6c8bc56c3cbd50632e71e323e939fe50e`.
- Branch `cmp-s04-participant-identity-consent-20261008`; PR #577 stacked on S-03 #576, S-02 #575 and S-01 #574. Unmerged.
- Changed implementation: `compute/ingestion/src/identity.mjs`, `compute/ingestion/test/identity.test.mjs`, `compute/ingestion/package.json`, `.github/workflows/cmp-s04-identity.yml`, `docs/compute-market/CMP-S04-IDENTITY-CONSENT.md`.
- Required exact-SHA [CMP S-04 Identity Consent run 37843406319](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37843406319): **SUCCESS**; qualified job `113538188396` **SUCCESS**. Node 22 syntax, targeted S-04 tests and retained S-02/S-03 ingestion suite ran via `npm run qualify`.
- Covered off-line: explicit source/project allowlist; proof domain separation; pseudonymous external commitments; dual assertion of external proof + Wallet-reviewed boundary; expiry, wrong chain, wrong account, missing signature, replay/collision, opt-out and relink freshness; no monetization eligibility.
- **Security limitation:** caller-supplied Wallet `verified:true` is not actual EIP-712/1271 signature verification; repository-only proof is not adequate to establish account ownership in production. In-memory state is not durable for replay/collision/ownership continuity. Project trust keys are test fixtures; no provider ownership or permission approval proven.
- **Still to be qualified at live testnet:** actual project-approved participant ownership proof, true cryptographic Wallet signing/verification, durable challenge and link registry, live consent/disconnect/rekey/ownership transfer/recovery, source outage and revocation, retention/privacy review. S-01–S-03 provider/live proof access prerequisites also remain deferred there.
- Level 2: S-06 real ingestion/Indexer/app milestone; no Level 2 due at S-04. Level 3: one comprehensive phase closeout, not triggered by this step.
- Next canonical step: **S-05 — Canonical record binding and cross-provider deduplication**.

This is evidence-only documentation against the already qualified implementation SHA; it is not new executable qualification.
