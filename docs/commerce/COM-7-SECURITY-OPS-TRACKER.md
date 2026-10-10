# COM-7 — Security/ops acceptance and Level 3 closeout

**COM-7 repository-side acceptance and comprehensive Level 3: PASS.** Qualified executable candidate `2648c0b6df52a375c2d6bdbd2839cdbc607ff113`, tree `f8368ce6462db0449256c34e65a5a57407f44b78`, reconciled main `c5a4f220d1fbda01f707d359aa9bb32921a138b1`. Main is an ancestor, with 223 commits ahead and zero behind. The genuine merge `46152b4af8cb82dc4c3b4b7bb269cc614a1b5761` preserves both main and qualified Commerce ancestry. PR #594 remains draft and unmerged.

This evidence-only descendant records the exact tested candidate; it does not claim its own new execution. Full machine-readable workflow/job/step results, source blobs, artifacts and test inventory are in `COM-7-LEVEL3-QUALIFICATION-STATUS.json` and `COM-7-LEVEL3-TEST-INVENTORY.json`.

## Acceptance evidence

All COM-T01–T16 were checked against implementation and actual final-candidate logs. Service/SDK/Indexer: 134 / 33 / 76 passing tests. Web: 39, browser: 20. Upstream Market/Pay: 57, funded refund: 11, Arbitration: 13. No failed or skipped cases in these suites. Retained COM-6 Level 2 is run [38006767611](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38006767611) / job 114077233472 at `95fc1102d5b7700609cadaa95ed443acbe6cf65c`; runtime implementation paths remain unchanged and final component lanes reran.

Bounded HTTP/persistent SQLite drill: 256 requests, concurrency 16, 120 accepted, 136 limited; elapsed 139.344 ms, p95 32.349 ms. Next-window recovery and absence of checkout mutations passed; declared regression budgets are below 15 seconds and p95 below 2 seconds. Persisted nonce exclusion/reopen, duplicate projection recovery and process-exit rollback passed. These are local engineering budgets, not operator-approved production SLOs.

Locked dependency/static checks, canonical ABI comparisons, signing-disabled builds, pinned redacted Commerce-tree Gitleaks (zero leaks), provenance, fail-closed configuration and monitor/recovery regressions passed. Reviewer intake is ready; no independent human security signoff is asserted. SQLite supports one application process per database. Shared-connection/crash evidence does not authorize distributed multi-writer operation.

Canonical Solidity compiled and tested the complete 1,045 primary units (618 source, 426 test, one script), with 2528 reported passing cases, 14 grouped invariant campaigns, 3 single-invariant campaigns, 49 observed invariant assertions and 55 fuzz cases. Normal CI fuzz/invariant budgets and all assertions remain unchanged. Mandatory 64 bounded coverage contexts and exact-SHA four-shard aggregation passed; optimized-IR LCOV mapping remains approximate and diagnostic. Genesis passed five address/manifests/collision/deployment-authority checks and 28 regressions without duplicating Foundry; its live Wallet readiness remains false.

Complete Docs ran all 42 PASS stage lines, strict build and 1,753 rendered pages. Global integration passed offline, fault matrix/soak, production dependencies and pinned local Geth Engine smoke. Local Engine smoke and repository materialization are not testnet deployment.

## Final-candidate workflow results

