---
title: 420Storage load and capacity qualification
audience:
  - developer
  - operator
category: developer
status: development
version: current
---

# 420Storage load and capacity qualification

SR-10.3 qualifies sustained Resource Network behavior under bounded concurrent load. The goal is not to publish a universal throughput promise; it is to make capacity evidence reproducible on a named software/configuration head while preserving integrity, authorization, cancellation and authority boundaries.

## Qualification dimensions

The SR-10.3 harness covers:

- concurrent verified retrieval through cache/store routing;
- deterministic cache miss/fallback distribution;
- concurrent provider discovery while service state churns between running and degraded;
- concurrent HTTP range requests through the Gateway handler;
- cancellation pressure with worker completion and goroutine-leak checks;
- integrity verification on every successful retrieval.

The current CI capacity fixture uses 512 retrieval operations with 32 workers, a deterministic 50 percent cache-failure pattern and Store fallback, 800 concurrent discovery observations during 100 cache degrade/recover cycles, 128 concurrent range requests and 64 cancellation-bound workers.

These numbers are qualification fixtures, not production SLOs. SR-10.8 defines operational SLOs after testnet and capacity evidence exist.

## Pass conditions

A qualified head must show:

1. every concurrent retrieval either returns the exact committed payload or fails explicitly;
2. cache corruption or cache failure cannot bypass Store integrity verification;
3. deterministic fallback counts match the injected load pattern;
4. discovery churn does not remove stable healthy providers or emit malformed entries;
5. range responses remain byte-correct under concurrent requests;
6. cancellation-bound workers terminate and do not leave an unbounded goroutine delta;
7. all standard node420, 420 Integrated and 420Docs gates pass on the same exact head.

## Capacity evidence

Capacity results must always record at least:

- exact commit SHA;
- topology/configuration fingerprint;
- worker count and operation count;
- payload size/workload mix;
- cache hit/miss/fallback distribution;
- request errors and integrity failures;
- elapsed duration when used for a benchmark run;
- process/runtime resource observations where available.

Do not compare throughput numbers across different machines or CI runner classes without recording the execution environment.

## Leak and soak guidance

The unit-level qualification harness intentionally stays short enough for normal CI. Longer soak runs should reuse the same workload semantics over many iterations and additionally watch memory growth, open file descriptors, goroutine count, repair backlog, retry counts and provider-discovery churn.

A soak pass must not redefine canonical truth from observed availability. Canonical identity, placements, proofs and settlement remain protocol-derived even when an endpoint is continuously reachable.

## Relationship to later SR-10 work

SR-10.3 establishes repeatable load semantics and capacity evidence. SR-10.8 converts the evidence into operator thresholds/SLOs, and SR-10.9 repeats representative workloads against the qualified testnet deployment.
