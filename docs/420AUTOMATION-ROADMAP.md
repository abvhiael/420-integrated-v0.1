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
- AUT-8 — 420Oracle and external-condition integration.
- AUT-9 — API, authentication, scoped credentials, and Developer Hub integration.
- AUT-10 — observability, readiness, execution receipts, and operational recovery.
- AUT-11 — hostile-state/security hardening and cross-layer adversarial qualification.

## AUT-11 closeout

AUT-11 hardens the full Automation path against hostile inputs and failure races without expanding Automation authority.

Delivered:

- authenticated observation envelopes with source identity, chain binding, freshness, clock-skew limits, monotonic sequencing, and signature verification;
- bounded replay protection for duplicate request identities and source-sequence rollback;
- explicit calldata-size, execution-gas, retry, batch-job, and batch-byte ceilings;
- finalized-chain rollback and finalized-hash conflict detection;
- safe-head/finality ordering checks that fail closed;
- recursive secret redaction for hostile diagnostic payloads;
- bounded, low-cardinality metric-label validation with secret/high-cardinality rejection;
- cross-layer adversarial tests for spoofed manual triggers, repeated/racing trigger delivery, execution-envelope immutability, tampered calldata, finality conflict, and secret-leak attempts;
- successful dedicated 420Automation qualification and full 420 Integrated qualification on the AUT-11 branch head.

AUT-11 does not make Automation an oracle of canonical chain truth. It enforces that Automation refuses to proceed when its bounded evidence conflicts with previously accepted safety conditions.

## Current phase

**AUT-11 is implementation-complete and qualified on the phase branch.** Remaining closeout work is documentation synchronization, reconciliation with current `main`, exact-head requalification, and merge.

## Planned phase

- **AUT-12 — public-testnet qualification and launch closeout.** Exact release identity, live worker/job evidence, failure drills, compatibility evidence, and explicit go/no-go closeout.

## Authority rule

420Automation may decide that a registered job is eligible for attempted execution and may coordinate a bounded worker transaction. It never determines consensus, canonical chain state, finality, ownership, wallet authority, bridge settlement, oracle truth, governance authority, arbitrary protocol permissions, open-ended spending authority, speculative replay authority, worker-created execution authority, raw-provider Oracle authority, API-created protocol authority, or telemetry-created protocol authority.
