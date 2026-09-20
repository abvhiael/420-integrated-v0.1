# GEN-11.20 — Bundler adversarial qualification, reconciliation and closeout

**Status: PR #341 MERGED; GENESIS OPERATOR RELEASE NOT SIGNED OFF.** Repository CI, documentation artifact qualification, live Pages deployment and independent operator acceptance are separate gates. A merged PR or a successful documentation build alone does not constitute a released Bundler network.

## Merge provenance and documentation publication repair

PR [#341](https://github.com/abvhiael/420-integrated-v0.1/pull/341) merged into `main` at [`a57cfb45b73548bc94317528d13b17f6a11ef194`](https://github.com/abvhiael/420-integrated-v0.1/commit/a57cfb45b73548bc94317528d13b17f6a11ef194). The previous open-PR and branch-reconciliation instructions are historical. New documentation or implementation commits require qualification against their own exact SHAs; do not transfer old CI conclusions to newer commits.

The merge-head [420Docs Pages #138](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35492419017) failed at the publication artifact smoke step: it expected `versions/development/current/index.html` and `versions/genesis/current/index.html`, which the current MkDocs flat-compatibility build does not materialize. Its deployment job was skipped. This was a **route-contract/artifact-scope mismatch**, not evidence that the Bundler source failed compilation.

The follow-up [commit `15806c50c48617a41b344815812ba9599c1463c2`](https://github.com/abvhiael/420-integrated-v0.1/commit/15806c50c48617a41b344815812ba9599c1463c2) aligns [`docs/publication/publication-health.json`](publication/publication-health.json) with the artifact actually produced: root and existing flat critical routes are required, while `versions/*` trees are expressly **not materialized or claimed published**. The version manifest describes routing policy and legacy inventory, not evidence of independently rendered release trees. Do not recreate dummy versioned `index.html` pages to silence the smoke check.

On that exact repair commit, [420Docs Qualification #2548](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35493065421) succeeded, and the **build job** of [420Docs Pages #141](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35493065432) succeeded, including `Qualify 420Docs for publication`, `Smoke qualified Pages artifact`, final publication qualification and Pages artifact upload. **At this review the Pages deploy job was queued:** successful upload is not proof that Pages deployment and deployed-route smoke passed. Consult the run's final conclusion for that separate gate. The present closeout-document edit is itself a subsequent commit, not the `15806c50` artifact and not automatically covered by that run.

Future publication of version-qualified development/Genesis URLs requires a real release-specific materialization process, distinct page inventories, publication-policy qualification and deployed-route smoke checks. The flat-compatibility repair does not certify those absent routes.

## Post-merge acceptance matrix

| Gate | Required evidence | Disposition |
| --- | --- | --- |
| A — exact-head repository CI | Required Integrated, Docs, Solidity, Wallet Web/Extension/Mobile, and applicable Genesis checks pass on each claimed release SHA | **CHECK PER SHA.** Pre-merge green checks and individual post-merge successful jobs do not certify every subsequent repair commit. |
| A2 — documentation publication | Build qualification, artifact smoke, upload, Pages deployment and live critical-route smoke all pass for one exact commit | **ARTIFACT REPAIRED; LIVE DEPLOYMENT UNVERIFIED AT THIS REVIEW.** Pages #141 build passed; deploy was queued. Version-qualified release routes remain unmaterialized and must not be advertised. |
| B — independent operators | Two separately controlled Bundlers, persistence and submitter identities; matching chain/EntryPoint and admission/receipt evidence | **OPEN:** no independently verified live two-operator acceptance. |
| C — fallback and ambiguous sends | Live pre-send fallback, timeout-after-accept quarantine, and canonical reconciliation without blind retry | **OPEN for live exercises:** regression tests alone are not operator acceptance. |
| D — Wallet surfaces | Real endpoint acceptance from web/CORS, extension, mobile and native/API clients | **OPEN:** opt-in shared transport exists; the session UI still uses direct EntryPoint submission by default. |
| E — hostile dependencies | Wrong-chain/EntryPoint, stale head, malformed/oversized RPC, peer flood, reorg and restart-with-pending-intent tests with recorded live evidence | **OPEN for live fault-matrix and recovery artifacts.** |
| F — ordering/economics | Full-snapshot FIFO, deterministic tie-break and no fee/Paymaster/operator preference under deployed settings | **PARTIAL:** source and local tests exist; deployed-setting evidence remains open. |
| G — branch reconciliation | Feature changes integrated with `main` and the resulting merge/repair SHAs separately qualified | **MERGE COMPLETE; per-commit qualification must be checked.** PR #341 is already merged; do not request another merge. |
| H — operational signoff | Nonsecret operator/deployment identities, real transaction and canonical block evidence, recovery/reorg observations, incident records and explicit signoff | **OPEN.** Source merges and documentation CI do not imply production deployment. |

## Fail-closed dispositions

A timeout, connection failure or malformed acknowledgement after `eth_sendTransaction` is **ambiguous**. Retain the pending intent, prevent automatic resend and reconcile against canonical chain evidence or an explicit operator procedure. Only a proven explicit rejection permits fresh revalidation and retry. A mempool acknowledgment, local `/status`, persisted audit record, simulation, or transaction hash is not canonical inclusion or finality.

**Release gate:** PR #341 is merged, but GEN-11.20 remains **NOT SIGNED OFF** until gates A–H have their required evidence. Record further repairs under their actual SHAs, keep Pages artifact success distinct from deployed-route success, and do not imply that versioned URLs exist until real versioned content has been rendered and qualified.
