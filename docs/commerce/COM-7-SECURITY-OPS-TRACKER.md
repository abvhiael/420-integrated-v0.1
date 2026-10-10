# COM-7 — Security/ops audit and qualification tracker

Canonical definition: `docs/commerce/COM-1-ARCHITECTURE-AND-ROADMAP.md`, COM-7: payment adversarial tests, reservation races, swap failures, auth/tenant isolation, upload security, load, recovery, monitoring, independent security review readiness and Level 3 repository closeout. COM-8 is a separately blocked live testnet handoff, not a substitute for repository qualification.

## Baseline

- PR #594, branch `audit/420commerce-com-2-upstream-adaptations`; previously qualified COM-6 accumulated milestone implementation `37887e89f613a6a48e3738a39362e8e731ea6f9a`, evidence-only HEAD `242b9eb5f7109672d1fdeca99ada2ed8f429a915`.
- `main` SHA at initial audit `f8bbb62e1cdfe68cff25261fd4a036db1840a15c`; PR's recorded base `41d173dbcfbeb8299f54f22e7c049f1fec20336d`.
- Retained service/SDK/Indexer, browser and Market/Pay/Arbitration qualification exists in `.github/workflows/commerce-com6-level2.yml`. COM-7 must not assert full inventory or global phase PASS based on these narrower checks.
- Financial authority remains canonical governed Pay and Market; Commerce projections and 420Analytics cannot grant execution authority. COM-8 real chain/adapter acceptance is deferred but cannot be recorded as passed.

## Control matrix: existing evidence versus COM-7 gates

| Area | Existing controls observed | Required COM-7 closeout |
| --- | --- | --- |
| Payment/adversarial | Canonical source correlated to invoices, settled payment, receipt and finalized Market state; targeted Foundry and SDK negative tests | Fresh threat-to-test matrix for forged reporter, replay, wrong payout, refund races and canonical source staleness; verify retained exact SHA |
| Reservation races | Revision/stock, policy and adapter checks, idempotent cart/order preparation | Concurrency and depletion race evidence against Market owner, cancellation/fulfillment/release recovery invariants |
| Swap failures | Swap restricted to governed route as specified by earlier architecture | Stale quote, under-delivery, blocked recipient, reverting swap, nonce replay, cross-chain/policy failure regression |
| Auth/tenant | Wallet signed origin/chain/body/nonce; fresh merchant owner and delegate authorization; IDOR tests | Cross-resource horizontal/vertical auth matrix; abuse/CSRF/nonce exhaustion and owner rotation |
| Upload/privacy | JPEG/PNG/WebP bounded re-encode, media metadata stripped; purpose-encrypted delivery; retention purge | Malicious large-media/load stress, private data leak/log review and secret/config exposure checks |
| Load/recovery | HTTP concurrency limit/rate cap, request timeout; Indexer durable inbox/outbox and halt/rebuild | Bounded load and failure/restart drills with retained traces and pass thresholds |
| Monitoring | Health endpoint reports projection state, startup/tick emits minimal unavailable state | Metrics/alerting and incident response/runbooks; evidence for degraded/stop/recovery |
| Security review | COM-1.7 threat register COM-T01–T16 | Independent review readiness package; external security signoff must not be fabricated |
| Phase closeout | COM-6 app Level 2 qualified | Reconcile current main, single exact merge candidate, Level 3 full canonical Solidity once; Genesis address authority separately; 420 Integrated and Docs/global where applicable; no duplicate full Foundry |

## Initial COM-7 hardening candidate

- `commerce/src/http.mjs`: reject ambiguous/noncanonical numeric pagination input (empty/leading-zero/scientific notation), add explicit X-Frame-Options DENY and Permissions-Policy, and HSTS on approved HTTPS origin.
- `commerce/test/http-sdk.test.mjs`: regression for these API/security requirements.
- Implementation SHA `0ee8eb1ff3b31947ddd89b379cc77acf2b4c6beb`. Tests were only queued at document authoring; **not a qualified COM-7 SHA**.

## Exit status

