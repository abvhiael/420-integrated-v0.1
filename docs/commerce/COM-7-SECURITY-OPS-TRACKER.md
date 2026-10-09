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
