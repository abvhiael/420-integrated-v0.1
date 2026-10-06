# 420Mail MAIL-2.2 qualification evidence

Step: **MAIL-2.2 — Durable Mail Storage**  
Status: **COMPLETE**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**

## Repository identity

- Audit/feature branch: `mail-2-1-mailbox-state-model-20261005`
- Accumulated Phase 2 PR: **#530 — feat(mail): Phase 2 mailbox foundation (MAIL-2.1–2.2)**
- Current reconciliation/base `main` SHA: `ea9994669564d0795e2bcc4a38beea0b01bef274`
- Qualified implementation branch SHA: `e4cdd1d1914838c07e90edf788e62a6124eef909`
- Exact GitHub PR merge-candidate SHA tested by CI: `8cbb5433936fe946d7fc457a27a58e7c586255a1`
- CI workflow: **420Mail Audit Qualification**
- CI run: **37403228314** (run #30)
- CI job: **112074882972** (`mail-audit`) — PASS

This file is an evidence-only follow-up. It changes no executable code, tests, workflow, dependency, configuration, interface, deployment state, or substantive roadmap requirement. The exact qualified implementation remains the SHA above.

## Canonical requirement

The canonical Phase 2 roadmap defines MAIL-2.2 exactly as:

> Replace in-memory mailbox/message metadata state with persistent transactional storage, indexes, migrations, restart recovery, and distributed idempotency.

MAIL-2.2 remains an ordinary app-scoped Level 1 step inside the **Mailbox foundation milestone (MAIL-2.1 through MAIL-2.10)**.

## Requirements satisfied

### Persistent transactional storage — PASS

- Added the `MailStore` transactional abstraction.
- Added `DurableStore` / `OpenDurableStore(path)`.
- Service state reads and mutations use `View` / `Update` transactions instead of direct in-memory maps.
- Generic service composition requires explicit store selection; there is no implicit in-memory production fallback.
- `NewDurableService` constructs a durable Mail runtime.
- Durable commits use temp-file write, fsync, atomic rename, file mode 0600 and parent-directory fsync.
- Failed transaction callbacks do not persist partial state.

### Indexes — PASS

- Added durable owner/folder mailbox secondary indexes.
- Indexes are rebuilt and validated on durable load/commit.
- Mailbox listing uses the owner/folder index.
- Stale persisted index material is repaired from canonical mailbox state.

### Migrations — PASS

- Store schema version is explicit: `DurableStoreSchemaVersion = 1`.
- Schema-zero/legacy-empty state is migrated to the current layout with initialized maps/indexes.
- Future unsupported schema versions fail closed.
- Malformed/corrupt state fails closed.

### Restart recovery — PASS

- Message metadata, mailbox lifecycle state, idempotency evidence and indexes survive close/reopen.
- Restarted service instances can immediately read prior mailbox state and preserve idempotent-send behavior.
- Private body plaintext is not written to the metadata state file.

### Distributed idempotency — PASS

- Sender-scoped idempotency is rechecked inside the exclusive durable transaction before commit.
- Multiple Mail instances sharing the same durable store cannot commit duplicate logical messages for the same sender/key.
- Concurrent identical requests return the same message ID and create one inbox entry.
- Exactly one notification is emitted for the logical delivery.
- Same sender/key with conflicting content fails with `ErrIdempotencyConflict`.
- Cross-instance writes are visible because durable reads reload canonical state under an advisory file lock.

## Implementation summary

- Added `mail/store.go` durable transactional storage layer.
- Added `mail/store_test.go` restart, migration, corruption, rollback, index, permissions and multi-instance qualification.
- Refactored `mail/service.go` to use `MailStore` transactions.
- Made in-memory storage explicit for tests/development rather than implicit in runtime construction.
- Made test blob/notification doubles race-safe.
- Extended the Mail service profile with durable metadata-store requirements.
- Updated Mail documentation and canonical Phase 2 current-step bookkeeping.
- Extended the Mail verifier for durable-store invariants.
- Reconciled the already-merged 420Mail website asset fix from current `main` into the accumulated Phase 2 branch content.

## Level 1 qualification

Final authoritative run: **37403228314**, job **112074882972**, against exact PR merge-candidate `8cbb5433936fe946d7fc457a27a58e7c586255a1`.

- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS

Direct security/adversarial/boundary evidence includes:

- transaction rollback on mutation failure;
- corrupt-state rejection;
- unsupported future-schema rejection;
- state/lock-file 0600 permissions;
- index reconstruction from canonical state;
- restart recovery;
- immediate cross-instance visibility;
- concurrent multi-instance same-request idempotency;
- cross-instance conflicting-request rejection;
- single-notification delivery under concurrent idempotent sends;
- metadata-store private-body plaintext exclusion;
- retained MAIL-2.1 authorization/lifecycle tests;
- race-detector coverage.

## Diagnosed non-passing runs

Non-final runs were not treated as completion evidence:

- Run `37402822442` / job `112073601981` failed at the format gate before tests. Root cause: new store files were not gofmt-normalized.
- Run `37402897206` / job `112073836357` intentionally retained the same fail-closed format gate but printed the precise formatter diff; exact formatter changes were then committed.
- A later green candidate exposed a semantic audit gap during review: `NewService` still implicitly selected `MemoryStore`. That production-bypass risk was removed and the final candidate requalified.
- Final boundary tests then added private-body exclusion and exactly-one-notification concurrency assertions, producing the final authoritative implementation SHA and run above.

## Milestone and deferred qualification

**Level 2:** intentionally deferred. MAIL-2.2 is step 2 of the documented **Mailbox foundation milestone**, whose retained app-specific integration qualification occurs at MAIL-2.10 unless a later shared-dependency change requires it sooner.

**Level 3:** intentionally deferred to complete app-phase closeout. MAIL-2.2 introduces no Mail-owned Solidity contract, Genesis address authority, chain consensus change, or other repository-wide authority that would justify premature global qualification.

## Limitations / downstream blockers

- The built-in durable implementation is an atomic file store. Multi-process/distributed guarantees require all cooperating instances to share a filesystem that correctly supports advisory `flock` and atomic rename semantics. A database-backed `MailStore` can replace this implementation for a different deployment topology without changing service semantics.
- MAIL-2.2 qualifies repository persistence/restart behavior, not production backup/restore or disaster-recovery operations.
- Private body persistence/encryption remains delegated to the 420Storage-compatible `PrivateBlobStore`; live qualified encrypted Storage integration remains a MAIL-AUDIT-7+ release/testnet obligation.
- Live Identity, Messenger, Notifications and public-testnet qualification are not claimed here.
- 420Mail remains outside the frozen Genesis application catalog.

None of these downstream release obligations prevents the repository-defined MAIL-2.2 step from satisfying its own Level 1 exit requirements.

## Completion

**MAIL-2.2 — Durable Mail Storage: COMPLETE at Level 1.**

Next canonical roadmap step: **MAIL-2.3 — Labels & Custom Folders**.
