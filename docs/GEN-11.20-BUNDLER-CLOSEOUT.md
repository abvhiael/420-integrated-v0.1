# GEN-11.20 — Bundler adversarial qualification, reconciliation and closeout

**Status: PR #341 MERGED; REPOSITORY CORE CI QUALIFIED ON RECORDED MAIN SHA; GENESIS OPERATOR RELEASE NOT SIGNED OFF.** A green repository workflow is not a substitute for separately scoped contract/application checks or live multi-operator acceptance.

## Exact-main qualification ledger — reviewed 2026-09-20

**Evidence SHA (qualified source tree):** [`e88cf66fdac0581ff69ac7d3f83ff17ea296c684`](https://github.com/abvhiael/420-integrated-v0.1/commit/e88cf66fdac0581ff69ac7d3f83ff17ea296c684) on `main`. This is the **pre-evidence-documentation commit**. The commit introducing this ledger is different and must receive its own applicable exact-head CI; this record does not silently transfer the green result to its own commit or any later release SHA.

| Gate / run | Result at `e88cf66` | Evidence scope |
| --- | --- | --- |
| [420 Integrated Qualification #5060](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35493251055) | **PASS** | Four successful jobs: `offline-core` (`go test ./...`, consensus/execution Go builds), `production-dependencies`, `geth-engine` (pinned Geth build and live-engine smoke), and `fault-matrix` (fault matrix and 120-slot soak). This workflow does **not** execute every separate application or Solidity verification workflow. |
| [420Docs Qualification #2553](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35493251082) | **PASS** | Documentation qualification on the evidence SHA. |
| [420Docs Pages #142](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35493251076) | **PASS** | Both Pages build and deployment jobs completed successfully on the evidence SHA. Artifact/build success and deployment success are distinct; neither alone proves that unmaterialized version-specific routes are published. |
| Solidity Contracts | **NO RUN ON THIS SHA FOUND** | The three GitHub Actions workflow runs associated with `e88cf66` are Integrated, Docs Qualification and Docs Pages. Earlier Solidity success is historical and does not establish an exact-`e88cf66` contract check. Run the dedicated Solidity workflow on the final candidate SHA and capture its run ID/result. |
| 420 Wallet Web / Extension / Mobile Verification | **NO RUN ON THIS SHA FOUND** | The separate Wallet workflows were not among the three GitHub Actions runs for `e88cf66`. Run each required surface check on the final candidate SHA, preserve individual run IDs and verify actual endpoint/UI acceptance separately. |
| Applicable Genesis contract/application checks | **NOT ESTABLISHED ON THIS SHA** | Identify required dedicated Genesis checks from the release matrix, execute them at the final candidate SHA, and log results individually. Core `go test ./...` is not a proxy for Solidity, frontend, device, external-chain or deployed-operator acceptance. |

**Historical, nontransferable pre-merge evidence:** At feature head [`ad169da228d94da6b873628314bdd7223e3035af`](https://github.com/abvhiael/420-integrated-v0.1/commit/ad169da228d94da6b873628314bdd7223e3035af), [Integrated #4920](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35485449080), [Docs #2474](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35485449148), [Solidity #2920](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35485449162), [Wallet Web #877](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35485449088), [Wallet Extension #418](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35485449221), and [Wallet Mobile #1042](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35485449369) were recorded as successful in the GEN-11 roadmap. They qualify that **earlier branch SHA only**, not `e88cf66` or the documentation commit here.

**Disposition:** Repository core and documentation/Pages CI are green at the recorded main SHA. Exact-final-head Solidity, Wallet surfaces and applicable Genesis checks remain unproven; do **not** mark gate A fully passed or GEN-11.20 operator release complete. Updating this record creates a new SHA and requires further exact-head qualification before its state can be used as final release evidence.

## Merge provenance and publication repair

PR [#341](https://github.com/abvhiael/420-integrated-v0.1/pull/341) merged into `main` at [`a57cfb45b73548bc94317528d13b17f6a11ef194`](https://github.com/abvhiael/420-integrated-v0.1/commit/a57cfb45b73548bc94317528d13b17f6a11ef194). The previous open-PR and branch-reconciliation instructions are historical; do not request another merge of #341.

The merge-head [420Docs Pages #138](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35492419017) failed at publication artifact smoke because the flat MkDocs build did not materialize `versions/development/current/index.html` or `versions/genesis/current/index.html`. This was an artifact/route-contract mismatch, not a Bundler source compilation failure. Follow-up [`15806c50c48617a41b344815812ba9599c1463c2`](https://github.com/abvhiael/420-integrated-v0.1/commit/15806c50c48617a41b344815812ba9599c1463c2) aligned [`docs/publication/publication-health.json`](publication/publication-health.json) with the real artifact: root and existing flat routes are required, while `versions/*` trees are **not materialized or claimed published**. Do not add dummy versioned pages to silence publication smoke tests.

The former closeout review recorded Pages #141's build as successful but its deployment as queued. That observation is superseded for the newer `e88cf66` evidence SHA by the completed successful Pages #142 build and deploy jobs above. Live version-qualified release routes still require actual distinct materialization and deployed-route qualification.

## Post-merge acceptance matrix

| Gate | Required evidence | Current disposition |
| --- | --- | --- |
| A — exact-final-head repository CI | Integrated, Docs, Solidity, Wallet Web/Extension/Mobile and applicable Genesis checks on the **same final candidate SHA** | **PARTIAL:** Integrated #5060 and Docs #2553 pass on `e88cf66`; separate Solidity/Wallet/Genesis checks are not established on that SHA. This documentation change needs its own checks. |
| A2 — documentation publication | Build, artifact smoke, upload, Pages deployment, and relevant live critical-route smoke | **BUILD/DEPLOY PASS on `e88cf66`:** Pages #142. Distinct version-qualified development/Genesis routes remain unmaterialized; do not claim them published. |
| B — independent operators | Two separately controlled Bundlers, persistence and submitter identities; matching chain/EntryPoint and admission/receipt evidence | **OPEN:** no independently verified live two-operator acceptance. |
| C — fallback and ambiguous sends | Live pre-send fallback, timeout-after-accept quarantine and canonical reconciliation without blind retry | **OPEN for live exercises:** regression tests alone are not operator acceptance. |
| D — Wallet surfaces | Real endpoint acceptance from web/CORS, extension, mobile and native/API clients | **OPEN:** opt-in shared transport exists; session UI still defaults to direct EntryPoint submission. |
| E — hostile dependencies | Wrong-chain/EntryPoint, stale head, malformed/oversized RPC, peer flood, reorg, restart and pending-intent drills with recorded live evidence | **OPEN for live fault-matrix and recovery artifacts.** |
| F — ordering/economics | Full-snapshot FIFO, deterministic tie-break and no fee/Paymaster/operator preference under deployed settings | **PARTIAL:** source/local tests exist; deployed-setting evidence remains open. |
| G — branch reconciliation | Feature changes merged and the actual post-merge main SHA recorded and qualified | **MERGE COMPLETE; core/docs/Pages qualified at `e88cf66`; remaining exact-final-head checks in A remain open.** |
| H — operational signoff | Nonsecret operator/deployment identities, real transaction/canonical-block evidence, recovery/reorg observations, incident records and explicit signoff | **OPEN.** Repository CI does not imply operational release. |

## Fail-closed dispositions

A timeout, connection failure or malformed acknowledgment after `eth_sendTransaction` is **ambiguous**. Retain the pending intent, prevent automatic resend, and reconcile against canonical chain evidence or an explicit operator procedure. Only a proven explicit rejection permits fresh revalidation and retry. A mempool acknowledgment, local `/status`, persisted audit record, simulation or transaction hash is not canonical inclusion or finality.

**Release gate:** PR #341 is merged; the recorded main SHA passes the integrated, documentation and Pages workflows, but GEN-11.20 remains **NOT SIGNED OFF** until the separately required exact-final-head checks and live/operator gates A–H have the required evidence. Do not imply that versioned URLs exist until release-specific content is rendered and qualified.
