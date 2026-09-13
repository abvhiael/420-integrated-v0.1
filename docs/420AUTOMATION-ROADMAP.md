# 420Automation implementation roadmap

420Automation is the replaceable off-chain scheduling and execution-coordination layer for 420 Integrated. It evaluates bounded triggers and coordinates protocol-defined jobs without becoming protocol authority.

## Delivery rule

Each numbered AUT phase is developed on its own branch/PR, reconciled against current `main`, fully qualified on the exact final head, and merged before the next phase begins.

## AUT-0 — architecture and trust foundation — implementation complete

Delivered:

- `420-automation/` package foundation and TypeScript qualification surface;
- chain ID 420 pinning;
- explicit trigger classes: time, block, event, oracle, manual;
- replaceable off-chain worker model;
- no user-key custody or user transaction signing;
- no worker-invented target, calldata, or native value;
- no bypass of protocol-owned authorization/state checks;
- no canonical-chain/finality/fork-choice authority;
- 420Oracle automation triggers treated as eligibility facts, never remote execution;
- bridge-proof and Engine API separation;
- hostile configuration tests for authority escalation.

Exit gate: merge only after exact-head 420Automation, docs, and repository-wide qualification plus reconciliation with current `main`.

## Planned phases

- **AUT-1 — job identity, registry and immutable execution envelope.** Define job IDs, owner/protocol identity, target/selector/value/calldata constraints, enable/disable state, revisions and discovery semantics.
- **AUT-2 — trigger model and normalization.** Time/cron-like schedules, block-height/interval triggers, chain-event filters, 420Oracle trigger facts, and explicit manual eligibility requests.
- **AUT-3 — deterministic eligibility engine and scheduler.** Evaluate trigger state, next-run windows, chain safety/freshness, duplicate suppression and bounded scan work.
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
