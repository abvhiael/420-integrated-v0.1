# BNB-5.7 — M5-A Level 2 integration milestone — qualification certificate

**Status: REPOSITORY LEVEL 2 PASS (isolated app qualification).** Not a production acceptance or phase Level 3 closeout.

## Canonical scope and authority

- Original step in `docs/bnb/BNB-PHASE5-ROADMAP.md`: **BNB-5.7 — M5-A Level 2 integration milestone**. Accumulated BNB-5.2 through BNB-5.6, source mutation → projection/refresh → event → per-consumer delivery/acknowledgment/retraction, with failure, race, outage and recovery matrices.
- **Exact qualified implementation SHA:** `85a110e12243469a52b800a903fdc6b85627e32a`.
- Audit branch `audit/bnb-phase5-bnb-5-1-baseline-20261014`, draft/open/unmerged [PR #644](https://github.com/abvhiael/420-integrated-v0.1/pull/644).
- Phase PR base: `3f2cf64897e96c4f16213bcaf93564db72a174c9`. Main comparison at milestone showed **diverged, 47 ahead / 536 behind** as of discovery, common ancestor `eeaa4e593e8f5f16e2bc566b20ddbe04576589c1`. Level 2 is deliberately **not** current-main reconciliation; Level 3 reconciliation remains BNB-5.14.
- Prior completed BNB-5.6 Level 1 executable SHA `a726b0a7079cd8aed21dddeeb4750017160a4b4c`, evidence-only commit `89fec0cf338f96b2f8f95bc4090336d647f40369`, certificate `docs/bnb/BNB-5.6-LEVEL1-CERTIFICATE.md`.
- This certificate is evidence-only; its commit may be newer than the qualified executable SHA without requesting recursive requalification. Future substantive changes are not covered.

## Milestone integration assurance

1. BNB-5.2 supervised worker: bounded outbox polling, lease fencing and renewal, retry after outages, clean termination, restart and crash qualification retained by the app regression inventory.
2. BNB-5.3 independent subscriptions and receipts: distinct consumer durable state, configured authority, no cross-consumer completion, retries, replay/duplicate/conflicting receipt protections retained.
3. BNB-5.4 transactional mutation/refresh: property-first source locking, queued invalidation, commit/rollback, authority and time-expiry refresh, competing workers, lost wakeup, stale-calendar retry, restart and actual process-death regressions retained.
4. BNB-5.5 change journal: per-property monotone revisions with global commit-ordered cursors; bounded pagination, frozen high-watermark/epoch, replay, tombstone, resync and concurrent-writer regressions retained.
5. BNB-5.6 separately instantiated repository-controlled Search/Travel HTTPS consumers: verified TLS, independently supplied scoped proofs, signed postcommit receipt verification, privacy-safe envelopes, revocation/current-authority checks, revision/retraction propagation and outage recovery retained.
6. **Added M5-A cross-step test** `services/420bnb/tests/test_bnb57_m5a_integration.py`: actual verified-TLS PostgreSQL source mutation → durable refresh → monotone discovery journal → independent Search/Travel state and stale/replayed revision denial; rolled-back mutation must not leak a revision or advance completed refresh. Other retained BNB-5.4 and BNB-5.6 tests provide separate full network and concurrency coverage; do not misrepresent this two-test addition as the entire suite.

## Exact-SHA GitHub Actions evidence

- Required app [420BnB Runtime Slice **#38684187396**](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38684187396), job **#116255180440**: **SUCCESS** on exact `85a110e12243469a52b800a903fdc6b85627e32a`; **442 passing application tests + 8 passing migration/operations tests = 450 passing test executions**. No failed job steps; verified-TLS PostgreSQL, migration ledger, packaged runtime, HTTP/security, browser accessibility, topology and build/restore evidence included.
- Same exact SHA, all nine retained BnB guardrail workflows terminal SUCCESS: BNB-1.1 #38684187300, BNB-1.2 #38684187265, BNB-1.3 #38684187371, BNB-1.4 #38684187291, BNB-1.5 #38684187372, BNB-1.6 #38684187314, BNB-1.7 #38684187246, BNB-1.8 #38684187508, BNB-1.9 #38684187341.
- 420Docs qualification #38684187324: **SKIPPED**, not counted as passing or required for this app Level 2.
- 420Oracle audit #38684187268: **IN PROGRESS at evidence creation**, not counted as passing and not a mandatory BNB M5-A qualification owner. Consult actual terminal run record if subsequently needed.
- No Solidity/Genesis/Integrated/Geth/global Docs or duplicate repository-wide Foundry inventories dispatched for this app Level 2.

## Limits, deferred acceptance and next step

The certificate establishes repository-level functional integration under isolated TLS/PostgreSQL fixtures. It is **not** evidence of independently approved live Search/Travel operators, public deployment, externally sanctioned issuer/revocation source, production credentials, live legal/compliance/Accessibility review, or third-party acceptance. These stay on `docs/bnb/BNB-TESTNET-WORK-ROADMAP.md`. Preserve no-live-publication, `travel.bnb_booking=false`, `booking_enabled=false`, `financial_execution=false` and no real notifications or money movement.

**M5-A Level 2: PASS for exact SHA.** Keep PR #644 **draft, open, unmerged**; defer complete current-main reconciliation and full Level 3 to BNB-5.14.

**Next canonical roadmap step: BNB-5.8 — Notification delivery and device lifecycle.**
