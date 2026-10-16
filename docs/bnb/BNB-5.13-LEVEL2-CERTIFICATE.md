# BNB-5.13 — M5-B end-to-end Level 2 milestone certificate

**Disposition: REPOSITORY LEVEL 2 PASS**, exact executable SHA `c76311bd5e7ea0201d0a7354bd272ae380eaeed6`. This is an isolated CI milestone only; it does **not** establish independent live external provider, multi-host, identity, payments, compliance or accessibility approval.

## Authority and frozen implementation
- Canonical roadmap: `docs/bnb/BNB-PHASE5-ROADMAP.md` BNB-5.13 — one accumulated implementation SHA covering guest/host/operator, notifications, provider status, privacy, accessibility automation and recovery.
- Repository `abvhiael/420-integrated-v0.1`, branch `audit/bnb-phase5-bnb-5-1-baseline-20261014`, [PR #644](https://github.com/abvhiael/420-integrated-v0.1/pull/644) **draft, open, unmerged**.
- Qualified executable: **`c76311bd5e7ea0201d0a7354bd272ae380eaeed6`**.
- Phase PR base: `3f2cf64897e96c4f16213bcaf93564db72a174c9`. Phase-wide main reconciliation remains exclusively BNB-5.14.
- Prior executable: `6acc0df07c0f09af9873bc6105cb2b568e3f7ae2`, followed by evidence-only BNB-5.12 certificate and evidence-only BNB-5.13 gap assessment.

## Accumulated integrated coverage
- New `services/420bnb/tests/test_bnb513_m5b_integration.py` exercises a single persistent verified-TLS PostgreSQL guest/host booking-request lifecycle, Search/Travel subscriptions and separate acknowledgments, notice creation/recipient-device acknowledgment and revoked-device denial, private-address/message redaction, financial-observation cursor fail-closed rejection followed by fixture ingress acknowledgment, and independently scoped operator dead-letter recovery with nonce replay rejection. Booking/request state remains nonfinalized and operational execution remains disabled.
- Retained real-PostgreSQL suites also exercise database-authoritative signed-session operator revocation, producer/consumer network delivery and receipts, transport interruptions, competing workers, dead letters, independent restart, migration/backup-restore, privacy and cross-account enforcement, and canonical Pay/Wallet ingress authorization. Individual provider source proofs or fixture signers are not mistaken for real provider sign-off.
- Retained Playwright Chromium + axe WCAG automated browser checks run in the same workflow: viewport, keyboard, reduced motion, focus, host/guest interactions, failure states and page regressions. Its deterministic HTTP API stubs are not independent live Identity or backend browser acceptance.
- No new migration, provider enablement, custody/spend/signing authority or executable production setting was added.

## Exact-SHA CI results
- [420BnB Runtime Slice run **#38808830696**](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38808830696), job **#116676573623**: terminal **SUCCESS** at this exact executable SHA. **479 application tests + 8 migration/operations tests = 487 passed**. Verified-TLS PostgreSQL and complete migration ledger, independent backup/restore, actual browser accessibility automation, packaged nonroot API/web, fail-closed production validation, TLS ingress/deployment topology and immutable infrastructure evidence steps all succeeded, with no failed steps.
- Nine retained app guardrails terminal **SUCCESS** on this executable SHA:
  - BNB-1.1 #38808830739; BNB-1.2 #38808830695; BNB-1.3 #38808830672.
  - BNB-1.4 #38808830574; BNB-1.5 #38808830763; BNB-1.6 #38808830693.
  - BNB-1.7 #38808830634; BNB-1.8 #38808830635; BNB-1.9 #38808830702.
- Global 420Docs #38808830789 was **SKIPPED** and is not claimed as a pass, nor is it required for Level 2. Global Solidity, Genesis, Integrated and Geth Level 3 owners were not dispatched.
- 420Oracle #38808830995 was in progress when Level 2 evidence was checked. It is not a required BnB Level 2 owner and is not counted as a pass.

## Security, acceptance limits and next phase
- Existing signed operator authority and session checks, scoped replay/nonce fencing, device revocation, cross-account denial, redaction, financial projection guards and consumer authority are preserved. The M5-B fixture uses a synthetic Pay observation acceptance callback solely to prove cursor behavior; this is **not** acceptance by an independently deployed 420Pay/Wallet. True external provider acceptance, operational credentials and signatures remain external.
- Synthetic/local PostgreSQL test execution and simulated multiple HTTP clients/workers do **not** establish independently deployed multi-host production recovery. Production backup restore, external Search/Travel, identity issuer/operator credentials, legal/compliance, live notification transport and manual assistive-technology accessibility acceptance remain unwitnessed gates governed by `docs/bnb/BNB-TESTNET-WORK-ROADMAP.md`.
- Preserve `booking_enabled=false`, `travel.bnb_booking=false`, `financial_execution=false`. No publication, signing, settlement, withdrawal, custody or real booking activation.
- BNB-5.10 standalone Level 1 certificate remains a historical documentation gap: a prior exact-SHA success is referenced by BNB-5.11, but absence of a standalone certificate is not rewritten as new evidence or permission to skip milestone checks.
- **BNB-5.13: COMPLETE — REPOSITORY LEVEL 2 PASS**. Next canonical step: **BNB-5.14 Level 3** on a separately main-reconciled merge candidate, including canonical Solidity, Genesis, Integrated, Docs and affected BnB checks. Do not assume this Level 2 audit SHA qualifies a materially different merge tree.

This certificate is evidence-only. The qualification SHA remains the executable SHA above; the follow-up evidence commit is not a new executable qualification target.
