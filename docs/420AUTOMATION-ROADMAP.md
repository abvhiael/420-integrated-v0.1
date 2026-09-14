# 420Automation implementation roadmap

420Automation is the replaceable off-chain scheduling and execution-coordination layer for 420 Integrated. Each phase ships on its own branch and PR, is reconciled with current `main`, fully qualified on the exact final head, and merged before the next phase starts.

## Completed phases

- AUT-0 — architecture and trust foundation.
- AUT-1 — job identity, registry, and immutable execution envelope.
- AUT-2 — trigger model and deterministic normalization.
- AUT-3 — deterministic eligibility engine and bounded scheduler.
- AUT-4 — execution coordination and transaction submission.
- AUT-5 — funding, fees, and execution budgets.
- AUT-6 — retries, idempotency, replay protection, and recovery.
- AUT-7 — worker registry, liveness, leases, and competition control.

## AUT-7 closeout

AUT-7 delivers bounded replaceable worker registration, unique worker and signing-address identity, active/draining/disabled lifecycle states, heartbeat freshness, one active lease per occurrence, deterministic lease identity, exact lease-owner release and renewal, automatic expiry cleanup, bounded worker/lease cardinality, defensive-copy reads, and optional stake references as metadata only.

A lease coordinates which already-eligible worker may act. It does not create eligibility, alter AUT-1 execution intent, bypass AUT-6 replay protection, expand AUT-5 budgets, or create protocol authority.

## Planned phases

- **AUT-8 — 420Oracle and external-condition integration.** Canonical automation-feed consumption, freshness/quorum checks, provider neutrality, and fail-closed trigger evaluation.
- **AUT-9 — API, authentication and Developer Hub integration.** Job inspection/submission surfaces, scoped API credentials, operator/developer ergonomics, and RPC integration.
- **AUT-10 — observability, readiness and operational recovery.** Health/readiness, bounded metrics, execution receipts, redacted status, recovery hysteresis, and operator procedures.
- **AUT-11 — hostile-state/security hardening.** Cross-layer adversarial tests, trigger spoofing, replay/race abuse, malicious jobs, quota/resource abuse, reorg/finality faults, and secret-leak prevention.
- **AUT-12 — public-testnet qualification and launch closeout.** Exact release identity, live worker/job evidence, failure drills, compatibility evidence, and explicit go/no-go closeout.

## Authority rule

420Automation may decide that a registered job is eligible for attempted execution and may coordinate a bounded worker transaction. It never determines consensus, canonical chain state, finality, ownership, wallet authority, bridge settlement, oracle truth, governance authority, arbitrary protocol permissions, open-ended spending authority, speculative replay authority, or worker-created execution authority.
