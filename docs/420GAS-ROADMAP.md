# 420Gas / Paymaster implementation roadmap

420Gas is shared account-abstraction infrastructure for bounded native `$420` gas sponsorship. It reuses the canonical Smart Account and `EntryPoint420` stack and never becomes wallet, protocol, governance, oracle, bridge, automation, or consensus authority.

## Delivery rule

Each numbered GAS phase is developed on its own branch and pull request, reconciled with current `main`, fully qualified on the exact final head, and merged before the next phase begins.

## GAS-0 — architecture and trust foundation — COMPLETE

Define sponsorship authority, operation binding, deposit/accounting boundaries, policy narrowing, replay/concurrency rules, failure behavior, cross-service dependencies, and invariants. Preserve the current fail-closed `UnsupportedPaymaster` behavior in `EntryPoint420` while the model is frozen.

## GAS-1 — paymaster interface and payload encoding — COMPLETE

Define the canonical `IPaymaster420` contract interface and strict `paymasterAndData` encoding/versioning. Bind payloads to exact EntryPoint, paymaster, operation, policy, validity window, cost ceiling, and replay identity. Add malformed/unknown-version rejection tests.

## GAS-2 — EntryPoint paymaster validation path — COMPLETE

Extend `EntryPoint420` with a bounded sponsorship-validation path while preserving account validation as an independent authority gate. A paymaster can fund an operation only after normal sender/nonce/account checks and can never make failed account validation succeed.

## GAS-3 — sponsor deposits and reservations — COMPLETE

Add native `$420` sponsor deposits, bounded reservations, withdrawal authority, reservation uniqueness, and accounting invariants. Prevent negative balances, double reservation, unbounded credit, and settlement beyond reserved maximum cost.

## GAS-4 — post-operation settlement — COMPLETE

Implement deterministic settlement/refund semantics for successful and reverted Smart Account execution. Account for legitimate gas without allowing paymaster callbacks or post-op accounting to reenter or mutate unrelated execution authority.

## GAS-5 — sponsorship policy engine — COMPLETE

Implement deterministic on-chain/off-chain-compatible policy commitments for approved accounts/apps/targets/selectors, cost ceilings, validity, budgets, and optional capability/session constraints. Policy can only narrow sponsorship.

## GAS-6 — quote service and Developer Hub API — COMPLETE

Add a replaceable authenticated quote/read service for Wallet, applications, and developers. Quotes are short-lived operation-bound funding offers, not execution authorizations. Integrate scoped service credentials without exposing sponsor/operator secrets.

## GAS-7 — Wallet and Smart Account integration — COMPLETE

Integrate sponsorship discovery, quote review, operation assembly, fallback-to-self-funded flows, and user-facing failure states in Wallet Core. Wallet signing/review/session authority remains unchanged.

## GAS-8 — 420Automation integration — COMPLETE / MERGED

Merged to `main` in PR #291 at merge commit `fa3cdaa19a815c869ec54b85dcb97c348acaf404` after exact-head qualification.

Completed GAS-8 work:
- **GAS-8.1** exact Automation plan binding and sponsorship digest propagation.
- **GAS-8.2** attempt/replay binding; only a `ready` attempt may be sponsored and retries require a fresh attempt-bound quote.
- **GAS-8.3** canonical 420Gas quote adapter with strict chain, EntryPoint, paymaster, Smart Account, policy, cost, validity, attempt and authority checks.
- **GAS-8.4** canonical Automation → 420Gas quote-request builder deriving `authorizationId` from the exact Automation attempt.
- **GAS-8.5** end-to-end sponsorship preparation flow with fail-closed default behavior and explicit self-funded fallback only through existing AUT-5 budget gates.
- **GAS-8.6** adversarial/E2E closeout covering mid-flight plan mutation, ambiguous/retry states, stale retry quote replay, wrong chain/paymaster/policy and authority escalation.

Final qualified GAS-8 head: `cdf4d80769d5ca6ff87dcc3ad4bd08b8d087b1fc`.

Qualification passed:
- 420Automation #156
- 420Docs Qualification #1130
- 420 Integrated Qualification #3329

## GAS-9 — budgets, quotas, abuse resistance — COMPLETE / MERGED

Merged to `main` in PR #293 at merge commit `57103d7f429dda6e3a53588915808a7f92454bc1` after exact-head qualification.