**COM-7 IN PROGRESS / NOT QUALIFIED** until all original security/ops requirements have documented applicable test evidence, current-main reconciliation, and applicable complete Level 3 pass. Do not merge PR #594. Next canonical milestone after COM-7 repository closeout: **COM-8 TESTNET HANDOFF**, blocked on actual service/network/authority deployment and real transaction evidence.

## October 9 security candidate and exact-SHA CI status

Implementation SHA: `06de4a1ce04663c30fa89590db654bb096cd91d9`. The implementation includes hardened HTTP semantics, in-process concurrency/rate-abuse and privacy tests, fail-closed monitoring module and controller/finality/recovery regressions. Associated app CI results at last inspection:

- Governed Pay refund qualification: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38000707594 — **completed/success**.
- Merchant builder/browser: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38000707717 — **completed/success**.
- Commerce service/SDK/Indexer: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38000707692 — queued (NOT PASS).
- Retained upstream Market/Pay/Arbitration: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38000707811 — queued (NOT PASS).

The latter two jobs have not started at capture time; this is a runner/queue condition, **not** evidence of successful qualification nor an observed implementation test failure.

Main-branch reconciliation is outstanding: GitHub compare of `main` and audit branch reported **205 commits ahead / 410 behind**, with merge base `41d173dbcfbeb8299f54f22e7c049f1fec20336d`. Do not invent a synthesized merge-SHA or use the unmerged branch's fast suite as Level 3 evidence. No canonical full Solidity, Genesis/address authority, 420 Integrated/global, Docs/global or single merged-candidate Level 3 pass has been performed for COM-7. Preserve PR #594 as draft and unmerged.

## Reconciled implementation and COM-7 acceptance mapping (October 9, 2026)

**Canonical merge reconciliation:** exact first parent `3d9ef79b572820ef067a15e060ac7c52e9677605`, exact second parent `f8bbb62e1cdfe68cff25261fd4a036db1840a15c`, reconciled merge `84601d909ee71d8bb48d15af81ea612cba8dc531`, tree `1c7f5cad930a58ff57976d7b70091dceaf32b891`. Both sides of the common base `41d173dbcfbeb8299f54f22e7c049f1fec20336d` were compared: 113 Commerce-branch changed files and 205 `main` changed files with **no overlapping paths**; all Commerce files were copied into a new tree on top of the exact main tree. The merge SHA's tree and parents were independently re-fetched; GitHub comparison then reported zero commits behind `main`. This reconciled branch is **not a Level 3 qualification**.

### Repository-side acceptance gates and retained evidence owners

