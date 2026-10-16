# BNB-5.13 — M5-B Level 2 qualification gap assessment (WIP; NOT a certificate)

Date: 2026-10-15. PR #644 remains draft/open/unmerged. This document records verified repository observations, not a Level 2 PASS.

## Frozen starting point
- Observed branch HEAD: `6227ebe2ddf4bdeed2526faa403f09fcabeae79c`.
- Last qualified executable implementation: `6acc0df07c0f09af9873bc6105cb2b568e3f7ae2`.
- Compare executable to HEAD: one added evidence-only file, `docs/bnb/BNB-5.12-LEVEL1-CERTIFICATE.md`; no implementation diff.
- Phase PR base: `3f2cf64897e96c4f16213bcaf93564db72a174c9`.
- BNB-5.12 Runtime Slice #38779280160 / job #116574958434: success at evidence-only HEAD; runtime, PostgreSQL/TLS, browser accessibility, packaged service and deployment-check steps successful.
- Nine retained BnB guardrail workflows also succeeded at this HEAD; global Docs was skipped (not a passing result or required Level 2 owner).

## Requirements-to-evidence inventory and outstanding integration

| M5-B requirement | Retained evidence found | Outstanding BNB-5.13 witness |
| --- | --- | --- |
| Guest/host authenticated lifecycle and account boundaries | `test_account_sessions.py`, `test_api.py`, `test_bnb59_postgres.py`, browser smoke | Accumulated end-to-end guest/host/operator scenario under real services, including negative account isolation |
| Request/reservation transitions; execution disabled | `test_api.py`, `test_bnb46_saga.py`, browser smoke | Join lifecycle and provider projection assertions in a single Level 2 integration matrix |
| Device registration, preferences, revoke, acknowledgment, reconnect | `test_bnb58_notifications.py` | Cross-flow witness with guest/host event creation, device acknowledgment, revocation and recovery |
| Operator health, dead letters, replay, reconciliation | `test_bnb59_operations.py`, `test_bnb59_postgres.py`, `test_bnb511_monitoring.py` | Join real provider/worker failure with independently gated operator response |
| Signed Pay/Wallet observations, monotone projections, finality revocation | `test_bnb510_observation_worker.py`, payment authority suites | Accumulated signed-observation → reservation projection → cancellation/revocation witness; external provider acceptance remains separately gated |
| Search/Travel discovery, receipt, retraction, recovery | `test_bnb56_*py`, `test_bnb57_m5a_integration.py` | Join subscribed consumers with later privacy/notification and recovery transitions |
| Privacy, consent, revoked credentials, cross-account denial | `test_bnb213_security.py`, `test_bnb58_notifications.py`, `test_bnb59_postgres.py` | Cross-domain adversarial witness for the combined flow |
| Browser accessibility and retained UI | `browser_accessibility.py` with Chromium and axe; Runtime Slice passes | Clearly separate stubbed browser API journeys from actual independent backend acceptance |
| Interrupted transport, competing worker, retries, process/database recovery | `test_bnb52_worker.py`, `test_bnb512_multi_instance.py` | M5-B combined interruption/recovery scenario and explicit external multi-host deferral |
| One accumulated Level 2 exact-SHA qualification | Runtime Slice and guardrails already green at prior SHA | New dedicated M5-B accumulated tests if genuinely required; one fresh qualification against final executable SHA; complete job inspection and a durable BNB-5.13 certificate |

## Administrative evidence gap
The branch includes a BNB-5.10 observation-worker test and the BNB-5.11 certificate refers to earlier BNB-5.10 green exact-SHA qualification, but **no** `docs/bnb/BNB-5.10-LEVEL1-CERTIFICATE.md` existed at the observed branch HEAD. Reconcile evidence separately if repository policy requires a standalone document; never recertify without real supporting evidence.

## Outstanding qualification actions
1. Add/confirm an actual M5-B accumulated scenario suite using the existing verified-TLS PostgreSQL and isolated HTTP fixtures; do not claim stubbed UI/provider simulations are production acceptance.
2. Run the retained BnB Runtime Slice and affected BnB guardrails against **one final executable SHA**. Inspect all required jobs and failures before disposition. Do not dispatch global Solidity/Genesis/Integrated/Docs.
3. Freeze the SHA, retain run IDs and first-party evidence; only then create `BNB-5.13-LEVEL2-CERTIFICATE.md` as an evidence-only follow-up.
4. Preserve `booking_enabled=false`, `travel.bnb_booking=false`, `financial_execution=false`; separately record actual external/testnet acceptance in `BNB-TESTNET-WORK-ROADMAP.md`.

**Current disposition: BNB-5.13 BLOCKED/NOT YET LEVEL 2 QUALIFIED. BNB-5.14 must not start.**