Completed GAS-9 work:
- **GAS-9.1** bounded quota controller with per-operation, per-account, per-policy, spend, operation-count, concurrency and outstanding-authorization limits.
- **GAS-9.2** canonical quote-service quota admission before signing, signer-failure cleanup, and explicit release lifecycle while preserving no-controller compatibility.
- **GAS-9.3** sponsor-wide spend/operation/concurrency budgets plus automatic expiry of abandoned outstanding reservations.
- **GAS-9.4** canonical quote schema `1.2.0` with signed gas limit, max-fee and priority-fee envelope; sponsor-side economic ceilings; synchronized Automation request/return validation; wallet-authority escalation rejection.
- **GAS-9.5** exact reservation-generation handles, stale-release/ABA protection, transactional signer-failure rollback, and re-entrant duplicate/concurrency hardening.
- **GAS-9.6** bounded/pruned fixed-window state, read-only snapshots that do not allocate attacker-controlled keys, current-window state caps, rollover cleanup, and adversarial state-flood closeout tests.

Final qualified GAS-9 head: `c4ac74a41620607fd0b266c5983b485b527d1fdb`.

Qualification passed:
- 420Gas Qualification #36
- 420Automation #173
- 420Docs Qualification #1134
- 420 Integrated Qualification #3380

GAS-9 remains funding-only. Quota, budget, cache and quote state never becomes Smart Account, Wallet, Automation, target-protocol, settlement, or canonical-chain authority. On-chain EntryPoint/paymaster accounting remains authoritative for actual sponsored settlement.

## GAS-10 — observability, readiness, and recovery — COMPLETE / MERGED

Merged to `main` in PR #294 at merge commit `bca09eea0d0f70c2310220b07169da6d8bf9b929` after reconciliation with current `main` and exact-head qualification.

Completed GAS-10 work:
- **GAS-10.1** bounded low-cardinality metrics and redacted, explicitly non-authoritative operational status.
- **GAS-10.2** deterministic sponsor/deposit readiness from observed deposit/reservation inputs with `ready`, `degraded`, and `not-ready` classification.
- **GAS-10.3** bounded settlement journal projection with opaque commitments, replay rejection, discrepancy detection and projection-only summaries.
- **GAS-10.4** bounded recovery/degraded-mode state machine for signer, funding and settlement-observer failures with fail-closed sponsorship guidance.
- **GAS-10.5** stable machine-readable health/readiness projection with deterministic reason precedence and strict redaction.
- **GAS-10.6** adversarial observability/recovery closeout covering telemetry secret injection, funding underflow, settlement replay/retention, recovery churn/history bounds, conflicting degraded signals, public-status redaction and proof that telemetry never becomes accounting or authorization authority.

Final reconciled GAS-10 head: `89f019920761421a68b65b93a70509dc216425ae`.

Qualification passed on the reconciled head:
- 420Gas Qualification #52
- 420Docs Qualification #1173
- 420 Integrated Qualification #3430

GAS-10 remains operational/advisory only. Telemetry, readiness, journal, recovery and status projection state cannot authorize execution or sponsorship and cannot replace canonical on-chain EntryPoint/paymaster accounting or settlement truth.

## GAS-11 — hostile-state/security hardening — NEXT

Cross-layer adversarial hardening of the complete sponsorship stack before public-testnet closeout.

Planned GAS-11 work:
- **GAS-11.1** forged, replayed and cross-domain sponsorship payloads: wrong chain, EntryPoint, paymaster, policy, authorization identity, validity window and sponsorship-digest binding.
- **GAS-11.2** deposit/reservation/settlement hostile-state tests: races, stale reservations, double settlement, cost-bound violations, reentrancy and malicious account/paymaster behavior.
- **GAS-11.3** authority-confusion hardening across policy, capability/session constraints, Wallet, Smart Account and 420Automation; prove sponsorship cannot smuggle or broaden execution authority.
- **GAS-11.4** resource-exhaustion and denial-of-service hardening across quote admission, quotas, metrics, journals, readiness/recovery state and attacker-controlled identifiers.
- **GAS-11.5** secret/credential and service-boundary hardening: signer/operator isolation, malformed API inputs, credential misuse, leakage checks and fail-closed dependency behavior.
- **GAS-11.6** cross-layer adversarial closeout, invariant review, roadmap update, exact-head qualification, reconciliation with current `main`, and merge.

## GAS-12 — public-testnet qualification and launch closeout

Pin exact release/deployment identity; collect live paymaster/deposit/Wallet/Automation evidence; execute failure drills; verify compatibility with `EntryPoint420`, Wallet, 420RPC, Registry and Automation; retain a machine-readable `go`/`no-go` report. Synthetic CI evidence validates closeout logic only and cannot authorize public-testnet launch.

## Authority rule

420Gas may decide whether an exact otherwise-authorized UserOperation is eligible for bounded gas sponsorship and may settle that sponsorship through the canonical EntryPoint path. It never determines user intent, wallet ownership, Smart Account permissions, target-protocol authorization, Automation eligibility, canonical chain state/finality, Oracle truth, bridge settlement, governance authority, or arbitrary spending authority.
