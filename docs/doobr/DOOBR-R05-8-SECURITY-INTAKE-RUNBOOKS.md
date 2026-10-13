# DOOBr R05.8 — Independent security intake and threat-to-evidence matrix

**Scope and ownership:** Canonical R05.8, repository-side Level 1 evidence intake, **not** an assertion that an independent external security assessor has accepted this system. PR #601 on `roadmap/doobr-bc-vancouver-infrastructure` stays open/unmerged. Inspected `main`: `bc0faa5dafecda3de0620a9581f9953b89cd95fb`, branch ahead 398/behind 1110. Review the full R01–R06 roadmap, R01.6 threat model, retained R05 step evidence, frozen Genesis/Travel authority map and `docs/audit/DOOBR-TESTNET-DEFERRED-QUALIFICATION-ROADMAP.md` before any release decision.

## Threat-to-evidence and mandatory signoff matrix

| Threat / boundary | Repository test or evidence | External independent acceptance required | Status |
| --- | --- | --- | --- |
| Identity impersonation, role escalation, tenant crossing | `test_r05_1_authorization_threats.py`; `test_auth.py`; `test_pg_auth.py` | Signed identity/session service, issuer revocation, real service-identity impersonation | Source-side qualified; external OPEN |
| Exact courier/recipient addresses, GPS/push leakage | `test_r05_2_privacy_retention.py`; `test_mobile_security.py`; `test_travel_card.py` | Penetration test of telemetry, logs, SDK clients, encryption, legal-hold and backup deletion | Source-side qualified; external OPEN |
| Concurrent offers, command replay, callback dupes, outages | `test_r05_3_chaos.py`; `test_pg_dispatch.py`; `test_pg_outbox.py` | Real multi-node PostgreSQL contention, leases, broker outage and partition recovery | Source-side qualified; external OPEN |
| Financial rollback, counterfeit payment, wrong Dev Vault | `test_r05_4_financial_finality.py`; `test_payment_conservation.py` | Canonical 420Pay settlement/reorg, Wallet consent, fund-flow and reconciliation signoff | Source-side qualified; external OPEN |
| Expired license, revoked policy, fail-open emergency stop | `test_r05_5_transition_authority.py`; provider/Compliance regression suites | Production independent credential issuer and 420Compliance signed policy/legal review, live stop propagation | Source-side qualified; external OPEN |
| Multi-instance split-brain, migration data loss, unsafe restore | R05.6 PostGIS migration/restore CI; `test_pg_operations.py` | Failover test, encrypted backup/PITR, restore drill, rollback SRE approval | Source-side qualified; external OPEN |
| Device credential compromise, accessibility denial | `test_mobile_security.py`; `doobr-r05-7.spec.mjs`; earlier Android/iOS build jobs | Real-device attestation and revocation, VoiceOver/NVDA/TalkBack specialist acceptance | Source-side qualified; external OPEN |
| Privilege or feature creep into frozen Genesis Travel/payment | `scripts/verify-doobr-r04-1.py`, read-only 420Travel projection and no-checkout browser regressions | Genesis independent authority qualification at exact Level 3 SHA | App-scoped guard; Level 3 OPEN |
| BC/Vancouver legal operation and provider status | R01.4 profile and Compliance contract, retailer/provider/transition tests | Independent counsel/regulator, signed production licensing and service trust | NON-OPERATIONAL; external OPEN |

## Independent reviewer intake — mandatory fields

An independent reviewer must supply reviewer identity/organization, independence/conflicts disclosure, precise target deployment and implementation SHA, dates/methodology, threat-by-threat findings with severity and reproducible evidence, affected paths/versions, exploit scope, remediation PR/SHA, retest run/jobs, residual risks, and signed decision **ACCEPT / REJECT / NEEDS_REMEDIATION**. Intake is **PENDING** until actual independent acceptance is attached; a repository document or CI success does not manufacture it.

