# 420Automation implementation roadmap

420Automation is the replaceable off-chain scheduling and execution-coordination layer for 420 Integrated. It evaluates bounded triggers and coordinates protocol-defined jobs without becoming protocol authority.

## Delivery rule

Each numbered AUT phase is developed on its own branch/PR, reconciled against current `main`, fully qualified on the exact final head, and merged before the next phase begins.

## AUT-0 — architecture and trust foundation — implementation complete

Delivered package foundation, chain-420 pinning, explicit trigger classes, replaceable workers, and no-custody/no-authority invariants.

## AUT-1 — job identity, registry and immutable execution envelope — implementation complete

Delivered deterministic job identity, protocol/owner identity, immutable execution envelopes, lifecycle state/revisions, discovery, defensive-copy reads, and fail-closed validation.

## AUT-2 — trigger model and normalization — implementation complete

Delivered deterministic normalization and `triggerRef` derivation for time, block, event, Oracle, and manual triggers, plus exact binding verification and execution-authority-smuggling rejection.

## AUT-3 — deterministic eligibility engine and scheduler — implementation complete

Delivered:

- chain-420 observation validation with freshness and head/safe/finalized ordering checks;
- deterministic eligibility decisions for all five normalized trigger classes;
- safe-head block scheduling and event-confirmation evaluation;
- deterministic occurrence IDs for one-shot, interval, cron, block, event, Oracle, and manual trigger occurrences;
- duplicate suppression using consumed occurrence IDs;
- Oracle value freshness plus exact decimal predicate comparison without floating-point arithmetic;
- manual requester identity enforcement against AUT-1 owner/protocol identity;
- disabled-job rejection and exact AUT-1/AUT-2 trigger-binding enforcement;
- deterministic next-time and next-block hints where available;
- deterministic job-ID scan ordering;
- configurable per-scan job bound that fails closed on excessive work;
- hostile tests for wrong-chain, stale-chain, binding mismatch, premature event confirmation, duplicate occurrences, and scan exhaustion.

AUT-3 produces eligibility facts only. It does not construct, sign, fund, submit, retry, or authorize transactions.

Exit gate: merge only after exact-head 420Automation, docs, and repository-wide qualification plus reconciliation with current `main`.

## Planned phases

- **AUT-4 — execution coordination and transaction submission.** Build bounded worker transactions from registered job intent and submit through safe public RPC without user-key custody or ambiguous replay.
- **AUT-5 — funding, fees and execution budgets.** Job balances/allowances, gas ceilings, fee policy, reimbursements and future 420Gas/Paymaster integration boundaries.
- **AUT-6 — retries, idempotency, replay protection and recovery.** Attempt IDs, retry classes/backoff, duplicate execution prevention, reorg-aware recovery and terminal failure semantics.
- **AUT-7 — worker registry, leases and competition.** Replaceable worker identities, assignment/lease rules, liveness, anti-double-execution coordination and optional stake/slashing references.
- **AUT-8 — 420Oracle and external-condition integration.** Canonical automation-feed consumption, freshness/quorum checks, provider neutrality and fail-closed trigger evaluation.
- **AUT-9 — API, authentication and Developer Hub integration.** Job inspection/submission surfaces, scoped API credentials, operator/developer ergonomics and RPC integration.
- **AUT-10 — observability, readiness and operational recovery.** Health/readiness, bounded metrics, execution receipts, redacted status, recovery hysteresis and operator procedures.
- **AUT-11 — hostile-state/security hardening.** Cross-layer adversarial tests, trigger spoofing, replay/race abuse, malicious jobs, quota/resource abuse, reorg/finality faults and secret-leak prevention.
- **AUT-12 — public-testnet qualification and launch closeout.** Exact release identity, live worker/job evidence, failure drills, compatibility evidence and explicit go/no-go closeout.

## Authority rule

420Automation may decide that a registered job is eligible for attempted execution and may coordinate a bounded worker transaction. It never determines consensus, canonical chain state, finality, ownership, wallet authority, bridge settlement, oracle truth, governance authority, or arbitrary protocol permissions.
