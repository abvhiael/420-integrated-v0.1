# COM-7 security qualification: threat-to-test evidence and independent review intake

Audit snapshot: 2026-10-09. PR #594, exact executable SHA `95fc1102d5b7700609cadaa95ed443acbe6cf65c`; documentation updates after this SHA are not additional executable qualification. This is an evidence index, **not** independent security signoff and **not** a Level 3 pass.

## Retained exact-SHA CI evidence

- Service/SDK/Indexer, run [38006770588](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38006770588), job 114077244597: successful including 131 node service tests, no failures/skips. Includes scoped dependency audit, ABI/compile and Indexed reorg/restart checks.
- Builder/browser, run [38006770545](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38006770545), job 114077245093: successful, 39 node web tests, 20 browser integration checks, zero failures/skips; browser acceptance uses mock Wallet/RPC with real signed HTTP/SQLite/SDK.
- Upstream, run [38006770483](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38006770483), job 114077314313: successful, 57 targeted Market/Pay contract tests and funded refund/Arbitration qualification, not full Foundry inventory.
- Governed Pay [38006770604](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38006770604): successful safety/authority checks.
- COM-6 retained Level 2 [38006767611](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38006767611): successful.
- Solidity [38006770521](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38006770521): scope classification success, full Foundry jobs **skipped**. Not Level 3 evidence.

## Threat mapping: observed test names/files and limits

| Threat | Concrete evidence owner / observed regression | Repository scope | Gate not established by these tests |
| --- | --- | --- | --- |
| COM-T01 forged receipt/finality | `contracts/test/MarketPaySettlementAdapter420.t.sol`; upstream log `testRejectUnfinalizedPayment`, `testRejectMissingReceipt`, `testRejectWrongAmount`; `commerce/test/native-receipt.test.mjs` | Targeted PASS | Real finalized chain correlation |
| COM-T02 reporter/proof replay | Same Foundry suite: `testRevokedReporterRollsBackReplayState`, `testSecondPaymentCannotReplaceBinding`, `testRejectWrongInvoice` | Targeted PASS | Governance deployment/rotation in live environment |
| COM-T03 controller/payout | `commerce/test/com7-security-ops.test.mjs` controller rotation; service log `tenant IDOR and unknown financial fields cannot cross scope or redirect payout`; builder Pay registration review | Targeted PASS | Live MerchantRegistry/payout owner verification |
| COM-T04 reservation/revision race | `commerce/test/com7-security-ops.test.mjs` 20 concurrent checkout retries; service log canonical stock/revision negative tests | Targeted PASS | Actual Market chain stress, concurrent cancellation/release |
| COM-T05 replay/idempotency | `commerce/test/service.test.mjs`, `commerce/test/projection.test.mjs`; service log duplicate inbox/outbox and idempotent preparation; `testSecondPaymentCannotReplaceBinding` | Targeted PASS | Cross-instance distributed idempotency under failures |
| COM-T06 Swap adversarial | `commerce/web/test/native-pay.test.mjs`; web log unqualified Swap rejects forged quote/route; rejected without approved execution adapter | Fail-closed unsupported route PASS | Any live approved Swap routing; no swap-success assertion |
| COM-T07 refunds/stock | `contracts/test/RefundManager420Funded.t.sol`, `testPartialRefundNeverReleasesStock`; `commerce/test/com6a-refund.test.mjs` | Targeted PASS | Live Pay governance-funded refund and full Market synchronization |
| COM-T08 reorg/finality | `commerce/test/projection.test.mjs`, `commerce/test/worker.test.mjs`; service log finalized mismatch halt, nonfinal fork replacement and restart rebuild | Targeted PASS | Real RPC/Indexer reorg and multi-instance restart |
| COM-T09 tenant IDOR | `commerce/test/security.test.mjs`, `commerce/test/service.test.mjs`, `commerce/test/com7-security-ops.test.mjs`; controller rotation and delegated rights | Targeted PASS | Deployed auth/credential revocation |
| COM-T10 malicious media | `commerce/test/security.test.mjs`; logs JPEG/PNG/WebP re-encode, metadata stripping, SVG/HTML/MIME confusion, dimensions; web malicious-content test | Targeted PASS | Production object storage scanning/quarantine and stress |
| COM-T11 private PII | `commerce/test/security.test.mjs`, `commerce/test/http-sdk.test.mjs`; log AEAD tenant/order tamper rejection and audited physical purge | Targeted PASS | Deployed key management, retention, third-party log inspection |
| COM-T12 manifest/provenance | `commerce/test/authority.test.mjs`, `commerce/web/test/wallet.test.mjs`; wrong code/chain/Registry tests | Targeted PASS | Real published manifests, DNS/TLS and Cloudflare settings |
| COM-T13 CSRF/nonce/XSS | `commerce/test/http-sdk.test.mjs`; signed origin/chain/wallet/method/body/expiry/one-use nonce; cross-origin tests and text-safe browser rendering | Targeted PASS | Real edge/session/CSP verification on deployed origin |
| COM-T14 abuse/load | `commerce/test/http-sdk.test.mjs`; bounded 429/503 HTTP burst and pagination negatives, concurrency limits | Local harness PASS | Quantified production-like multi-instance soak/capacity SLO |
| COM-T15 dispute/role | `commerce/test/com6b-dispute.test.mjs`, `commerce/test/arbitration-adapter.test.mjs`; targeted Arbitration contract tests | Targeted PASS | Live governance-authorized dispute remedy |
| COM-T16 secrets/config | `commerce/test/authority.test.mjs`, `commerce/web/test/wallet.test.mjs`; static browser builder says signing disabled without approved configuration | Targeted PASS | Independent secret scan, deployed edge configuration and DNS/TLS attestation |

