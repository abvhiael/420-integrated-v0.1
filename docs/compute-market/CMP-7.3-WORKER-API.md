# CMP-7.3 — Worker API

Status: **IMPLEMENTED — Level 1 exact-head qualification pending.**

## Canonical purpose

Expose a stable worker-facing/read API for provider, node, resource, capacity and active-offer state without granting the API scheduler, acceptance, execution-key, custody, verification, slashing or settlement authority.

## Requirements

- bind worker reads to the selected chain;
- require canonical worker IDs and fail closed on malformed IDs;
- return provider/node/resource identity, status, live/available capacity and active offer references;
- mark every projection `authoritative:false` with explicit finality;
- refuse state-changing methods on the read endpoint;
- fail closed when the worker projection source is unavailable rather than inventing worker state.

## Implementation

`@420/compute-api` now exposes `GET /v1/compute/workers/:workerId`. The service consumes an injected projection backend and enforces the non-authoritative indexer boundary before returning data.

Worker registration, key rotation, offer publication, assignment acceptance and result signing remain canonical contract/worker-runtime operations and are deliberately not reimplemented by this API.

## Qualification

Level 1: strict TypeScript build plus targeted worker projection, unavailable-backend and method-boundary tests. Level 2 remains deferred to CMP-7.5.

## Next canonical step

**CMP-7.4 — Verifier API**
