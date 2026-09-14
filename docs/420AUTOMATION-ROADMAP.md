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

## AUT-10 closeout

AUT-10 provides a bounded operational-observability layer without making telemetry a protocol or chain authority.

Delivered:

- separate readiness state from process liveness;
- fresh chain-420, RPC-ready, canonical-safe evidence requirements;
- scheduler-readiness and minimum-live-worker requirements;
- Oracle-specific degraded state separated from canonical safety failure;
- recovery hysteresis requiring consecutive healthy observations before reopening;
- fixed low-cardinality metrics for jobs, workers, leases, active/ambiguous attempts, and execution outcomes;
- bounded execution-receipt journal with deterministic sequence ordering and eviction;
- explicit reminder that submitted receipts do not prove inclusion/finality;
- redacted operational snapshots with `canonicalAuthority: false` and `containsSecrets: false`;
- no secret, credential-ID, address, calldata, transaction-hash, provider-payload, or arbitrary-label metric dimensions;
- operator recovery procedure that defers ambiguity/reorg decisions to AUT-6 canonical recovery evidence.

Readiness is an ingress/operator safety signal only. It does not define canonical chain state, finality, Oracle truth, protocol permissions, funding authority, worker ownership, or replay eligibility.

## Planned phases

- **AUT-11 — hostile-state/security hardening.** Cross-layer adversarial tests, trigger spoofing, replay/race abuse, malicious jobs, quota/resource abuse, reorg/finality faults, secret-leak prevention, and observability abuse.
- **AUT-12 — public-testnet qualification and launch closeout.** Exact release identity, live worker/job evidence, failure drills, compatibility evidence, and explicit go/no-go closeout.

## Authority rule

420Automation may decide that a registered job is eligible for attempted execution and may coordinate a bounded worker transaction. It never determines consensus, canonical chain state, finality, ownership, wallet authority, bridge settlement, oracle truth, governance authority, arbitrary protocol permissions, open-ended spending authority, speculative replay authority, worker-created execution authority, raw-provider Oracle authority, API-created protocol authority, or telemetry-created protocol authority.
