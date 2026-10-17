# BNB-6.8 — Release promotion and rollback controls

Canonical exit criteria: immutable image digests, release manifests, compatibility, approvals, promotion, rollback and DB recovery procedures.

- `release.template.v1.json` is an explicitly **unresolved** operator release template, not an accepted deployable production release. Pin exact implementation SHA and four registry digest identities before any promotion.
- `release_controls.py` enforces release schema, exact SHA, immutable image digests, fixed schema 30, disabled feature flags, prohibited automatic down-migration, restore/compatibility proof requirements and non-self-verifiable operator acceptance. Its preflight returns `ready_to_promote=false` even if all caller-provided booleans say true; only an independently governed release system may later grant promotion.
- `tests/test_bnb68_release.py` verifies mutable tags, invalid SHA, schema drift, unauthorized booking activation, synthesized approval, malformed authority inputs, rollback image substitution, and blocking of unverified rehearsal.
- Retained `production.py`, `validate_deployment.py`, `migration_lifecycle.py`, `recovery_operations.py` and `operator_console.py` own image/DB trust, migration/compatibility verification and strictly manual operator recovery.

## Operator runbook (no automatic execution)
1. Identify candidate **qualified executable SHA**, approved registry manifest digest for every workload, and independently attested operator decision. Compare deployed runtime image digests to the exact signed release record.
2. Verify immutable backup object and **successful isolated restore**; check ordered SHA-256 migration ledger at version 30 and recovery outbox/dead-letter state. Do not treat dump creation as proof of restoration.
3. Prove old and new binaries compatible with the actual schema under mixed rollout. If not, halt rolling promotion; do not assume forward-only SQL implies backwards compatibility.
4. Require distinct authorized release operator, security reviewer and data-recovery authority; capture identity/scope, non-secret reference, expiry and signed approval with audit/rollback correlation.
5. Stage deployment with feature flags disabled. Confirm API replicas, PostgreSQL TLS readiness, worker and consumer fail-closed health, ingress and independent upstream authority. Require post-deploy negative/security checks before traffic promotion.
6. On fault, **stop promotion**, preserve immutable ledger/outbox, isolate traffic and assess operational recovery. Binary rollback is allowed only with schema compatibility and approved image; database down migration is **forbidden**. Use approved backup restore or forward repair in controlled isolation, verify data/replay consistency, and capture non-secret audit receipts.
7. Maintain explicit release/rollback decision audit records and enforce a separately governed promotion control; do not infer live acceptance from CI results or template values.

Actual production credentials, immutable registry publication, independent signatures, rollout/rollback rehearsal and live recovery receipts remain externally gated under `docs/bnb/BNB-TESTNET-WORK-ROADMAP.md`. Booking, Pay execution and Travel booking remain disabled.

**Only Level 1 BnB-specific qualification is due; Level 2 BNB-6.11; Level 3 BNB-6.12.**
