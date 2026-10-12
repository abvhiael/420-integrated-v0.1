# BNB-2.14 — Deployment and Operational Acceptance

Canonical scope: staging infrastructure; PostgreSQL migrations; multi-instance testing; backups; observability; deployment rollback; production-equivalent testnet.

**Status: IN PROGRESS — exact-SHA qualification pending; live testnet deployment acceptance deferred.**

## Repository-side provisions

- Non-root FastAPI container with `--no-proxy-headers`, localhost-bound staging Compose, PostgreSQL 16 health check, authenticated bearer/service proof boundaries and distinct `/health/live` and DB-backed `/health/ready`. The latter is a connectivity check, **not proof that an unmigrated or unaudited service is production safe**.
- `services/420bnb/migrate.py`: strictly sequenced 001–020 SQL application in a single transaction, PostgreSQL transaction-scoped advisory lock shared across instances, per-file SHA256 ledger, repeatable deployment and fail-closed ledger gaps/drift. Untracked existing schemas require **manual operator-led reconciliation**; never mark existing DDL as applied without proof.
- `.github/workflows/bnb-runtime.yml`: fresh PostgreSQL application, repeated migrations and checksum checks, concurrent migration test, application tests, container build/startup and browser validation on exact PR SHA. This is controlled **CI staging simulation**, not a deployed production-equivalent infrastructure acceptance.
- `tests/test_bnb214_operations.py`: multi-instance advisory-lock serialization, checksum drift refusal, repeatability and migration counts; these need verified CI PASS on exact implementation SHA.
- Existing database-scoped inventory locks, deduplication and reviewer/Pay replay controls protect multiple stateless service processes sharing one Postgres. Genuine distinct-node networking, connection pool exhaustion, database failover and recovery consistency remain external operational acceptance.

## Backup, restoration and rollback runbook

A backup is not complete until **restore integrity is witnessed**. Operators must use a separately scoped backup identity, off-host encrypted object storage, retention/legal deletion policy, access logging and credentials from secret management, never the repository. For an approved staging environment:

1. Before migration/deployment, record Git image digest, migration ledger checksum, database instance ID and PostgreSQL version. Pause new writes or take a consistent logical snapshot with an independently verified recovery point.
2. Run `pg_dump --format=custom --no-owner --no-acl --file=<secured-path> "$BNB_DATABASE_URL"` with credentials supplied through a secure external environment. Do not upload the dump to GitHub Actions or a public artifact.
3. Create a **separate, disposable** restoration database with least-privilege restore credentials. Restore using `pg_restore --exit-on-error --no-owner --no-acl --dbname="$BNB_RESTORE_DATABASE_URL" <secured-path>`. Never restore over live production in a smoke test.
4. Verify the number and SHA of each entry in `bnb_schema_migration`, application table counts, sampled authorized and private flows, inventory occupancy constraints and recovery/outbox replay controls. Record tested RPO/RTO, backup timestamp, encrypted artifact fingerprint and independent witness.
5. A failed deployment **rolls application traffic back only to a previously compatible image**. Never blindly reverse SQL migrations containing DDL/data changes. If schema compatibility is not proven, stop writes, restore a validated snapshot to isolated infrastructure and perform an operator-approved cutover with reconciliation.
6. Alert on unready instances, DB pool saturation, backup age, failed restores, migration drift, suspicious authorization failures, payment recovery backlog, outbox age, service errors and repeated replay/collision responses. Avoid recording user secrets, raw identity proofs, private addresses, payment proof payloads or message bodies in telemetry.

## Operational deployment contract

Deployment requires a controlled image digest, a single supervised migration job before rolling up instances, database schema checksum acceptance, health probe gating, independently configured trusted issuer public keys, exact upstream API contracts, HTTPS/mTLS ingress, a secure secret store, separate read/write/migration/backup roles, resource limits, metrics and structured redacted logs. Neither Compose nor the CI PostgreSQL service is production infrastructure. No owner-supplied self-attestation may stand in for legal, Identity or Pay operator approval.

## Deferred external acceptance

**T-BNB-OPS-214** (testnet roadmap): provision and inspect genuine production-equivalent testnet infrastructure; managed PostgreSQL with TLS, storage encryption, least-privilege and failover; at least two independently started instances sharing the same database; backup + independently witnessed restore/rollback drills with measured RTO/RPO; HTTPS ingress, real approved external signing providers, telemetry/error and security-alert channels; chaotic restart/DB failover tests while bookings, replay controls and financial recovery remain consistent; incident and rollback exercises, reviewer/operator approval, exact deployment digest and run receipts. No official testnet acceptance or deployment signoff is claimed here.

**Level 1:** target BnB Runtime Slice and affected deployment workflow on exact implementation SHA. **Level 2:** broader retained BnB app operational integration if this is the terminal app milestone, without a redundant repo-wide qualification. **Level 3:** final accumulated app-phase reconciliation with then-current main and canonical Solidity + Genesis owners. PR #600 remains draft and unmerged until its applicable gates.
