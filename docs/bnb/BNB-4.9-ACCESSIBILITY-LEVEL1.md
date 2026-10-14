# BNB-4.9 — Accessibility and Resilient Guest/Host Experiences — Level 1 Certificate

**Disposition: REPOSITORY LEVEL 1 PASS.** Human assistive-technology testing and independent jurisdictional WCAG/legal acceptance remain gated.

## Canonical requirement and exact candidate

- Roadmap: [BNB-PHASE4-ROADMAP.md](BNB-PHASE4-ROADMAP.md), BNB-4.9 — Accessibility and resilient guest/host experiences.
- **Exact executable implementation SHA:** `3bda21cf25dff89fef8e0c5e8cce1b65f6f3480f`.
- **Exact fully tested PR candidate SHA:** `74d7bb1f66178d915eea0695397b615260138e36`. The sole intervening commit is the documentation-only [assistive-technology acceptance matrix](BNB-4.9-ACCESSIBILITY-SCENARIOS.md), not a code, test, workflow, dependency or runtime configuration change.
- Repository `abvhiael/420-integrated-v0.1`; audit branch `audit/bnb-phase4-bnb-4-1-baseline-20261013`; draft open/unmerged [PR #631](https://github.com/abvhiael/420-integrated-v0.1/pull/631).
- Original Phase 4 base `81c21541acdc1b900b9a15c6f6b75ff2d7c2b5d9`; observed current main `959288c8bd33b6da0325b6a5d060e00e7bcf0e48`. Branch 129 ahead / 408 behind main at candidate qualification; no Level 3 reconciliation authorized now.

## Implemented and retained exit criteria

1. **High-fidelity guest and host states:** preserve existing frontend flows for public search, nonbinding availability and quote, request/submitted/payment-pending/recovery, authenticated private saved stays, draft/host management, request cancellation, refunds/receipt unavailable and independent provider failure. No frontend-authorized booking confirmation, wallet signature, Pay finality or spending permission.
2. **Keyboard navigation and focus:** added a first-tab skip link to a focusable main landmark; verified Enter navigation, session-clear scrubbing plus focus restoration to the authentication control, focus movement to newly revealed host response text area, and stable focus after host operations refresh. Semantic forms, labels, headings, native buttons and visible focus outlines retained.
3. **Mobile reflow and reduced motion:** controls/cards wrap and avoid horizontal overflow at 320/390/768/1366 CSS px, with a single-column small-screen grid, bounded replaced elements, `box-sizing:border-box` and `prefers-reduced-motion` styling. Browser asserts horizontal scroll absence, main keyboard entry and reduced-motion media.
4. **Resilient error and permission loss:** status/live regions are retained, with failed provider sections independently reported rather than wiping unrelated authorized host records; sign-out removes in-memory proof and private guest/host contents. Original 420Identity, manager-grant, financial source and legal gates remain server-enforced.
5. **Assistive scenarios and limitations:** [BNB-4.9-ACCESSIBILITY-SCENARIOS.md](BNB-4.9-ACCESSIBILITY-SCENARIOS.md) records NVDA, VoiceOver, TalkBack, large-text/zoom, keyboard and cognitive/contrast human acceptance scenarios without claiming CI has performed real screen-reader or legal signoff.

Changed executable/test files: `web/bnb/index.html` and `services/420bnb/tests/browser_accessibility.py`. No ABI, shared protocol, address, schema or financial execution modifications.

## Exact-SHA Level 1 evidence

- Required [420BnB Runtime Slice **38485502990**](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38485502990), job **`115598070694`**, terminal **SUCCESS** against tested candidate `74d7bb1f66178d915eea0695397b615260138e36`, with executable code identical to `3bda21cf25dff89fef8e0c5e8cce1b65f6f3480f`.
- Logs: **8 PostgreSQL migration/operations tests PASS + 290 app/API/security tests PASS = 298 tests passed; zero failures**. Additionally the mandatory Playwright/axe real Chromium keyboard, focus, mobile/desktop, reduced-motion, provider-failure and accessibility smoke completed SUCCESS; non-root container, backup/restore, configuration, frontend script syntax and deployment verification also passed.
- Nine retained BNB workflows terminal SUCCESS on that same candidate SHA: 1.1 `38485502888`, 1.2 `38485502783`, 1.3 `38485502725`, 1.4 `38485502680`, 1.5 `38485502989`, 1.6 `38485503015`, 1.7 `38485502830`, 1.8 `38485502978`, 1.9 `38485502968`.
- Earlier candidate run `38485373108` was cancelled on PR update; **not** credited. Global Docs `38485502780` intentionally SKIPPED and not credited; separate Oracle workflow `38485502743` was IN PROGRESS. Unrelated 420Hz/Governance failures `38485495445`/`38485496407` are separate, not represented as passing Level 1 BNB evidence.
- No new Level 2 milestone at BNB-4.9; M4-A at BNB-4.7 already certified, M4-B is reserved for BNB-4.11. Comprehensive Phase 4 Level 3 Solidity owner inventory, independent Genesis authority, Integrated, Docs, and exact current-main merge-candidate reconciliation remain deferred to BNB-4.12.

## External gates, phase state and next step

Keep `travel.bnb_booking=false`, `booking_enabled=false`, `financial_execution=false`. All independent Identity/Pay/Wallet/Travel/Compliance, real device/session, operational, legal and **human assistive-technology/WCAG** acceptance requirements in [BNB-TESTNET-WORK-ROADMAP.md](BNB-TESTNET-WORK-ROADMAP.md) remain gated. Automated axe/Chromium PASS is not a human accessibility certificate.

**BNB-4.9 repository Level 1 COMPLETE. PR #631 stays draft/open/unmerged. Next canonical step: BNB-4.10 — Disaster recovery and operations automation.**

The commit adding this certificate is evidence-only; the above executable and tested SHAs remain valid if no executable or substantive requirement changes accompany it.
