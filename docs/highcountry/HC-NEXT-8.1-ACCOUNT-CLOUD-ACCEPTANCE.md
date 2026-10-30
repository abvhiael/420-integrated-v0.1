# HC-NEXT-8.1 — Account and cloud-save production hardening acceptance

**Assigned exit:** verify registration, authentication, account recovery, save versioning, synchronization, conflicts, backup and restore. Preserve issuer ownership of login credentials and the wallet-free ordinary gameplay account.

## Evidence and ownership

The retained R06.3 account/cloud server is the canonical implementation; no browser-created player principal or raw credential becomes a database authority. The account issuer validates login sessions, expiration, epoch and revocation; the server independently checks the registered issuer account and game scope before and after each operation, and PostgreSQL enforces runtime scope. Registration is idempotent only for matching authoritative account/profile/ruleset bindings, not an arbitrary caller-supplied identity. The authenticated client can resume saved state across sessions, and the datastore rejects cross-account access.

`CloudSaveLifecycle420` requires schema-validated local state, immutable provider object hashes, active explicit CLOUD_SAVE consent, and optimistic expected-revision comparisons in a serializable transaction. Stale writes are rejected without changing the head. Concurrent synchronization must use exactly this server-side revision gate; no last-writer-wins overwrite. Reads verify bytes, length, SHA-256 integrity and ruleset before deserialization. A restore publishes a *new* revision, preserving historical references. Independent backups through the existing authorized `SaveRetentionWorker420` survive deleted source blobs and can restore through the same revision and consent gate; deleted/revoked/expired backups cannot resurrect, and the runtime cannot rewrite backup history.

Account credential recovery is **issuer-owned**: the local fixture provides test-only login/logout/revocation but is not production signup, password reset or account recovery authority. The service must accept a recovered account only after the external issuer reestablishes that **same authoritative account ID**, invalidates stale sessions/epochs, and provides a freshly registered principal. It is not authorized to mint a new token, select another account or transfer saves on the basis of self-declared recovery claims. Real issuer recovery credentials and production/TLS trust remain deployment-specific external acceptance under the existing `HIGHCOUNTRY-TESTNET-WORK-ROADMAP.md`, not falsely certified by the fixture.

## Bounded executable qualification

`.github/workflows/highcountry-next-8-1-acceptance.yml` owns exactly one exact-SHA scoped job using two isolated PostgreSQL 16 databases and the unchanged repository tests:
- Local issuer and HTTP: registration, authentic sessions, revoked/expired/forged bearer, wrong origin, malformed requests, logout and account isolation.
- R06.3 real PostgreSQL and encrypted cloud provider: initial profile, login, consent, save synchronization, stale version conflicts, resumed session, provider outage, authenticated restore, ciphertext tampering and revoked account denial.
- R05.5 cloud lifecycle and encrypted provider: schema/size validation, digest corruption, obsolete revisions, immutable restore and backup-revocation race.
- R05.5 real PostgreSQL: restricted runtime role, independent backup copies, denial of replay or forged authority, expired/deleted primary and backup cleanup, restart-safe restoration of redacted original and migration drift.

These retained checks qualify the existing implementation against 8.1 without re-running unrelated HighCountry economic, blockchain, poker or full-service matrices. Historic passing SHAs/run IDs remain unchanged. Actual external issuer account-recovery deployment, independent backup operator credentials, production TLS and disaster-recovery exercises require live operational evidence, not a test fixture.

**Next:** the next step as specified by the authoritative HC-NEXT roadmap; this qualification does not introduce an HC-NEXT-8.2 design or new product requirements.
