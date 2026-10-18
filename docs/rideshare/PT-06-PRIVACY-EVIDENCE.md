# LIFTd PT-06 — Privacy and evidence readiness

**Supplemental repository-only readiness package** for already qualified canonical L03.5 privacy/retention functionality. Does not renumber or replace L03.10 or independent deployed acceptance.

## Existing repository requirements
- `rideshare/src/privacy-retention.mjs`: durable access/export/deletion requests, privacy command idempotency, immutable event digests, subject-only exports, legal/incident/support/fraud/financial hold checks, one-way location tombstones, redacted aggregate telemetry and trusted retention sweeper.
- `rideshare/src/support-cases.mjs`: structured incident evidence handling, retention, appeals and access authority.
- `rideshare/test/postgres/privacy-retention.test.mjs`: actual PostgreSQL ledger/hold/retention regression; existing L03.5 and M-L03-A certificates preserved.

## Gap and remediation
Privacy authority admission previously accepted an unbound authorization object without confirming its returned action/resource, session/device/recovery identifier formats or integer expiry. PT-06 now checks requested verb and trip scope, current finite expiry, and session identifiers before any private-data access or irreversible action; the existing before/after session-change guard remains. New real-PostgreSQL negative tests deny wrong permission, cross-trip resource and malformed expiry without mutation.

## Level 1 ownership
Dedicated PT-06 workflow checks exact SHA, retains the whole app unit suite and executes the affected real PostgreSQL privacy test. No global Solidity, Genesis, Integrated, Geth or Docs reruns.

## Unaccepted external operations
Real privacy/legal authorization, deployed scheduled sweep, replica/backup/provider erasure, independent subject access/export audit, encrypted evidence vault, holds propagated across deployed consumers, time-bound SLAs and verified sanitization of live logs/telemetry remain **NOT ACCEPTED** under unchanged original L03.5 external-acceptance and TN-0–TN-6. Local tests are not release approval. The production service remains gated.
