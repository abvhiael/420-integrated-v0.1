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

Delivered fresh chain-420 observations, safe-head scheduling, deterministic eligibility and occurrence IDs, duplicate suppression, Oracle/manual validation, next-run hints, and bounded deterministic scans.

## AUT-4 — execution coordination and transaction submission — implementation complete

Delivered immutable-envelope-bound plans, selector/hash-verified calldata, deterministic intent digests, worker-only signing, canonical-safe same-chain RPC submission, distinct accepted/rejected/ambiguous receipts, and no implicit replay after ambiguous submission.

## AUT-5 — funding, fees and execution budgets — implementation complete

Delivered:

- per-job funding modes for worker, escrow, and future paymaster sponsorship;
- explicit caps for max fee per gas and max priority fee per gas;
- gas-cost, native-value, total-cost, and reimbursement ceilings;
- fresh funding-balance and allowance evidence requirements;
- fresh fee-quote requirements with future/stale evidence rejection;
- exact job binding across transaction plan, budget, and funding snapshot;
- fail-closed insufficient-balance and insufficient-allowance checks before execution;
- deterministic maximum gas-cost and total-cost calculations from the AUT-4 gas limit;
- bounded reimbursement that never exceeds the configured reimbursement ceiling;
- optional paymaster quote binding to exact paymaster identity, quote ID, expiry, and sponsorship amount;
- sponsorship clamped to the job's gas-cost ceiling so a paymaster cannot inflate execution spend;
- explicit rejection of paymaster data for non-paymaster funding modes;
- deterministic funding-authorization digests bound to the AUT-4 intent and fee/funding decision;
- hostile tests for fee/value/gas/total overruns, stale evidence, insufficient funding, malformed budgets, paymaster mismatch, and expired sponsorship.

AUT-5 authorizes a bounded maximum spend envelope only. It does not custody funds, move balances, choose arbitrary execution intent, enlarge the AUT-1 envelope, or give 420Gas/Paymaster authority over protocol execution.

Exit gate: merge only after exact-head 420Automation, docs, and repository-wide qualification plus reconciliation with current `main`.

## Planned phases

- **AUT-6 — retries, idempotency, replay protection and recovery.** Attempt IDs, retry classes/backoff, duplicate execution prevention, reorg-aware recovery and terminal failure semantics.
- **AUT-7 — worker registry, leases and competition.** Replaceable worker identities, assignment/lease rules, liveness, anti-double-execution coordination and optional stake/slashing references.
- **AUT-8 — 420Oracle and external-condition integration.** Canonical automation-feed consumption, freshness/quorum checks, provider neutrality and fail-closed trigger evaluation.
- **AUT-9 — API, authentication and Developer Hub integration.** Job inspection/submission surfaces, scoped API credentials, operator/developer ergonomics and RPC integration.
- **AUT-10 — observability, readiness and operational recovery.** Health/readiness, bounded metrics, execution receipts, redacted status, recovery hysteresis and operator procedures.
- **AUT-11 — hostile-state/security hardening.** Cross-layer adversarial tests, trigger spoofing, replay/race abuse, malicious jobs, quota/resource abuse, reorg/finality faults and secret-leak prevention.
- **AUT-12 — public-testnet qualification and launch closeout.** Exact release identity, live worker/job evidence, failure drills, compatibility evidence and explicit go/no-go closeout.

## Authority rule

420Automation may decide that a registered job is eligible for attempted execution and may coordinate a bounded worker transaction. It never determines consensus, canonical chain state, finality, ownership, wallet authority, bridge settlement, oracle truth, governance authority, arbitrary protocol permissions, or open-ended spending authority.
