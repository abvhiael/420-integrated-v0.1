# BNB-6.2 — Level 1 exact-SHA qualification certificate

**Disposition: PASS (repository Level 1); no production activation.**

- Canonical exit: versioned environment schema, config validation, mounted secret references, service identities, disabled booking/financial flags, negative/failure-path tests.
- Qualified implementation SHA: `b975476699c8babbe29e2d398736f053eb4e2597`.
- Initial Phase 6 base: `19166dfbdafd1f51a9cd9bbd2a22abfe95b8d451`; later observed main: `9fce5444bd009efe382a6874c0a5259498457454` (unreconciled Phase 6 branch, Level 3 deferred to BNB-6.12).
- Original failed runtime SHA `2291b6ecabae195adf43b879f1140e02e0a59687` is **not qualified**: runtime run #38847701566 failed four tests, then worker credential separation and three fixture interfaces were corrected.
- Verified exact corrected-SHA BnB Runtime Slice run [#38848757477](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38848757477), runtime job **#116805077833**, **SUCCESS**, 489 tests passed, 1 warning; PostgreSQL migration/TLS, restore, application, security, packaging, web, accessibility, Compose/TLS and artifact steps successful.
- BnB source/architecture/security/operational guards BNB-1.1 through BNB-1.9 all **SUCCESS** on corrected SHA; Oracle audit #38848757486 **SUCCESS**, supplemental.
- Full Docs #38848757471 **SKIPPED**, correctly not counted as Level 1 evidence. No global Solidity/Genesis/Integrated/Geth requalification launched.
- Release remains restricted: `booking_enabled=false`, `travel.bnb_booking=false`, `financial_execution=false`; real issuer, managed database, provider, production and testnet acceptance separately gated by `BNB-TESTNET-WORK-ROADMAP.md`.
- Evidence is recorded in the subsequent Phase 6 documentation commit; it must **not** be confused with the qualified implementation SHA. BNB-6.3 can start; Level 2 only at 6.6/6.11, Level 3 only at 6.12.
