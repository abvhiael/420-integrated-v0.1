# TREASURY-REC-6 — Grants, Wallet and Ecosystem Integration

Status: **COMPLETE — repository-local integration qualification PASS**.
Baseline: `a1f1164f3a147af52cd36e3b872464ef29eb3476` (REC-5 executable-qualified merge, its separately recorded security closeout remains open).

## Consumer changes

- Grants rejects an expired, missing, or contradictory SCHEDULED Treasury record at approval and rechecks the original exact tuple and reverse binding at PAID/cancellation. PAID continues to mean EXECUTED plus nonzero release commitment, not independently verified asset transfer. Expiry never automatically detaches an approved milestone; canonical Treasury cancellation comes first. Executed history can be finalized after expiry. The external Treasury view ABI is unchanged.
- Wallet service discovery requires the frozen ProtocolRegistry and chain-pinned code hash, active service plus distinct router component, matching runtime codehash, recomputed canonical dependency root, active registration profile and constructor/Timelock graph. The capability component is separate. Typed Civic actions are prepared without broadcasting; existing Civic commitment review remains authoritative.
- Wallet release preparation requires the designated executor deployment pin, operator SmartAccount, exact execution capability and canonical commitment preview; no raw arbitrary commitment handoff is introduced. Existing SmartAccount owner execution and explicit confirmation, fresh simulation, chain/account revalidation and canonical receipt handling are used. Production configuration is intentionally null pending REC-8/AUDIT-8, not a fake deployed address. No new public Treasury website.
- SDK packages the same exact executable discovery and action preparation runtime. Wallet UI consumes the canonical client and shows commitment-only evidence and explicit receipt status.
- HighCountry gateway's supplied nonzero release commitment is not independent transfer evidence. It retains independent Treasury capability and organization permission gates; Town treasury references are permission-scoped references only. No new custody authority.
- Indexer/Analytics/Explorer derived read-model reconciliation remains REC-7, deployment artifact materialization REC-8 and live receipts AUDIT-8.

## Qualification

Targeted exact-head workflow: `.github/workflows/treasury-consumer-qualification.yml`. Real Grants/Treasury/capability/Registry contracts, retained Grants adversarial suite, Town and HighCountry integration owners, Wallet tests and SDK build/packaging. The implementation SHA is `c1507c3f8885246843da51a930468ec354eff22b`. Exact-head [workflow 44590461793](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44590461793), job `135794911879`, completed successfully on this SHA:
- Treasury/Grants real-contract integration: 7/7; Grants lifecycle/adversarial: 17/17; Town authority: 3/3; HighCountry Treasury identity/capability: 2/2.
- Wallet/Civic/app catalogue/Grants handoff and Treasury regressions: 33/33, including wrong-chain, incorrect dependency root/runtime/controller/Registry, failed simulation, rejected confirmation, changed account/network and canonical receipt handling.
- SDK build, byte-identical shared Treasury runtime packaging, SDK integration: 1/1.
- Total targeted tests: 63/63; zero failures or skips. All six Grants/Treasury audit, release, ABI/integration and documentation verifiers passed.
- [Grants Audit Qualification 44590461850](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44590461850): job `135794751486` CI profile 20/20 (3 deployment + 17 lifecycle); job `135794750974` hardening 17/17, forbidden-primitives scan PASS, Slither high severity empty; job `135795252728` Indexer 9/9 and Wallet 14/14, build/verifiers PASS. These are additional executions of partially overlapping suites, not additional unique REC-6 tests.
- [Browser accessibility 44590462083](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44590462083), job `135794865917`, PASS.
- Earlier [44589656371](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44589656371) passed the initial candidate; legacy Grants run `44589655741` failed compilation of unrelated Bridge imports. Corrected legacy Grants workflow to use the exact byte-preserved Grants import closure with original Foundry profiles, test selectors and static analysis unchanged. The final workflow above passes; no skip or weakened assertion.
- The superseded candidate's run `44590314926` was cancelled by the subsequent candidate update; not counted as passing evidence.

## Remaining boundaries

No testnet dependency for this local step. Production Wallet Treasury pins remain intentionally unset until release materialization and live deployment evidence (REC-8/AUDIT-8). PAID and confirmed transaction status remain commitment-only, not independent transfer verification. REC-5's separate open Slither/Stake security-review findings are unchanged by this step and are not claimed closed. REC-7 owns derived read-model reconciliation. This evidence-only closeout does not change any qualified source, tests, configuration, or workflow.
