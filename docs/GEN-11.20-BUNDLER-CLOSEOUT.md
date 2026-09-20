# GEN-11.20 — Bundler adversarial qualification, reconciliation and closeout

**Status: PR #341 MERGED; REPOSITORY CORE CI QUALIFIED AT RECORDED SHAs; GENESIS OPERATOR RELEASE NOT SIGNED OFF.** The repository merge, CI, documentation publication, live-operator acceptance, dedicated application/contract qualification and 420AI settlement are different evidence scopes.

## Merge and exact-head repository qualification

[PR #341](https://github.com/abvhiael/420-integrated-v0.1/pull/341) merged into `main` on 2026-09-20 at exact merge commit [`a57cfb45b73548bc94317528d13b17f6a11ef194`](https://github.com/abvhiael/420-integrated-v0.1/commit/a57cfb45b73548bc94317528d13b17f6a11ef194). The old feature-branch-divergence, open-PR and merge-pending statements are historical; do not request another merge of #341.

At that exact merge commit, [420 Integrated Qualification](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35492418997) **passed all four jobs**: offline-core (`go test ./...` and consensus/execution builds), production dependencies, Geth-engine (pinned Geth build and live-engine smoke), and fault matrix (fault tests and 120-slot soak). This is post-merge repository-core evidence, **not** evidence of two independent production Bundlers, user-facing Wallet rollout, deployed-setting FIFO acceptance or 420AI settlement readiness.

### Later main-branch qualification ledger (reviewed 2026-09-20)

A later main source tree, [`e88cf66fdac0581ff69ac7d3f83ff17ea296c684`](https://github.com/abvhiael/420-integrated-v0.1/commit/e88cf66fdac0581ff69ac7d3f83ff17ea296c684), has separately recorded CI. This is the **pre-evidence-documentation SHA**; subsequent documentation edits including this file do not inherit its CI result automatically.

| Gate / run | Result at `e88cf66` | Evidence scope |
| --- | --- | --- |
| [420 Integrated Qualification #5060](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35493251055) | **PASS** | Four jobs: offline-core Go tests/builds, production-dependencies, pinned Geth and live-engine smoke, fault matrix and 120-slot soak. Does not cover all dedicated contract/application workflows. |
| [420Docs Qualification #2553](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35493251082) | **PASS** | Documentation qualification for this exact SHA. |
| [420Docs Pages #142](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35493251076) | **PASS** | Pages build and deployment jobs succeeded; version-qualified release trees remain unmaterialized. |
| Dedicated Solidity Contracts | **NO RUN ON THIS SHA ESTABLISHED** | Qualify the final release candidate with the dedicated Solidity workflow; prior contract results are historical, not transferable. |
| Dedicated Wallet Web / Extension / Mobile | **NO RUN ON THIS SHA ESTABLISHED** | Qualify all required surfaces on the final release candidate, then collect independent real-endpoint acceptance. |
| Applicable Genesis contract/application checks | **NOT ESTABLISHED ON THIS SHA** | Enumerate and run independently required checks; `go test ./...` does not cover Solidity, frontend, device, external chain or deployed operator behavior. |

The earlier feature-head [`ad169da228d94da6b873628314bdd7223e3035af`](https://github.com/abvhiael/420-integrated-v0.1/commit/ad169da228d94da6b873628314bdd7223e3035af) had successful [Integrated #4920](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35485449080), [Docs #2474](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35485449148), [Solidity #2920](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35485449162), [Wallet Web #877](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35485449088), [Wallet Extension #418](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35485449221) and [Wallet Mobile #1042](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35485449369). Those runs qualify only that older branch SHA, not the final main release candidate.

## Separate 420Docs publication incident and repair — NOT 420AI settlement evidence

The merge-head [420Docs Pages #138](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35492419017) failed at artifact smoke because the flat MkDocs build did not materialize `versions/development/current/index.html` or `versions/genesis/current/index.html`. Pages deployment was skipped for that run. This was an artifact/route-contract mismatch, not a Bundler source compilation or 420AI payout failure.

The [publication-health correction `9930d75981312ab2a84888cb47cc684c9d8dd00e`](https://github.com/abvhiael/420-integrated-v0.1/commit/9930d75981312ab2a84888cb47cc684c9d8dd00e) and [documentation clarification `15806c50c48617a41b344815812ba9599c1463c2`](https://github.com/abvhiael/420-integrated-v0.1/commit/15806c50c48617a41b344815812ba9599c1463c2) aligned the health contract with the rendered **flat compatibility** corpus. On exact `15806c50`, [420Docs Qualification #2548](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35493065421) **passed** and [420Docs Pages #141](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35493065432) **passed build and deploy**, including both artifact and deployed-site smoke; the [420 Integrated Qualification #5055 rerun](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35493065425) passed all four jobs. The later `e88cf66` Docs/Pages evidence is separately listed above. A formerly queued Pages deploy observation is superseded by these completed successful runs.

**Publication limitation:** Development/Genesis `versions/*` trees remain unmaterialized and cannot be represented as published release-specific pages. Do not add dummy versioned indexes, silently redirect Genesis to development, or imply testnet/mainnet documentation is live. Distinct versioned materialization, provenance and route qualification are a separate future documentation gate.

**420AI boundary:** None of the Bundler merge or 420Docs qualification/Pages runs proves 420AI split-settlement integration, real manager/escrow/funding-adapter behavior, canonical payout finality, or deployment authorization. Track 420AI contract/provider qualification and any testnet settlement closeout under its own evidence SHA and documents; do not mark a 420AI settlement milestone complete on the strength of these docs runs.

## Post-merge GEN-11.20 acceptance matrix

| Gate | Required evidence | Current disposition |
| --- | --- | --- |
| A — final exact-head CI | Integrated, Docs, Solidity, Wallet Web/Extension/Mobile and applicable Genesis checks on one final release candidate SHA | **PARTIAL:** core and docs/Pages pass on recorded merge/later SHAs; dedicated Solidity/Wallet/Genesis checks not established on `e88cf66` or this documentation commit. |
| A2 — documentation publication | Build, artifact smoke, upload, Pages deployment and live critical-route smoke | **PASS for flat compatibility at `15806c50` and `e88cf66`**, using the linked Pages runs; version-qualified trees remain unmaterialized. |
| B — independent operators | Two separately controlled live Bundlers with distinct persistence/submitter identities; chain/EntryPoint and canonical receipt agreement | **OPEN:** no independent live two-operator acceptance evidence. |
| C — fallback / ambiguous send | Real pre-send fallback, timeout-after-accept quarantine and canonical reconciliation without blind retry | **OPEN for live endpoint/client exercises.** |
| D — Wallet surfaces | Live web/CORS, extension, mobile and native/API end-to-end acceptance | **OPEN:** shared opt-in transport exists; default session UI still uses direct EntryPoint. |
| E — adversarial/recovery | Wrong-chain/EntryPoint, stale-head and hostile response/peer input, overload, reorg and restart-with-pending-intent field evidence | **OPEN for live fault-matrix/recovery evidence.** |
| F — FIFO/economics | Full-snapshot FIFO, tie-break, replacement position and absence of paid/preferred lanes under deployed settings | **PARTIAL:** local source/tests exist; deployed-setting acceptance open. |
| G — main reconciliation | Record actual merge and qualify the result | **MERGE COMPLETE:** PR #341 merged at `a57cfb45`; core Integrated Qualification passed there. New candidate SHAs require their own required checks. |
| H — operational release | Nonsecret operator identities/topology, actual tx and canonical block evidence, incident/reorg observations and explicit signoff | **OPEN:** no production/testnet release authorization inferred from source CI. |

## Fail-closed disposition and remaining work

A timeout, connection failure or malformed acknowledgment after `eth_sendTransaction` is **ambiguous**: retain durable pending intent, suppress automatic resend and reconcile against canonical chain evidence or explicit operator procedure. Only a proven explicit rejection permits fresh revalidation/retry. Mempool acknowledgments, `/status`, audit data, simulations and transaction hashes cannot be treated as inclusion/finality proof.

**GEN-11.20 is not operationally signed off.** Preserve the successful merge and exact-commit CI results without conflating them with independent-operator acceptance, live Wallet availability, version-specific documentation publication or the separate 420AI settlement program. The correction in this file is a new commit and needs applicable exact-head CI before final release qualification is claimed.
