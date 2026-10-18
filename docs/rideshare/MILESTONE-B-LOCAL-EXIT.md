# LIFTd — Milestone B local exit assessment

**Scope:** The requested supplemental Milestone B exit is strictly *repository-local*, not canonical `M-L03-B`. Canonical M-L03-B requires accepted deployed testnet and operational controls and remains PLANNED / NOT ACCEPTED.

## Required local exit matrix
| Requirement | Current repository control / evidence |
| --- | --- |
| Pilot admission disabled | `pilot-configuration.mjs` default disabled, zero capacity and never returns admitted=true; `deployment-security.mjs` rejects enabled public dispatch, payment or passenger traffic |
| Exact geography / eligibility | `eligibility.mjs`, `pilot-configuration.mjs`, retained PT-04 and PT-07 negatives; Vancouver municipality, BC, Canada only, no YVR/cross-boundary pilot |
| Safety and monitoring | `operational-safety.mjs`, `safe-gates-execution.mjs`, `pilot-configuration.mjs`; staffed duty, stop and operator escalation fail-closed, negative regression |
| Durable recovery | `reliability.mjs` and actual isolated PostgreSQL recovery tests; lease reclaim, fencing, dead-letter and least-privileged role |
| Backup / restore and protected evidence | `test-backup-restore.sh`, `operational-recovery.mjs`; seeded PG restore/migration integrity, protected audit/hold digest validation, bounded rollback |
| Independent approval not fabricated | All deployment/independent acceptance remains NOT ACCEPTED in `LIFTD-TESTNET-ROADMAP.md`, `L03.9` and `L03.11`; no public pilot authorization |

## Level 2 ownership
Retained LIFTd application suite, PostgreSQL durable-worker tests, PostgreSQL privacy/evidence tests, real isolated dump/restore, and new cross-control denial tests, all on the same exact SHA. This is a *local milestone integration certificate only*, not a global Level 3 and **does not** close canonical M-L03-B.

## External gates
Live pilot, independent safety, identity/transport/insurance/jurisdiction acceptance, production audit and RTO/RPO recovery, deployed vault/backup provider, and independent signoff belong to existing TN-0–TN-6 and remain **NOT ACCEPTED**. A successful local milestone cannot authorize public service.
