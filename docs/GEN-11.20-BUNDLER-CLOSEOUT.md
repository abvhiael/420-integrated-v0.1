# GEN-11.20 — Bundler adversarial qualification, reconciliation and closeout

**Status: in qualification; not signed off and not merged.** This record distinguishes repository CI from live integration evidence. It must not be interpreted as an assertion that a production Bundler has been independently deployed or has executed a real UserOperation.

## Repository evidence and implementation inventory

Candidate pre-closeout head `40f844ea75e003120bce8bccd57c8491459e9332` passed all six associated GitHub Actions workflows: 420 Integrated Qualification #4807, 420Docs Qualification #2393, Solidity Contracts #2868, Wallet Web Verification #818, Wallet Extension Verification #359 and Wallet Mobile Verification #983. Those results apply **only** to that exact commit; changes made for this closeout require a new complete CI run on the new exact head. The Go tests exercised by Integrated Qualification are mock-backed; a green workflow cannot prove live network interoperability, deployed infrastructure, or finality.

Repository implementation includes `bundler/userop`, `simulation`, `mempool`, `bundle`, `gasestimation`, `paymaster`, `lifecycle`, `peer`, `reputation`, `persistence`, `rpcapi`, `runtime`, `observability`, and the `ordering/fifo-v1` policy, plus an opt-in Wallet Bundler transport. Adversarial coverage includes malformed public RPC envelopes and oversized requests (`bundler/rpcapi/adversarial_closeout_test.go`), ambiguous transaction-submission acknowledgments and cancellation (`bundler/bundle/*closeout_test.go`, `hostile_submitter_test.go`), canonical receipt/reorg handling (`bundler/lifecycle`), restart reconstruction and corrupt durable state (`bundler/persistence`), fee-replacement and nonce conflicts (`bundler/mempool`), untrusted peer ingress (`bundler/peer`, `reputation`), cross-client wire compatibility and browser CORS (`bundler/rpcapi`). See `docs/GEN-11.18-GENESIS-ORDERING.md` and `docs/420BUNDLER-GEN11-19-INTEROPERABILITY.md` for precise contracts and caveats.

## Closeout acceptance matrix

| Gate | Verification required | Current evidence / disposition |
| --- | --- | --- |
| A — exact-head repository tests | Complete the Integrated, Docs, Solidity, Wallet Web, Extension and Mobile workflows with no failures or skipped required checks on the **final** commit | Previously green on `40f844ea`; requalification required after GEN-11.20 changes. |
| B — independent operators | Deploy two genuinely independent Bundler processes with separate persistence and submitter identities against the same explicitly verified chain ID and EntryPoint; submit the same signed operation and compare admission and receipts | **Open**. Local fake backends do not satisfy this gate. |
| C — fallback and ambiguous sends | With a primary operator unavailable *before* sending, verify Wallet selects a qualified alternate; after ambiguous send, confirm no automatic cross-operator rebroadcast and reconcile chain evidence before operator intervention | **Open** for live clients/operators. Mock-backed unit tests are present. |
| D — actual Wallet surfaces | Exercise deployed web origin/CORS, extension, mobile and native API with real operator endpoints, checking hash equality, nonce, returned receipts and false-finality prevention | **Open**. Opt-in shared transport does not establish completed live surface wiring. |
| E — hostile dependencies | Test wrong chain/EntryPoint, stale head, unexpected/malformed RPC responses, response-body limits, duplicate/fee-replacement floods, peer refusal, reorged receipt and restart with pending submission intent | Unit-test coverage exists in relevant packages; live deployment fault matrix and logs remain **open**. |
| F — ordering/economics | Verify FIFO ordering across a complete mempool snapshot before truncation, stable tie-break, unchanged queue position after qualified replacement, no fee/sponsor/operator priority lane | Documented `fifo-v1` implementation and Go unit tests exist; capture exact-head results and inspect production settings. |
| G — reconcile `main` | Resolve the divergent main/feature history, check overlapping changes, rerun every required workflow against the resulting exact SHA, review the final diff and GitHub mergeability | **Open**. At the start of this closeout PR #341 was 471 commits behind `main` and GitHub reported `mergeable: false`. |
| H — operational acceptance | Record deployment URLs (redact secrets), operator IDs, chain ID, EntryPoint, actual transaction hashes, canonical block hashes, observed reorg/failure behavior, relevant logs, and signoff | **Open** until live evidence exists. |

## Fail-closed dispositions

A timeout or malformed acknowledgment after `eth_sendTransaction` is an *ambiguous* outcome, never evidence that nothing was sent. The Bundler must retain unresolved intent and prohibit automatic resend until verified reconciliation. `/status`, mempool admission and a submitted transaction hash are operational observations, not chain finality. No mock receipt, audit entry, or GitHub check may be used as a substitute for canonical on-chain evidence. A green final commit is necessary but not sufficient for live release.

**Merge gate:** Do not mark GEN-11.20 COMPLETE, merge PR #341 into `main`, or claim Genesis deployment readiness until gates A–H are evidenced. If a live environment is unavailable, preserve this explicit pending state instead of fabricating deployment/independent-operator results.
