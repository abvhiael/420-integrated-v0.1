# 420 Bundler Network — GEN-11 Roadmap

The 420 Bundler Network (`420/service/bundler/v1`) is a non-custodial, provider-neutral UserOperation validation, relay and operational tracking layer for 420 Integrated. EntryPoint and smart-account validation, not the Bundler, authorize an operation. Canonical chain evidence, not local Bundler state, determines inclusion and finality. A wallet remains free to choose another compatible operator.

**Status reconciled 2026-09-20:** [PR #341](https://github.com/abvhiael/420-integrated-v0.1/pull/341) **MERGED into `main`** on 2026-09-20 at exact merge commit [`a57cfb45b73548bc94317528d13b17f6a11ef194`](https://github.com/abvhiael/420-integrated-v0.1/commit/a57cfb45b73548bc94317528d13b17f6a11ef194). Repository merge and CI qualification are complete at their recorded SHAs; **GEN-11.20 live-operator and release signoff remain OPEN**. Do not treat source merge, CI, or a documentation deployment as evidence of a live Bundler network. Historical GEN-11.0–11.14 implementation detail remains available at [the pre-reconciliation roadmap `ad169da2`](https://github.com/abvhiael/420-integrated-v0.1/blob/ad169da228d94da6b873628314bdd7223e3035af/docs/420BUNDLER-ROADMAP.md); it is not the current release-status record. See [GEN-11.20 closeout](GEN-11.20-BUNDLER-CLOSEOUT.md) for the gate-by-gate disposition.

## Phase status

| Phase | Verified status | Qualification / remaining scope |
| --- | --- | --- |
| GEN-11.0 — architecture and invariant baseline | CODE MERGED | Service identity and BUNDLER-INV-001–016 committed. |
| GEN-11.1 — runtime/service scaffold | CODE MERGED | Explicit chain/EntryPoint qualification and noncanonical health/readiness. |
| GEN-11.2 — UserOperation model and hashing | CODE MERGED | Chain/EntryPoint-bound canonical hash tests. |
| GEN-11.3 — public Bundler RPC | CODE MERGED | Bounded admission, estimation, receipt, EntryPoint methods. |
| GEN-11.4 — deterministic validation and simulation | CODE MERGED | Execution-state simulation evidence. |
| GEN-11.5 — bounded mempool | CODE MERGED | Capacity, sender bounds, TTL, deterministic selection. |
| GEN-11.6 — bundle selection and submission | CODE MERGED | Existing EntryPoint supports one operation per transaction; do not imply atomic `handleOps`. |
| GEN-11.7 — gas and fee estimation | CODE MERGED | Execution-backed estimation, no fabricated sub-phase metrics. |
| GEN-11.8 — Paymaster boundary | CODE MERGED | Paymaster/account validation grants sponsorship, not Bundler. |
| GEN-11.9 — receipts and lifecycle | CODE MERGED | Canonical chain evidence alone determines inclusion/finality. |
| GEN-11.10 — multi-bundler propagation | CODE MERGED | Peer input still requires local validation; independent live acceptance OPEN. |
| GEN-11.11 — reputation and anti-abuse | CODE MERGED | Bounded local source/sender controls. |
| GEN-11.12 — replacement and nonce hardening | CODE MERGED | Full-nonce identity and replacement queue/TTL preservation. |
| GEN-11.13 — failure and reorg/restart recovery | CODE MERGED | Durable intent and canonical receipt reconciliation; live recovery drill OPEN. |
| GEN-11.14 — persistence and audit | CODE MERGED / CI QUALIFIED | State/audit persistence implemented; production crash/recovery proof OPEN. |
| GEN-11.15 — Wallet relay and fallback | TRANSPORT MERGED / CI QUALIFIED; LIVE UI OPEN | Opt-in relay and pre-send fallback implemented; default session UI remains direct EntryPoint; web/CORS, extension and mobile live acceptance OPEN. |
| GEN-11.16 — observability | CODE MERGED / CI QUALIFIED | Read-only `/status` is noncanonical; deployed probe and operator checks OPEN. |
| GEN-11.17 — hostile dependency hardening | CODE MERGED / CI QUALIFIED | Ambiguous execution sends retain intent and suppress blind retries; independent audit and live hostile-dependency evidence OPEN. |
| GEN-11.18 — FIFO ordering/economics | CODE MERGED / CI QUALIFIED | Full-snapshot `fifo-v1` sorting before truncation; deployed-setting acceptance OPEN. |
| GEN-11.19 — cross-client/operator compatibility | LOCAL PROBES MERGED; LIVE ACCEPTANCE OPEN | Independent operator/client, endpoint, wrong-chain, CORS and wallet-surface acceptance not established by local tests. |
| GEN-11.20 — reconciliation and closeout | PR MERGED / REPOSITORY QUALIFIED; RELEASE SIGNOFF OPEN | `main` integration and post-merge Integrated Qualification passed; independent operators, live-wallet routes, field fault/recovery matrix and deployment authorization still require evidence. |

## Exact-commit qualification and the separate 420Docs repair

- **Bundler merge:** [PR #341](https://github.com/abvhiael/420-integrated-v0.1/pull/341) merged at [`a57cfb45`](https://github.com/abvhiael/420-integrated-v0.1/commit/a57cfb45b73548bc94317528d13b17f6a11ef194). Its [420 Integrated Qualification run](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35492418997) completed successfully: offline-core Go tests and both builds, fault-matrix and 120-slot soak, pinned-Geth/live-engine smoke, and production dependencies all passed. This certifies that workflow at that exact commit; it does not independently verify deployed Bundlers or all other release gates.
- **Documentation publication is a separate track:** The merge-head [420Docs Pages run](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35492419017) failed its artifact smoke because it expected `versions/development/current/index.html` and `versions/genesis/current/index.html` in a flat MkDocs compatibility build. The follow-up [publication-health fix `9930d759`](https://github.com/abvhiael/420-integrated-v0.1/commit/9930d75981312ab2a84888cb47cc684c9d8dd00e) and [documentation clarification `15806c50`](https://github.com/abvhiael/420-integrated-v0.1/commit/15806c50c48617a41b344815812ba9599c1463c2) aligned the current health check with actually rendered flat routes. On `15806c50`, [420Docs Qualification](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35493065421) **passed** and [420Docs Pages](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35493065432) **passed both build and deploy jobs**, including deployed-site smoke. The [420 Integrated Qualification rerun](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35493065425) likewise completed successfully on that exact documentation-repair commit, with four successful jobs. These checks must not be represented as 420AI settlement qualification.
- **Versioning caveat:** Flat compatibility pages are not materialized version-qualified Genesis/development release trees. Publishing those trees requires real release-specific provenance, materialization, independent qualification and live-route checks. Do not manufacture placeholder versioned pages or imply testnet/mainnet documentation is published.
- **Commit scope:** Subsequent commits, including this closeout-record correction, require their own applicable exact-head CI evidence; green historical runs are not inherited automatically.

## Architecture and binding invariants

BUNDLER-INV-001–016 remain binding: non-custodial relay; EntryPoint/smart-account authorization; canonical-chain finality; chain/EntryPoint-bound identities; independent local validation of peer input; refusal of stale simulations; deterministic full-nonce replacement; fail-closed submission and restart reconciliation; Paymaster neutrality; operator and client choice; noncanonical `/status`; hostile-input bounds; and deterministic/auditable Genesis ordering. See the pre-reconciliation implementation record linked above for the complete numbered text and test references.

The durable `bundler/persistence` store uses versioned state and append-only audit data for mempool, simulation, submission intents and transaction mappings. A timeout or malformed acknowledgment after a send is **ambiguous**: retain pending intent, suppress automatic resend and reconcile against canonical evidence. Local receipts, status, mempool acknowledgments and persisted audit data never assert chain finality.

`bundler/ordering` enforces `fifo-v1`: sort the complete candidate snapshot by original admission time and canonical operation hash as tie-breaker **before** truncation. A qualified replacement neither buys priority nor renews original admission/expiry. Fees, Paymaster sponsorship, sender and operator identity do not establish a special priority lane. This is a local selection policy, not a promise of inclusion.

## Remaining GEN-11.20 release gates

**Independent operators:** exercise two separately controlled live Bundlers with distinct persistence/submitter identities; capture chain ID, EntryPoint, submission and canonical receipt agreement. **Wallet:** verify opt-in routes, pre-send fallback, ambiguous-send quarantine, browser/CORS, extension, mobile and native/API clients with real endpoints. **Adversarial/recovery:** record wrong-chain and EntryPoint refusal, malformed/oversized payloads, overload, timeout-after-accept, restart with unresolved intent, reorg/orphan handling and FIFO policy under deployed settings. **Operations:** collect nonsecret topology, transaction/block evidence, incident records and explicit security/deployment signoff. Keep GEN-11.20 release status **OPEN** until these gates pass; PR #341 must not be described as unmerged or awaiting another merge.
