# BNB-4.10 — Disaster Recovery and Operations Automation — Level 1 certificate

**Disposition: REPOSITORY LEVEL 1 PASS.** External production operations, managed PostgreSQL, RTO/RPO, custody, incident authority, multi-instance resilience and operator signoff **not** accepted.

## Authority, scope and exact SHAs

- [Canonical Phase 4 roadmap](BNB-PHASE4-ROADMAP.md): **BNB-4.10 — Disaster recovery and operations automation**; ordinary Level 1 app step following BNB-4.9, preceding BNB-4.11 M4-B Level 2.
- Executable source/tests SHA: `3afc9848311ee08dfecfa5615c1754cdf85cceef`. Exact fully tested candidate SHA `f6610e4ac87ef7a60b7c912aba07432cc47fd32e`, with only evidence/runbook documentation committed between those SHAs. The candidate's source and tests match the executable SHA.
- Repository `abvhiael/420-integrated-v0.1`, branch `audit/bnb-phase4-bnb-4-1-baseline-20261013`, PR [#631](https://github.com/abvhiael/420-integrated-v0.1/pull/631) DRAFT, OPEN, UNMERGED.
- Phase 4 base `81c21541acdc1b900b9a15c6f6b75ff2d7c2b5d9`; observed main `959288c8bd33b6da0325b6a5d060e00e7bcf0e48`. Merge-candidate reconciliation reserved for BNB-4.12.
- New [disaster-recovery runbook](BNB-4.10-RECOVERY-RUNBOOK.md) documents independently authorized isolated backup/restore, migration checksums, reconciled outbox/receipt checkpoints, replay, restart, application rollback restrictions, audit minimization, and live source testnet deferrals.

## Requirements and app implementation

1. **Migration/restore safety:** retained original transactional/checksummed 26-version PostgreSQL migrator with advisory-lock serialization, refusing tampered/untracked schema. Retained isolated logical backup/restore and production-restricted startup tests, no direct unapproved production restore or migration/DDL rollback.
2. **Outbox recovery and replay:** retained original BNB-4.2 `outbox.py` fencing/idempotent local adapter, due-claim, duplicate/poison rejection, dead letters, retry/backoff and independently authorized manual replay with `bnb_audit`. Added `recovery_operations.py` operator-gated, non-mutating snapshot assessment of pending events, expired leases and dead letters; restore cannot be declared reconciled when backlog remains. Never quietly re-acknowledge, delete a receipt or replay a Pay event.
3. **Incident automation boundary:** bounded, fail-closed `restart`, `restore`, `rollback`, `replay` assessments reject unsigned/unapproved operations before database access, deny enabled live bookings/financial execution, reject version mismatch, prohibit automated database rollback and direct operators to separately approved workflows. Production runtime remains read-only/nonroot with pinned image digests and isolated secret mounts.
4. **Alert minimization:** `alert_summary` exposes only fixed action/ready/reason and aggregate pending/lease/dead-letter counts. Neither raw events nor private guest/host data, credentials, wallets, payment receipts, addresses or traces are surfaced.
5. **Deterministic app fault injection:** `tests/test_bnb410_recovery.py` exercises unapproved actions (including no DB access), schema gap, forbidden rollback, provider/backlog-style restore denial, no-eligible-replay, minimized telemetry, and a real PostgreSQL expired-lease scenario. Retained BNB-4.2 tests still cover competing workers, crash-after-consumer-commit, replay, poison payload and idempotency.

Changed application files: `services/420bnb/recovery_operations.py`, `services/420bnb/tests/test_bnb410_recovery.py`; documentation `docs/bnb/BNB-4.10-RECOVERY-RUNBOOK.md`. Retained migrator/outbox/production contract and original migration files were not changed. No new contract, ABI, Genesis/address or external RPC/Indexer/Search interfaces were changed.

## Exact-SHA CI

- Required [420BnB Runtime Slice **38486450706**](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38486450706), job **`115601452535`**: terminal **SUCCESS** on tested candidate `f6610e4ac87ef7a60b7c912aba07432cc47fd32e`, with source/tests identical to executable SHA `3afc9848311ee08dfecfa5615c1754cdf85cceef`.
- **8 migration/operations tests PASS + 297 app/API/security tests PASS = 305 passed, 0 failed**, plus retained PostgreSQL recovery/adversarial tests, browser accessibility, nonroot container and immutable web image, isolated restore, ingress/topology/TLS and deployment checks.
- Nine retained BNB workflows **9/9 SUCCESS** on the exact same candidate: BNB 1.1 `38486450436`, 1.2 `38486450661`, 1.3 `38486450626`, 1.4 `38486450490`, 1.5 `38486450540`, 1.6 `38486450511`, 1.7 `38486450464`, 1.8 `38486450389`, 1.9 `38486450710`.
- Previous executable-only Runtime Slice `38486291554` was cancelled by evidence-only PR update; **not credited**. Global Docs intentionally skipped at app-only Level 1, not green evidence. Unrelated workflows do not count as BNB app qualification.

## External gates and disposition

**T-BNB-OPS-214 and T-BNB-SECURITY-213 remain blocked**: production backup encryption and custody, verified real restore, actual multi-instance/node failure drills, live provider reconciliation, objective RTO/RPO observations, monitoring delivery/on-call operations, independent security audit and operator approval. This level does not deploy or execute a recovery controller, promote backups, automate destructive rollback or authorize real payments. Preserve all remaining testnet acceptance gates and `travel.bnb_booking=false`, `booking_enabled=false`, `financial_execution=false`.

BNB-4.10: **repository Level 1 COMPLETE**. BNB-4.7 M4-A Level 2 retained. BNB-4.11 M4-B Level 2 pending; Phase 4 Level 3 canonical Solidity/Genesis/Integrated/Docs/current-main reconciliation reserved for BNB-4.12, avoiding duplicated full Foundry inventory. PR #631 remains unmerged.

**Next canonical step: BNB-4.11 — M4-B end-to-end app milestone.** Certificate commit is evidence-only; no recursive executable requalification needed unless changed code/config/tests/requirements are later committed.
