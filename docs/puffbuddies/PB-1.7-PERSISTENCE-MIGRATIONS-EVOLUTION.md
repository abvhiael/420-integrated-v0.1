# PB-1.7 — Persistence Migrations & Evolution

PB-1.7 defines storage-neutral migration and backfill semantics for PuffBuddies private canonical persistence. Schema evolution is not permitted to become a back door around consent, visibility, deletion, lifecycle, identity, or canonical ownership rules.

Migrations are explicit, monotonic single-step transforms over canonical PB-1.3 tables. Both input and output are schema-validated. Canonical identifiers cannot be rewritten. A migration cannot create a MATCHED relationship from non-matched state, restore revoked lifecycle authority to ACTIVE, or widen an existing visibility audience. Invalid rows cause a backfill batch to fail during staging rather than returning a partially authoritative result.

This step does not choose a database engine or execute a live migration. Production transactions, database-specific DDL, deployment, backup/restore and operational rollout remain later work.
