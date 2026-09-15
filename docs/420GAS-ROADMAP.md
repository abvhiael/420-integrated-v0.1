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

## GAS-9 — budgets, quotas, abuse resistance — ACTIVE / NEXT

Add per-operation, per-account, per-policy, and time-window quotas; gas/fee ceilings; concurrency controls; denial-of-service limits; sponsor-drain resistance; and bounded caches/state.

## GAS-10 — observability, readiness, and recovery

Add low-cardinality metrics, redacted operational status, sponsor/deposit readiness, settlement journals, and recovery procedures. Telemetry never becomes settlement or authorization evidence.

## GAS-11 — hostile-state/security hardening

Cross-layer adversarial testing for sponsorship replay, forged payloads, policy confusion, deposit races, settlement manipulation, reentrancy, malicious accounts/paymasters, resource exhaustion, secret leakage, wrong-chain/EntryPoint binding, and Automation/Wallet authority smuggling.

## GAS-12 — public-testnet qualification and launch closeout

Pin exact release/deployment identity; collect live paymaster/deposit/Wallet/Automation evidence; execute failure drills; verify compatibility with `EntryPoint420`, Wallet, 420RPC, Registry and Automation; retain a machine-readable `go`/`no-go` report. Synthetic CI evidence validates closeout logic only and cannot authorize public-testnet launch.

## Authority rule

420Gas may decide whether an exact otherwise-authorized UserOperation is eligible for bounded gas sponsorship and may settle that sponsorship through the canonical EntryPoint path. It never determines user intent, wallet ownership, Smart Account permissions, target-protocol authorization, Automation eligibility, canonical chain state/finality, Oracle truth, bridge settlement, governance authority, or arbitrary spending authority.