**Admission:** reject any intake missing scoped SHA, method, evidence, reviewer independence or disposition. Never mark production/testnet gates passed merely from R05.8 document completeness.

## Operational security runbooks

### Compromised credentials or suspected unauthorized access
1. Disable regulated operations, public checkout and Travel transactions (these are already disabled); record incident ID and immutable start time.
2. Revoke implicated canonical identity/session/device grants and secrets at their owning services. Fail closed if authority unreachable.
3. Preserve signed event references, tenant-scoped operational audit, exact SHA, traces **without** exporting customer addresses/GPS.
4. Investigate tenant cross-access, invalidate active sessions, notify approved incident coordinator, and execute authorized credential rotation.
5. Require independent verification of restored trust and formal operations approval before re-enablement.

### License lapse, policy conflict, emergency stop
1. Stop dispatch/handoff transitions, and mark regional public presence UNKNOWN or UNAVAILABLE (never infer authorization).
2. Identify affected tenant, provider, municipality, signed policy version and active order revisions using private authorized tools only.
3. Consult canonical 420Compliance and Registry; deny unknown/expired/revoked/contradictory decisions.
4. Preserve sealed evidence and use authorized return/incident channels for pending orders; never self-issue a new licence or policy.
5. Resume only after current independent issuer approval and documented release signoff.

### Payment finality or conservation breach
1. Freeze new economic transitions; do not perform a local refund, escrow or corrective mint.
2. Record canonical 420Pay reference, receipt status, vault route, unique callback ID and exact conservation mismatch.
3. Alert canonical 420Pay/Dev Vault owners; quarantine callbacks/retries pending independently verified settlement/reorg/reversal.
4. Reconcile ledger and audit records under authorized operator access, preserve failed receipts, and document independent approval.
5. Restore only after explicit financial, security and operations approval.

### PII leak or deletion/legal-hold conflict
1. Disable affected data exports and public discovery; preserve scoped, minimal metadata and avoid redisclosing exposed records.
2. Rotate affected access credentials; contact privacy/security owners and assess statutory notification requirements.
3. Obtain canonical retention/legal-hold decision; do not erase under an active hold or before authorized retention expiry.
4. Verify encrypted backups, keys, copies and deletion audit; independently review remediation and release decision.

### Outbox outage, split brain or database corruption
1. Deny dispatch/regulated operations and isolate the affected tenant/worker set.
2. Stop conflicting workers; preserve outbox event IDs, current lease owners, attempts, dedup keys and immutable audit chain.
3. Review primary/replica state and replication lag; coordinate SRE-controlled failover, avoiding parallel primaries.
4. Restore **only to isolated empty recovery infrastructure** using verified encrypted backup and checksum; never use destructive `0001_initial.down.sql` on live data.
5. Verify migration checksum, forced RLS, audit integrity, delivery/outbox receipt consistency and recovery objective evidence before authorized controlled restart.

### Accessibility or device-security incident
1. Deny affected device access and revoke compromised sessions through canonical Identity.
2. Preserve device-independent audit references but never push addresses, GPS, identity proof or order data.
3. Reproduce using actual affected OS/device and independent screen reader, not emulator alone.
4. Record WCAG issue, keyboard-focus regression and severity; retest with disabled checkout enforced, release only after approval.

## Release gate and deferred qualifications

* DOOBr remains **NON-OPERATIONAL**: no live regulated orders, settlements or checkout; seven Genesis Travel transaction methods stay intentionally disabled.
* R05.8 may establish a review-ready **intake package**, but independent professional security review is **still OPEN** until actual third-party testing/signature.
* R05.9 carries exact documentation/deployment handoff. R05.10 is once-only exact merge-candidate Level 3 after main reconciliation, with Solidity full Foundry owned solely by Solidity Contracts; Genesis verifies address authority independently without duplicating Foundry; Integrated/Docs follow same SHA.
* Production testnet, statutory BC/Vancouver counsel/authorities, live canonical issuer credentials, real screen readers and PITR drills remain explicit external blockers.
