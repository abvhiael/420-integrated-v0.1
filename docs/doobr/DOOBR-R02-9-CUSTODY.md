# DOOBR R02.9 — Packaging custody, pickup, recipient ID/name/signature and handoff evidence

Canonical R02.9. Branch `roadmap/doobr-bc-vancouver-infrastructure`; PR #601. Status: repository implementation awaiting exact-SHA Level 1.

`doobr/custody.py` requires independent signed R02.2 courier authorization for the specific order, current active assignment, legal state transition, package seal and verified retailer custody provenance, and externally approved regulated evidence. Recipient verified ID, name and signature are mandatory for delivery. A denied or unavailable verifier must prevent handoff. Proof references are encrypted using an injected authenticated encryption authority and persisted only as private `custody_evidence` records. R02.6 command idempotency digest includes proof references and ID of the encrypted evidence. The custody record, order CAS state change and order command receipt commit atomically under serializable PostgreSQL transaction, so any failure rolls back the whole operation. Matching command replays yield existing receipt; differing payload replays fail.

The preexisting canonical `custody_evidence` table is reused, with tenant-isolated forced row-level security and legal-hold/retention metadata. No public identity, signature, GPS or custody proof is published. Operator or consumer access to proof data is not established by this service. Tests cover rejected missing handoff proof, invalid retention, real PostgreSQL pickup/replay, evidence-denied handoff rollback and successful handoff receipt.

External ID verification, jurisdiction-approved packaging inspection, retailer digital signature authority, recipient identity matching and physical signed handoff remain **independently operated testnet/deployment integrations**, not capabilities proven by the injected CI simulators. The implementation cannot grant cannabis delivery permission. Future R02.10 handles failed/return custody; R02.11 outbox; R02.13 Level 2; R05.10 Level 3; R06 live acceptance. The handler currently covers successful pickup and successful handoff only.

Level 1 targeted workflow: `.github/workflows/doobr-r02-9-level1.yml`, exact implementation SHA plus Python tests, database migrations and forced RLS. Record run and job evidence after execution; an untriggered or queued workflow is not PASS.

Next canonical roadmap step after R02.9 qualification: **R02.10 — No-delivery, timeout, no-show, rejection and return.**
