# DOOBR R02.10 — No-delivery, timeouts, no-show, rejection and carrier-specific returns

Canonical definition: R02.10 No-delivery, timeouts, no-show, rejection, same-day or other carrier-specific return workflows. PR #601; branch `roadmap/doobr-bc-vancouver-infrastructure`.

Repository implementation: `doobr/returns.py`, migration `0009_return_cases.up.sql`, negative tests `test_returns.py`, restricted-role PostgreSQL integration `test_pg_returns.py`, and exact-SHA workflow `doobr-r02-10-level1.yml`.

The handler recognizes verified reasons NO_SHOW, RECIPIENT_REJECTED, ID_FAILED, TIMEOUT, UNSAFE_HANDOFF, OTHER_VERIFIED. A courier can record failed handoff only while HANDOFF_PENDING; a signed OPERATOR then orders RETURN_REQUIRED, an assigned courier submits verified return custody, and OPERATOR approves RECONCILED after proof verification. Carrier-specific policy_ref and deadline_at persist with the immutable case metadata; after deadline, physical return requires independent approved escalation, not silent expiry. Each mutation uses R02.2 signed exact-order role grants, active courier assignment, independent authority approval, serializable CAS, canonical R02.6 command digest/idempotency, encrypted return event evidence and forced tenant-isolated PostgreSQL RLS. No identity details or proof material enter public views. Reject/unknown evidence must roll back the entire transaction.

Exact-SHA tests: Python compilation/negative inputs, all 0001–0009 migrations, forced-RLS verification and actual PostgreSQL no-show through return and reconciliation, command replay, conflicting evidence, rejected authority rollback. Workflow PASS must be observed before claiming Level 1 qualified; no repository-wide Foundry or Genesis sweep is needed for this Python/storage-only step.

Known operational limitations: the carrier's authoritative same-day deadline, independent recipient absence/rejection proof, return authorization, regulator approval, physical custody and retailer receiving acknowledgments remain external acceptance work at R06/testnet. The code cannot independently prove an actual same-day return or enforce real-world courier navigation. R02.11 addresses the outbox. R02.13 is app Level 2; R05.10 is Level 3 closeout. No monolithic merge yet.

Next canonical R02.11 — Events/outbox, notifications and integration consistency.