| Workflow | Run | Result |
| --- | --- | --- |
| 420Stake STAKE-AUDIT-3 | [38041865953](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865953) | PASS |
| Commerce security review readiness | [38041866016](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041866016) | PASS |
| 420Explorer EXP-NEXT.1 Registry Descriptor Provenance | [38041865884](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865884) | PASS |
| 420Randomness RANDOM-AUDIT-5 | [38041865969](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865969) | PASS |
| 420Registry REG-AUDIT-6 | [38041866003](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041866003) | PASS |
| Genesis Address Authority | [38041865958](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865958) | PASS |
| 420Stake STAKE-AUDIT-6 | [38041865966](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865966) | PASS |
| Commerce governed Pay refund qualification | [38041865983](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865983) | PASS |
| 420Hz HZ-GCA-17 Level 3 exact-SHA qualification | [38041866024](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041866024) | PASS |
| Compute Developer Surfaces | [38041865911](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865911) | PASS |
| Commerce merchant builder fast qualification | [38041865916](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865916) | PASS |
| 420Docs Qualification | [38041865932](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865932) | PASS |
| 420 Developer Hub | [38041865978](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865978) | PASS |
| 420Identity ID-AUDIT-4 | [38041865942](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865942) | PASS |
| 420Identity ID-AUDIT-6 | [38041865944](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865944) | PASS |
| Commerce service fast qualification | [38041865909](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865909) | PASS |
| Commerce upstream contracts | [38041865982](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865982) | PASS |
| 420 Integrated Qualification | [38041865960](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865960) | PASS |
| 420Registry REG-AUDIT-7 | [38041865997](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865997) | PASS |
| 420Oracle audit qualification | [38041865869](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865869) | PASS |
| 420Randomness audit qualification | [38041865948](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865948) | PASS |
| 420Rights audit qualification | [38041865928](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865928) | PASS |
| 420Grants Audit Qualification | [38041865853](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865853) | PASS |
| 420AI Audit Qualification | [38041865921](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865921) | PASS |
| Solidity Contracts | [38041865973](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38041865973) | PASS |

9 conditionally skipped workflows are explicitly excluded from passing evidence. Conditional skipped jobs within passing workflows are also listed separately in JSON. No queued, failed or cancelled final-candidate job is promoted to PASS.

## Superseded failed candidates

The earlier tolerated Yul coverage failure is retracted in `COM-7-COVERAGE-RECONCILIATION.md`. Candidate `7379236e7a688d9ff0666b87f2949ff1b5b8c28b` passed normal canonical tests but failed mandatory coverage, run 38028988533 / job 114145814151: mutable cache lost `script/Decision10DeploySeed420.s.sol`. That candidate is NOT Level 3 qualified. The final candidate captures the complete exact-SHA graph before sparse cache pruning. Candidate `f6a642b33d2a59ff94387e94cf56c3aed899c631` subsequently failed native coverage context 9 (run 38032286595 / job 114155612335), with nine completed coverage contexts. The final coverage-only bridge retains that compiler failure and exact inputs, permitting one retry only for a Yul stack-depth error with a pinned non-inlining optimizer sequence. The abbreviated sequence failed again on candidate `23ea85c907a37791584ffb6c3c9bf741427fc50f` (run 38038205736 / job 114173041314). Focused native replay run 38041352046 / job 114182065699 verified all 100 source contents and compiled the complete retained input using Solc 0.8.24's full default sequence with only full function inlining removed. This verified sequence replaces the abbreviated retry. Both temporary replay jobs deliberately failed after recording experiments and are NOT qualified; their temporary workflow/script is removed. Compiler diagnostics are separate from the final passing coverage execution. All 18 harness regressions and final coverage gates passed. Candidate `2f576b41ecaee19e48f607f405f8ab9580111b54` failed before coverage execution because the directly invoked compiler bridge lacked execute permission (run 38035654957 / job 114165461822); it is NOT qualified. The final candidate restores execute permission and checks it before compilation. No contract/test source, assertion, normal compiler profile or qualification budget was relaxed.

## Remaining acceptance gates

Next canonical milestone: **COM-8 — TESTNET HANDOFF**.

- Approved testnet chain/RPC/Registry/Wallet/runtime-code/version and manifests; release approval and frozen PAY-AUDIT-6 identities.
- Real merchant/listing/invoice/native payment/settlement/funded refund transactions with finalized receipts, balances and Market stock/status correlation.
- Approved executable Swap or documented unsupported route; no invented success.
- Live Arbitration/Identity/Names/Notifications integrations and canonical service policy.
- Operational keys/storage/retention, DNS/TLS/CSP/edge, monitoring and alert delivery; deployed outage/reorg/recovery and operator capacity budgets.
- Any multi-instance operation requires coordinator/worker ownership, nonce/idempotency, distributed rate limits, migration/crash and delivery evidence.

PAY-AUDIT-6 frozen release identities remain unreconciled. Canonical Market refund status accepts full Pay accounting without funded payout proof; Commerce verifies funded payout separately. Neither limitation is waived by repository qualification. Notifications are a local opt-in finalized feed, and analytics is bounded page-local. COM-9 requires independent external review/findings/signoff and authorized production release. PR #594 is ready for repository-scope merge review following this Level 3; no merge, release or testnet acceptance is asserted.
