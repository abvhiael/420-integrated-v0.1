# 420 Bundler Network — GEN-11 Roadmap

The 420 Bundler Network (`420/service/bundler/v1`) is a non-custodial, provider-neutral UserOperation validation, relay and operational tracking layer for 420 Integrated. EntryPoint and smart-account validation, not the Bundler, authorize an operation. Canonical chain evidence, not local Bundler state, determines inclusion and finality. A wallet remains free to choose another compatible operator.

**Scope of this document:** The status summary distinguishes committed and CI-qualified code from operator deployment, live multi-operator acceptance, and final Genesis release. The detailed historical GEN-11.0–11.14 implementation notes remain permanently available in [the pre-reconciliation roadmap at `ad169da2`](https://github.com/abvhiael/420-integrated-v0.1/blob/ad169da228d94da6b873628314bdd7223e3035af/docs/420BUNDLER-ROADMAP.md). That historical revision is an implementation record, **not** the current status source.

## GEN-11 status — reconciled 2026-09-19

| Phase | Verified status | Qualification / remaining scope |
| --- | --- | --- |
| GEN-11.0 — architecture + executable invariant baseline | COMPLETE | Service identity and BUNDLER-INV-001–016 contract committed. |
| GEN-11.1 — core runtime/service scaffold | COMPLETE | Explicit chain/EntryPoint qualification and noncanonical health/readiness. |
| GEN-11.2 — canonical UserOperation model + hashing | COMPLETE | Packed operation encoding and chain/EntryPoint-bound hash tests. |
| GEN-11.3 — public Bundler RPC | COMPLETE | Bounded JSON-RPC admission, estimation, receipt and EntryPoint methods. |
| GEN-11.4 — deterministic validation + simulation | COMPLETE | Canonical hash and execution-state simulation evidence. |
| GEN-11.5 — bounded mempool | COMPLETE | Capacity, sender bounds, TTL, deterministic selection. |
| GEN-11.6 — bundle selection + EntryPoint submission | COMPLETE | Current EntryPoint handles one operation per transaction; the Bundler does not invent atomic `handleOps`. |
| GEN-11.7 — gas + fee estimation | COMPLETE | Execution-backed estimate without fabricated sub-phase measurement. |
| GEN-11.8 — Paymaster integration boundary | COMPLETE | Sponsorship envelope validation without granting sponsorship authority. |
| GEN-11.9 — receipts + lifecycle | COMPLETE | Operational transaction mapping and event checks; chain evidence is authoritative. |
| GEN-11.10 — multi-bundler propagation | COMPLETE | Peer input is locally validated; one peer is never canonical authority. |
| GEN-11.11 — reputation + anti-abuse | COMPLETE | Bounded local source/sender controls. |
| GEN-11.12 — replacement + nonce hardening | COMPLETE | Full nonce identity, fee-bump replacement, original queue position and TTL preserved. |
| GEN-11.13 — failure isolation + reorg/restart recovery | COMPLETE | Durable-intent model and canonical-block receipt reconciliation primitives. |
| GEN-11.14 — persistence + audit trail | **CODE QUALIFIED** | Exact head `69be559d22ced81072208fba099f9eaa874a3557`: Integrated #4560, Docs #2186 and Solidity #2765 passed. Persistence/restart and audit code is committed; production crash/recovery drill remains a separate GEN-11.20 release check. |
| GEN-11.15 — 420Wallet integration + provider fallback | **TRANSPORT QUALIFIED; UI/OPERATOR FOLLOW-UP OPEN** | Exact head `f174080b8555791fc8a17cb677c4ef2c9532f831`: six workflows passed. Opt-in wallet relay transport and pre-send provider fallback are committed; the existing session UI still defaults to direct EntryPoint submission. Live endpoint, browser CORS and surface-specific rollout must not be inferred from green CI. |
| GEN-11.16 — 420Status + observability | **CODE QUALIFIED** | Exact head `e1c17952a56c0d219aeda973c84ee83cd8e42ffe`: Integrated #4629, Docs #2241, Wallet Web #736, Extension #277, Mobile #901 and Solidity #2786 passed. Read-only `/status` is observational, not authorization or finality authority. |
| GEN-11.17 — security hardening + hostile dependency isolation | **IMPLEMENTED; CI-QUALIFIED ON RECONCILED HEAD** | Ambiguous execution-RPC send retains durable intent and suppresses blind resend; malformed send acknowledgments, request limits and overload paths have regression coverage. Qualified together with GEN-11.18 on `ad169da228d94da6b873628314bdd7223e3035af` (six successful workflows; see evidence below). This is not a claim of an independent external security audit. |
| GEN-11.18 — Genesis ordering/economic policy | **IMPLEMENTED; CI-QUALIFIED ON RECONCILED HEAD** | `bundler/ordering/policy.go` and builder wiring enforce `fifo-v1`: admission time, then canonical hash; sorting occurs before truncation. Fee, sponsorship, sender and operator identity do not buy priority. Policy and economic-neutrality tests are committed and qualified on `ad169da228d94da6b873628314bdd7223e3035af`. |
| GEN-11.19 — cross-client/operator compatibility | **IN PROGRESS** | Interoperability probe and tests exist in the branch; a local probe is not evidence of independent third-party operator acceptance, live endpoint interoperability, or complete wallet UI rollout. |
| GEN-11.20 — adversarial qualification, reconciliation + closeout | **PENDING** | Complete outstanding live/operator and failure-injection checks, reconcile with latest `main`, qualify the exact final merge head, and only then close PR #341. |

### Latest shared branch qualification evidence

On exact PR #341 head [`ad169da228d94da6b873628314bdd7223e3035af`](https://github.com/abvhiael/420-integrated-v0.1/commit/ad169da228d94da6b873628314bdd7223e3035af), all six pull-request workflow runs completed with `success`:

- [420 Integrated Qualification #4920](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35485449080)
- [420Docs Qualification #2474](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35485449148)
- [Solidity Contracts #2920](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35485449162)
- [420 Wallet Web Verification #877](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35485449088)
- [420 Wallet Extension Verification #418](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35485449221)
- [420 Wallet Mobile Verification #1042](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35485449369)

**Evidence scope:** These are results for the exact pre-documentation head above, not an assertion that subsequent commits automatically inherit green status. Green CI qualifies the committed code covered by those workflows, not real production deployment, independent security certification, live third-party interoperability or GEN-11.20 closeout. This documentation edit itself requires a new exact-head qualification.

## Architecture and invariant baseline

The following Genesis invariants remain binding across phases:

- **BUNDLER-INV-001:** Bundler stores no wallet private key, recovery secret or wallet signing authority; it is non-custodial.
- **BUNDLER-INV-002:** Smart-account and EntryPoint validation authorize UserOperations; a relay cannot override this.
- **BUNDLER-INV-003:** The canonical chain alone determines execution, settlement and finality.
- **BUNDLER-INV-004:** Every operation is bound to a chain identity and configured EntryPoint.
- **BUNDLER-INV-005:** Peer input never bypasses local validation/simulation on sufficiently recent state.
- **BUNDLER-INV-006:** Stale or invalid simulation evidence cannot remain silently eligible for a bundle.
- **BUNDLER-INV-007:** Exact sender/full-nonce conflicts and qualified replacements remain unambiguous.
- **BUNDLER-INV-008:** Failure in validation, simulation or submission cannot justify fabricated canonical account state or blind resend.
- **BUNDLER-INV-009:** Paymaster/account validation, not the relay, grants sponsorship.
- **BUNDLER-INV-010:** An operator failure cannot prohibit direct protocol use or a choice of other operators.
- **BUNDLER-INV-011:** Wallets are not tied to a monopoly bundler client.
- **BUNDLER-INV-012:** Local lifecycle state alone cannot claim inclusion or finality.
- **BUNDLER-INV-013:** Restart recovery validates persisted state and cannot invent canonical evidence.
- **BUNDLER-INV-014:** 420Status health and metrics are explicitly noncanonical.
- **BUNDLER-INV-015:** Peer/operator input, RPC responses and error payloads are untrusted and bounded.
- **BUNDLER-INV-016:** Genesis selection and prioritization are documented, deterministic and auditable.

## GEN-11.14 — durable operational state

`bundler/persistence` opens `BUNDLER_DATA_DIR` (default `./data/bundler`) and stores versioned `state.json` plus append-only `audit.jsonl`. The persistent model covers active mempool entries, signed operation and simulation evidence, original admission/expiry timestamps, pending submission intents, and submitted operation-to-transaction bindings. State replacement uses a same-directory temporary file, file sync and atomic rename; startup rejects corrupt/incompatible state. `mempool.Pool.Restore` rebuilds hash and full sender+nonce indices under configured capacity/TTL bounds. Public and peer admission, candidate snapshots, removals and submission recording use the durable store. Local audit/receipt evidence does not assert canonical inclusion. Consult the [detailed original GEN-11.14 notes](https://github.com/abvhiael/420-integrated-v0.1/blob/ad169da228d94da6b873628314bdd7223e3035af/docs/420BUNDLER-ROADMAP.md#gen-1114--persistence--audit-trail) for the state transition contract and rollback rationale.

## GEN-11.15 — wallet relay and fallback

The wallet now has an opt-in Bundler JSON-RPC transport and a session adapter. Endpoint qualification may try another configured operator **before** a send; after an ambiguous send result, the same signed operation must not be automatically retransmitted to an alternative endpoint. The returned UserOperation hash is checked against the canonical local hash, with receipt reconciliation against chain evidence. The currently deployed/available Wallet session UI retains the direct EntryPoint submission path. Enabling the relay in user-facing flows, qualifying live endpoints and browser CORS, and validating web/extension/mobile acceptance are explicitly unfinished rollout work; a qualified transport library is not a deployed end-to-end route.

## GEN-11.16 — noncanonical observability

The Bundler exposes `/healthz`, `/readyz` and read-only `/status`. The status snapshot includes configured chain/EntryPoint, readiness, active mempool size and aggregate admission/submission counters. It is 420Status-compatible operational telemetry; no signatures or individual operation bodies should be published. Observability must neither grant authorization nor change admission, ordering or canonical lifecycle. Status operator configuration and end-to-end probe deployment remain part of final release qualification.

## GEN-11.17 — hostile dependency and ingress hardening

`bundler/bundle` differentiates an explicit execution-RPC rejection from an **ambiguous** transport failure or malformed acknowledgment. On an ambiguous outcome, a transaction may have been accepted even if the response was lost: retain the durable pending intent, remove the candidate from automatic active resend, and require reconciliation before retry. Explicit reject-before-accept remains a separate later-revalidation case. The execution submitter checks response identity and transaction-hash shape and treats malformed or untrusted acknowledgments as ambiguous. The runtime HTTP boundary adds resource and concurrency limits with hostile-client/overload tests. These controls do not replace deployment-level authentication, network/firewall policy, TLS configuration or independent penetration testing.

## GEN-11.18 — Genesis ordering and economic-policy boundary

`bundler/ordering` defines the sole Genesis ordering policy, `fifo-v1`. It copies and sorts the **entire** candidate snapshot by original `AdmittedAt`, then lowercase canonical UserOperation hash as exact-time tie-breaker, and only then applies the configured candidate limit. The builder explicitly calls this selector rather than trusting an alternate pool's presentation order. The policy rejects unqualified overrides and does not use fee bids, sender identity, Paymaster sponsorship or operator affiliation as a prioritization lane. A higher fee may qualify a deterministic same-sender/full-nonce replacement under GEN-11.12; it does **not** purchase earlier queue position or renew the original admission/expiry timestamps. This is local operational selection, not a promise of chain inclusion or consensus priority. Evidence: [`policy.go`](https://github.com/abvhiael/420-integrated-v0.1/blob/ad169da228d94da6b873628314bdd7223e3035af/bundler/ordering/policy.go), [`genesis_policy_contract_test.go`](https://github.com/abvhiael/420-integrated-v0.1/blob/ad169da228d94da6b873628314bdd7223e3035af/bundler/ordering/genesis_policy_contract_test.go), and [`bundle/builder.go`](https://github.com/abvhiael/420-integrated-v0.1/blob/ad169da228d94da6b873628314bdd7223e3035af/bundler/bundle/builder.go).

## GEN-11.19 — cross-client/operator compatibility

Validate independent clients and operators against the published canonical operation hash, EntryPoint identity, RPC envelopes, admission/replacement semantics, qualified gas estimates, receipt evidence, and fallback behavior. Existing `bundler/interoperability` probes and tests form an initial local test surface; complete qualification requires actual independent endpoint/client evidence and does not follow solely from generic repository CI. Verify wrong-chain/EntryPoint refusal, divergent provider receipt results, operator outages, CORS/browser behavior and wallet surface-specific routes.

## GEN-11.20 — adversarial qualification, reconciliation and closeout

Run a documented adversarial matrix covering hostile peer/RPC response payloads, timeout-after-accept and restart reconciliation, crash-safe persistence, corrupt recovery state, reorg/orphan receipts, overload, nonce-lane conflicts, replacement and FIFO neutrality under capacity, and multi-operator failure/fallback. Resolve or explicitly gate outstanding Wallet UI/deployment acceptance. Reconcile the long-lived feature branch against latest `main`, re-run all required workflows on **the exact reconciled head**, and merge PR #341 only after the final evidence and release blockers are closed. No prior per-phase green CI result substitutes for this closeout.
