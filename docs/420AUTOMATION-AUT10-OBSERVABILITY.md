# 420Automation AUT-10 — observability, readiness and operational recovery

## Purpose

AUT-10 defines how operators determine whether 420Automation is alive, safe to schedule, degraded, or not ready. Operational telemetry is evidence about the service, never canonical chain or protocol authority.

## Readiness model

Automation readiness requires fresh chain-420 evidence, RPC readiness, canonical-safety evidence, scheduler readiness, and the configured minimum number of live AUT-7 workers. Any failure in those dependencies yields `not-ready` and resets recovery hysteresis.

Oracle readiness is intentionally separate. If the canonical chain/RPC/scheduler/worker path is healthy but 420Oracle is degraded, Automation reports `degraded`; non-Oracle job classes may remain operational according to ingress policy, while Oracle-triggered jobs must fail closed at their own eligibility boundary.

A recovering service must satisfy the healthy readiness predicate for multiple consecutive observations before returning to `ready`. This prevents one transient probe from immediately reopening scheduling after a hard failure.

## Metrics

AUT-10 exports a fixed low-cardinality metric set covering job count, registered/live workers, active leases, active/ambiguous attempts, and submitted/rejected/ambiguous execution receipts. Metrics never use job IDs, occurrence IDs, worker IDs, credential IDs, addresses, transaction hashes, calldata, trigger values, or arbitrary error text as labels.

## Execution receipt journal

Execution receipts are stored in a bounded in-memory journal. Each entry records sequence/time plus the AUT-4 receipt identity and outcome fields needed for operational correlation. Capacity and read limits are bounded; old entries are evicted rather than allowing unbounded growth.

The journal is operational evidence only. A `submitted` receipt does not prove inclusion or finality; AUT-6 recovery state remains responsible for canonical confirmation and reorg handling.

## Redaction and authority

Operational snapshots explicitly report `canonicalAuthority: false` and `containsSecrets: false`. They contain aggregate counts and readiness reasons only. They do not contain API bearer secrets/digests, user keys, calldata, Oracle provider payloads, or target-protocol authority.

## Operator procedure

1. Check process liveness separately from readiness.
2. If readiness is `not-ready`, stop new scheduling/admission and inspect the bounded reason set.
3. Verify chain ID, RPC readiness, canonical safety and freshness before touching worker state.
4. Verify scheduler health and live-worker quorum.
5. Treat Oracle-only degradation as a dependency-specific degraded state, never as chain finality evidence.
6. Never replay an ambiguous/submitted attempt from telemetry alone; use AUT-6 canonical recovery evidence.
7. After the underlying fault is corrected, require the configured consecutive healthy observations before reopening normal scheduling.
8. Use receipt/metric counts for diagnosis, not as protocol truth.

## Invariants

- readiness does not define canonical chain state or finality;
- hard chain/RPC/scheduler/worker failures fail closed;
- Oracle degradation is represented separately from canonical safety failure;
- recovery is hysteretic rather than single-probe;
- receipt history and metrics are bounded;
- telemetry dimensions are low-cardinality and secret-free;
- execution receipts do not override AUT-6 recovery semantics;
- operational snapshots remain explicitly noncanonical.
