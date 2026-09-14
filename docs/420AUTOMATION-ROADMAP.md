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

Delivered:

- deterministic execution plans bound to an eligible AUT-3 occurrence;
- strict copying of chain ID, target, native value and gas limit from the immutable AUT-1 execution envelope;
- calldata resolution followed by selector and calldata-hash verification before signing;
- deterministic intent digests binding job, occurrence, worker identity, execution envelope and resolved calldata;
- explicit worker identity/address validation;
- worker-only signing interface with no user-key custody or user impersonation;
- same-chain RPC requirement before submission;
- canonical-safe and ready RPC requirement before submission;
- distinct accepted, rejected and ambiguous outcome receipts;
- no automatic replay after ambiguous transport/submission outcome;
- validation of returned transaction hashes and signed payload shape;
- hostile tests for envelope mismatch, ineligible/disabled jobs, wrong-chain RPC, unsafe RPC, malformed worker identity, malformed signed payload and ambiguous submission behavior.

AUT-4 coordinates one bounded submission attempt only. Funding/fees, retries/idempotency, worker leasing/competition and protocol authorization remain outside this phase.

Exit gate: merge only after exact-head 420Automation, docs, and repository-wide qualification plus reconciliation with current `main`.

## Planned phases

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
