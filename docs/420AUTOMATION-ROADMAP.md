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

Delivered bounded worker/escrow/paymaster funding modes, fee/gas/value/total/reimbursement ceilings, fresh balance/allowance and fee evidence, exact job binding, deterministic funding authorizations, and a paymaster boundary that cannot expand execution authority.

## AUT-6 — retries, idempotency, replay protection and recovery — implementation complete

Delivered:

- deterministic attempt IDs bound to job ID, occurrence ID, AUT-4 intent digest, and attempt number;
- explicit attempt states for ready, submitted, retry-wait, ambiguous, confirmed, and terminal execution;
- capped exponential backoff for retryable pre-accept rejections;
- maximum-attempt enforcement with terminal exhaustion semantics;
- immediate terminal handling for non-retryable rejections;
- exact receipt binding so a retry state cannot be updated by a different job, occurrence, or intent;
- no automatic retry after an accepted submission;
- no automatic retry after an ambiguous submission;
- ambiguity hold periods before any not-submitted recovery can become retryable;
- fresh chain-420 canonical-safe recovery evidence requirements;
- accepted ambiguity resolution that converts directly to submitted state without replay;
- transaction observation handling for pending, canonical, finalized, missing, and reorged submissions;
- finalized transaction confirmation as the terminal success state;
- fail-closed `not-found` handling that becomes ambiguous rather than retryable;
- reorg retry only after explicit canonical-safe safe-non-inclusion evidence;
- uncertain reorg state converted to ambiguity rather than speculative replay;
- duplicate-active-attempt detection for the same occurrence;
- hostile tests for premature retries, wrong-chain recovery evidence, unsafe evidence, max-attempt exhaustion, identity mismatch, ambiguous acceptance, missing transactions, and reorg recovery.

AUT-6 does not grant permission to execute a job twice. Recovery evidence can unlock a new bounded attempt only after the previous attempt is proven not to have executed under the phase's fail-closed rules.

Exit gate: merge only after exact-head 420Automation, docs, and repository-wide qualification plus reconciliation with current `main`.

## Planned phases

- **AUT-7 — worker registry, leases and competition.** Replaceable worker identities, assignment/lease rules, liveness, anti-double-execution coordination and optional stake/slashing references.
- **AUT-8 — 420Oracle and external-condition integration.** Canonical automation-feed consumption, freshness/quorum checks, provider neutrality and fail-closed trigger evaluation.
- **AUT-9 — API, authentication and Developer Hub integration.** Job inspection/submission surfaces, scoped API credentials, operator/developer ergonomics and RPC integration.
- **AUT-10 — observability, readiness and operational recovery.** Health/readiness, bounded metrics, execution receipts, redacted status, recovery hysteresis and operator procedures.
- **AUT-11 — hostile-state/security hardening.** Cross-layer adversarial tests, trigger spoofing, replay/race abuse, malicious jobs, quota/resource abuse, reorg/finality faults and secret-leak prevention.
- **AUT-12 — public-testnet qualification and launch closeout.** Exact release identity, live worker/job evidence, failure drills, compatibility evidence and explicit go/no-go closeout.

## Authority rule

420Automation may decide that a registered job is eligible for attempted execution and may coordinate a bounded worker transaction. It never determines consensus, canonical chain state, finality, ownership, wallet authority, bridge settlement, oracle truth, governance authority, arbitrary protocol permissions, open-ended spending authority, or speculative replay authority.
