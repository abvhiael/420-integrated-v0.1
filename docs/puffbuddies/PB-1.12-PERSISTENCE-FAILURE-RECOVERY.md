# PB-1.12 — Persistence Failure & Recovery Qualification

PB-1.12 qualifies the storage-neutral PB-1 persistence boundary against failure and recovery hazards. Authoritative persistence unavailability fails closed; stale or conflicting replicas cannot substitute for canonical state; optimistic concurrency rejects stale writes/deletes; and restore snapshots remain subject to PB-1.8 revocation/deletion rules.

Partial operation failure is explicitly not a successful/publishable authority state. The current in-memory adapter is nontransactional, so this foundation does not falsely claim rollback semantics it cannot provide. Production persistence must supply real transactional guarantees. Recovery uses complete known-good before-images and refuses to synthesize rollback from partial after-images.

This step does not introduce a production database, replica system, backup/DR service, queue, API, worker, contract, deployment, or live integration.