- **COM-T01/T02/T03 / financial identity and settlement**: `commerce/test/native-receipt.test.mjs`, `commerce/test/com6a-refund.test.mjs`, `commerce/web/test/native-pay.test.mjs`, `scripts/commerce/qualify-contracts.py` (canonical Market/Pay, reporter, receipt, controller/payout and funded refund checks); payment never asserted final from a transaction broadcast. Real transaction proof remains COM-8.
- **COM-T04/T05 / reservation concurrency and replay**: `commerce/test/service.test.mjs`, `commerce/test/com7-security-ops.test.mjs` plus owning Market Foundry tests; burst retries must reuse one checkout attempt and SQL must not mutate canonical reserved stock.
- **COM-T06 / Swap**: `commerce/web/native-pay.js` rejects absent approved Swap quote/settlement adapter; `commerce/web/test/native-pay.test.mjs` includes unapproved, stale, under-delivering, recipient-substituted, network-mismatch, replay and reverting-quote negatives. **No live approved Swap execution acceptance is claimed**, which belongs to COM-8 if the route becomes supported.
- **COM-T07/T08 / refunds and reorgs**: `commerce/test/com6a-refund.test.mjs`, `commerce/test/com6-merchant-operations.test.mjs`, `commerce/test/projection.test.mjs`, `commerce/test/worker.test.mjs`; canonical funded Pay partial refund is not conflated with Market terminal refund; unknown finalized ancestry halts.
- **COM-T09/T13 / wallet, CSRF and tenants**: `commerce/test/security.test.mjs`, `commerce/test/http-sdk.test.mjs`, `commerce/test/com7-security-ops.test.mjs`; per-request signed chain/origin/method/body nonce, tenant and controller rotation; rejects cross-origin writes and unknown authorization.
- **COM-T10/T11 / upload, PII, privacy**: `commerce/test/security.test.mjs` exercises media MIME/magic, dimension/active content and PII encryption; `commerce/test/http-sdk.test.mjs` verifies private media and delivery tenant boundaries. Browser and service upload quarantine/retention are local only.
- **COM-T12/T16 / manifest, runtime and secrets**: `commerce/test/authority.test.mjs`, `commerce/web/test/wallet.test.mjs` and `commerce/src/server.mjs` hash-verified manifest, fixed chain code and origin; no production secret or DNS/TLS attestation here.
- **COM-T14 / DoS and loads**: bounded HTTP burst and rate-reset regressions in `commerce/test/http-sdk.test.mjs`; concurrency and read-work limits in `commerce/src/http.mjs`. These are app-harness tests, **not** production load/soak measurements.
- **COM-T15 / role/Arbitration boundaries**: `commerce/test/com6b-dispute.test.mjs`, `commerce/test/arbitration-adapter.test.mjs`; no Commerce-operator-controlled fund transfers.
- **Ops/recovery/monitoring**: `commerce/src/monitor.mjs`, `commerce/test/com7-monitor.test.mjs`, `commerce/test/worker.test.mjs`, `docs/commerce/COM-7-INCIDENT-OPERATIONS-RUNBOOK.md`; deployment alert delivery, multi-instance operations and human incident rehearsal have not been independently confirmed.

### Exact-SHA status and required next boundary

Post-reconciliation executable candidate `95fc1102d5b7700609cadaa95ed443acbe6cf65c` contains Swap negative tests in addition to the merge commit. Its exact-SHA applicable CI must complete before COM-7's newly added tests can be qualified. Older successes for `3d9ef79...` are historical/retained evidence, **not** substitutes for the post-merge suite. This update is documentary evidence only. Do not claim independently reviewed production security, live Swap, full chain settlement, multi-instance recovery or Level 3. The final COM-7 phase-closeout must run full canonical Solidity under its owning workflow, Genesis address authority separately, relevant global/Docs and retained Commerce on one exact merge-candidate SHA; PR #594 remains unmerged.


## Post-reconciliation Level 1 verification — October 9, 2026

Confirmed executable implementation SHA: `95fc1102d5b7700609cadaa95ed443acbe6cf65c`. All five directly applicable workflows completed successfully **on that exact SHA**, with individual required executed steps reporting success:

| Scope | GitHub Actions run | Verified status |
| --- | --- | --- |
| Commerce service / SDK / Indexer / adversarial | [38006770588](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38006770588) | completed / success |
| Merchant builder / real-service browser | [38006770545](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38006770545) | completed / success |
| Governed Pay safety | [38006770604](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38006770604) | completed / success |
| Upstream Market/Pay/Arbitration scoped contract tests | [38006770483](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38006770483) | completed / success |
| Retained COM-6 Level 2 | [38006767611](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38006767611) | completed / success |

Solidity run [38006770521](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38006770521) classified the PR successfully but **skipped** the full Foundry jobs. These skips do not qualify the canonical full inventory. Existing implementation tests establish local/integration harness behavior, not production-scale load, deployed monitoring/alert delivery, live multi-instance restart, independent external review, real funded chain settlement or COM-8 acceptance.

At inspection, PR #594 was open/draft at documentation-only HEAD `284ff81fcb532cd8dd345ec50a5a941130ab14d6`, and comparison with then-current main `f8bbb62e1cdfe68cff25261fd4a036db1840a15c` yielded 211 ahead / zero behind. This entry is evidence-only. **COM-7 remains in progress; Level 3 has not run and PR must not merge** until canonical acceptance coverage and a single new exact-SHA Level 3 merge candidate are independently established.
