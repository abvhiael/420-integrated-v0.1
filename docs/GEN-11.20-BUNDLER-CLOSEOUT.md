# GEN-11.20 — Bundler adversarial qualification, reconciliation and closeout

**Status: IN QUALIFICATION; NOT SIGNED OFF; NOT MERGED.** This document records repository evidence separately from live deployment evidence. Green CI does not establish that production Bundlers, independent operators, or real Wallet clients have successfully executed a UserOperation.

## Repository inventory and provenance

PR: https://github.com/abvhiael/420-integrated-v0.1/pull/341 — `feature/gen11-0-bundler-network-v1` targeting `main`.

The current closeout candidate before this documentation update was `f934216c5022fdd3c3bde239750cb19b931a5e26`. Its GitHub Actions checks at review were successful for 420 Integrated Qualification #4884, 420Docs Qualification #2453, Wallet Web Verification #860, Wallet Extension Verification #401, and Wallet Mobile Verification #1025; Solidity Contracts #2910 was still in progress. **These are observations about that exact prior SHA, not test results for this documentation commit or proof of release readiness.** Recheck all required workflows for the exact final head after every change and after any reconciliation with `main`.

The branch includes implementation and tests for GEN-11.18 FIFO ordering/economics (`bundler/ordering`, `bundler/bundle/ordering_test.go`) and GEN-11.19 operator/client interoperability (`bundler/interoperability`, `bundler/rpcapi/interoperability_test.go`, `cors.go`, and the opt-in `wallet/web/core/bundler-transport.js`). Its GEN-11.20 adversarial tests cover malformed/oversized public RPC, cancellation and ambiguous transaction acknowledgments, explicit rejection versus ambiguous-send retry handling, persistence/restart, peer admission, receipt/reorg, and other package-local boundaries. The existence of these tests does not substitute for independently observed live behavior.

At this review `main` and the feature branch had diverged: the feature was **147 commits ahead and 473 commits behind `main`** according to GitHub compare. The PR was open, unmerged, and GitHub reported it mergeable at the pre-documentation head. GitHub's mergeability indicator does not replace semantic reconciliation of overlapping changes or final-head requalification. Prior closeout evidence referred to an older `main` offset and an older pre-closeout candidate; use the current comparison and exact-head results rather than those stale values.

## Closeout acceptance matrix

| Gate | Required evidence | Current disposition |
| --- | --- | --- |
| A — final exact-head CI | Integrated, Docs, Solidity, Wallet Web, Extension, and Mobile all pass on the final reconciled commit | **OPEN.** Prior candidate had five green checks and Solidity still running at review; this documentation change requires fresh exact-head CI. |
| B — independent operators | Two independently deployed Bundlers with separate storage and submitter identities; verified common chain ID/EntryPoint; matching admission/receipt behavior | **OPEN.** Mock-backed tests do not prove this. |
| C — fallback and ambiguous-send behavior | Real Wallet fails over before initial submission; an ambiguous post-send result is quarantined and reconciled without automatic cross-operator rebroadcast | **OPEN for live clients/operators.** Repository regression tests cover the rules. |
| D — actual Wallet surfaces | Web origin/CORS, extension, mobile, and native API exercised against real operator endpoints; compare canonical hashes/nonces/receipts and false-finality safeguards | **OPEN.** Shared opt-in Wallet transport alone does not establish full surface integration. |
| E — hostile dependencies | Record live wrong-chain/EntryPoint, stale head, malformed and oversized responses, replay/flood/peer refusal, reorg, and restart-with-pending-intent fault exercises | **OPEN for live fault-matrix logs.** Unit tests exist. |
| F — ordering and economics | Confirm full-snapshot FIFO before truncation, deterministic tie-break, replacement queue position, and absence of fee/paymaster/operator preferential lanes under actual configured settings | **PARTIAL.** `fifo-v1` source and unit tests are present; final exact-head qualification and deployed-setting evidence remain. |
| G — reconcile `main` | Review divergence and overlapping source/configuration, reconcile feature with current `main`, inspect resulting diff/mergeability, rerun all required workflows on resulting head | **OPEN.** Feature was 473 commits behind `main` at this review. |
| H — operational signoff | Capture nonsecret deployment URLs/operator identities, chain ID/EntryPoint, actual tx and canonical block hashes, incident/reorg observations, logs and explicit signoff | **OPEN.** No independent live evidence is asserted here. |

## Fail-closed dispositions

An execution-RPC timeout, connection failure, or malformed acknowledgment after `eth_sendTransaction` has an **ambiguous** outcome; preserve unresolved submission intent and prevent automatic resend until canonical evidence or an explicit operator reconciliation is available. Only a proven explicit RPC rejection is eligible for a fresh revalidation/retry. Do not label a mempool acknowledgment, `/status` metric, persisted audit record, simulated receipt, or transaction hash as canonical inclusion/finality.

**Merge gate:** Do not mark GEN-11.20 COMPLETE, merge PR #341, or claim Genesis deployment readiness without evidence for gates A–H. In the absence of deployed independent operators and live Wallet evidence, keep the PR open and this record explicitly pending.