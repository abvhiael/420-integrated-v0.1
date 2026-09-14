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

## AUT-8 closeout

AUT-8 consumes only provider-neutral canonical 420Oracle V1 reads for the `420/ORACLE/FEED/AUTOMATION/V1` feed class. Raw provider submissions do not become Automation facts.

Delivered:

- exact binding to chain 420 and the configured canonical Oracle router identity;
- canonical numeric `MEDIAN_NUMERIC` automation facts;
- canonical exact-result `QUORUM_EQUAL` automation facts;
- deterministic fixed-point conversion from Oracle numeric values to AUT-3 decimal observations;
- exact-result Oracle triggers with deterministic trigger references while preserving existing numeric trigger identity;
- local maximum-read-age checks in addition to Oracle's own heartbeat/epoch rules;
- configurable minimum confidence and minimum source/quorum requirements;
- local numeric spread bounds;
- V1 source-count bounds matching the frozen Oracle maximum of 16;
- provider-neutral provenance on accepted facts;
- rejection of wrong-chain, wrong-router, wrong-feed-type, stale/future, low-confidence, insufficient-quorum, excessive-spread, malformed-result, and provider-shaped payloads;
- AUT-3 eligibility integration for exact-result conditions.

A successful Oracle read is trigger evidence only. It cannot assign a worker, create an AUT-7 lease, alter execution intent, change funding, bypass replay protection, or authorize arbitrary calls.

## Planned phases

- **AUT-9 — API, authentication and Developer Hub integration.** Job inspection/submission surfaces, scoped API credentials, operator/developer ergonomics, and RPC integration.
- **AUT-10 — observability, readiness and operational recovery.** Health/readiness, bounded metrics, execution receipts, redacted status, recovery hysteresis, and operator procedures.
- **AUT-11 — hostile-state/security hardening.** Cross-layer adversarial tests, trigger spoofing, replay/race abuse, malicious jobs, quota/resource abuse, reorg/finality faults, and secret-leak prevention.
- **AUT-12 — public-testnet qualification and launch closeout.** Exact release identity, live worker/job evidence, failure drills, compatibility evidence, and explicit go/no-go closeout.

## Authority rule

420Automation may decide that a registered job is eligible for attempted execution and may coordinate a bounded worker transaction. It never determines consensus, canonical chain state, finality, ownership, wallet authority, bridge settlement, oracle truth, governance authority, arbitrary protocol permissions, open-ended spending authority, speculative replay authority, worker-created execution authority, or raw-provider Oracle authority.