## Recovery and operational acceptance — split into distinct gates

**Repository evidence present:** durable inbox/outbox replay, nonfinal reorg rollback, finalized mismatch permanent halt, failed canonical RPC refusal, controller revocation, AEAD/purge tests, bounded in-process burst and `commerce/src/monitor.mjs` health fail-closed tests. Incident procedure: `docs/commerce/COM-7-INCIDENT-OPERATIONS-RUNBOOK.md`.

**Repository-side work that still needs independent execution/recording before unqualified COM-7 acceptance:** a repeatable bounded-load result with explicitly approved thresholds and artifacts; restart/recovery exercise covering actual backing persistence and two competing service instances or an evidence-backed justification for deferral; static/dependency/secrets and configuration review with exact-SHA results; independent reviewer-ready checklist with explicit non-reproducible risks. Test file presence alone does not close any acceptance criterion.

**COM-8 testnet-gated acceptance (explicitly NOT passed):** real Market/Pay chain deployment and funding; finalized settlement and actual refund tx hashes; approved Swap route or documented unsupported route; Wallet/Registry/code/chain binding, actual Cloudflare DNS/TLS, deployed monitoring/alert delivery, RPC outage drill and multi-instance restart; external systems, production-scale load and independently verified operational controls.

**COM-9/mainnet gates (NOT passed):** third-party review signoff and authorized production deployment, incident rehearsal and independent operational audit. A repository checklist cannot impersonate a human independent reviewer.

## Independent security-review handoff package

Reviewer entrypoint: `docs/commerce/COM-1.7-SECURITY-THREAT-MODEL.md`; canonical authorities `docs/420-MARKET-V1-MODEL.md` and `docs/420PAY-IMPLEMENTATION-STATUS.md`; COM-7 runbook and tracker; COM-2..COM-6 architecture and qualification evidence; scoped runs above; `commerce/src/{security,service,projection,worker,http,monitor}.mjs`; `commerce/web/{native-pay.js,core/wallet.js}`; upstream `contracts/src/market/MarketPaySettlementAdapter420.sol`, `contracts/src/pay/RefundManager420.sol`; relevant service/web/Foundry tests; privacy/encryption design and SQL schemas. Before actual external signoff collect reviewer identity/independence, engagement scope, code SHA, threat matrix review notes, vulnerability severities, reproduction and remediation SHA, unresolved risk acceptance and signed conclusion. No such external approval is asserted here.

## Qualification decision

**Scoped post-reconciliation Level 1 PASS on executable SHA `95fc1102...`. Comprehensive Level 3 NOT EXECUTED and COM-7 UNQUALIFIED pending unresolved gates.** Do not promote skipped Foundry or absent Genesis/Docs/420 Integrated/deployment checks to successes. Build one exact current-main merge candidate only after repository-side acceptance is complete; Solidity owns the single complete Foundry inventory, Genesis only address/manifest, then appropriate Docs, global, security, deployment and retained Commerce checks. PR #594 remains draft/unmerged.
