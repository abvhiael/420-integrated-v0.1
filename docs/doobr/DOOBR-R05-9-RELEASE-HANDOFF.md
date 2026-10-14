# DOOBr R05.9 — Exact release documentation, testnet deferrals and deployment handoff

**Canonical step:** R05.9 Exact release documentation, explicit testnet deferrals and deployment handoff. **Classification:** Level 1 repository/documentation handoff only; this is **NOT** Level 3 release certification or deployment authorization. PR #601 stays OPEN and UNMERGED on `roadmap/doobr-bc-vancouver-infrastructure`. Inspection baseline `main` SHA `bc0faa5dafecda3de0620a9581f9953b89cd95fb`; branch ahead 400 and behind 1110. These are *inspection-time* values and MUST be rechecked at R05.10.

## Release status and exact-SHA rules

**Status: NON-OPERATIONAL, NOT RELEASE APPROVED.** Retained repository-side Level 1 R05.1–R05.8 and R04.11 Level 2 evidence exists under `docs/doobr`; none substitutes for independent external security, regulator, live identity/issuer, retailer, settlement, or site/device acceptance. R05.9's own scoped documentation CI must PASS before this document is considered repository-qualified.

R05.9 uses the exact implementation SHA of its qualification workflow; later **evidence-only** updates may cite that SHA without repeating CI. Any changes to code, executable tests, workflow, dependency, configuration, generated artifacts, interfaces, deploy state or substantive requirements require requalification. A successful branch SHA is **not** the R05.10 reconciled merge-candidate SHA.

## Source-of-truth package and ownership

| Component | Canonical owner / artifact | Boundary |
| --- | --- | --- |
| Step and closeout roadmap | `docs/doobr/DOOBR-R01-R06-ROADMAP.md` | R05.9 remains distinct from R05.10 |
| Frozen Genesis/Travel authority | `config/genesis-applications.json`; `config/genesis-consumer-services.json`; `config/420travel-genesis.json`; `docs/genesis-services/GEN-SVC-3-TRAVEL.md` | All seven Genesis Travel transaction methods remain disabled |
| Deferred acceptance | `docs/audit/DOOBR-TESTNET-DEFERRED-QUALIFICATION-ROADMAP.md` | DOOBR-AUDIT-9/10 are **NOT COMPLETE** |
| APIs and event interfaces | `docs/doobr/openapi-v1.yaml`; `docs/doobr/events-v1.json` | No inferred regulatory/payment authorization |
| Operational security | `docs/doobr/DOOBR-R05-8-SECURITY-INTAKE-RUNBOOKS.md` | Independent reviewer signoff OPEN |
| PostgreSQL/migration | `doobr/storage/migrations/`; `doobr/ops/backup_encrypted.sh`; `doobr/ops/restore_isolated.sh` | No destructive rollback in production |
| Site/Travel | `web/doobr/`, `web/travel/` | Informational only, no checkout, no private addresses/GPS |
| Mobile/browser | `mobile/doobr/`, `tests/browser/` | Real device and screen-reader acceptance OPEN |

420Identity/Verify/Registry own credential provenance; 420Compliance independently owns BC/Vancouver policy evidence; 420Location/Search own location/discovery; 420Pay and the canonical Dev Compensation Vault own payment/fee/settlement; Wallet owns consent; Notifications and Arbitration own their distinct canonical duties. **DOOBr consumes these services, never becomes their substitute.**

## Deployment handoff — required gated sequence

1. **Repository release freeze:** record exact branch HEAD, current `main`, PR/base merge conflicts, code/config/tests/dependency diff, frozen-address map, qualified implementation SHA and evidence SHA. Do not merge until R05.10 finishes.
2. **R05.10 once-only full Level 3:** reconcile PR #601 with current `main`, establish one exact merge-candidate SHA. Run canonical Solidity Contracts full Foundry inventory **once** (approximately four balanced shards where suitable), independent Genesis address-authority checks **without duplicate Foundry**, 420 Integrated/global, Docs/global reconciliation, retained DOOBr client/backend/PostgreSQL/browser/mobile/Indexer/Search/RPC and all applicable security/deployment checks. Verify every required job on that exact SHA; failed/missing/cancelled/skipped checks are not passing evidence.
3. **Locked infrastructure plan:** approved isolated staging/testnet with hardened ingress, secrets manager, authenticated canonical issuers, PostgreSQL/PostGIS schema owners versus RLS-limited application roles, audited migrations, backups, PITR, restore, rollback and monitoring. No production deployment assumption from mock contracts.
4. **Controlled deployment acceptance:** capture deployed image digests and exact source SHA, signed authority/provider URLs and credentials (redacted in evidence), versioned 420Compliance policy records, legal regulatory reviewer approval, authentic retailer/municipal carrier classification, approved 420Pay merchant finality, actual signed callbacks, safe service revocation/emergency stop and operational SRE evidence.
5. **Independent app security and privacy:** obtain signed assessor disposition with threats, retests and accepted residual risks; authenticated session-device revocation, cross-tenant penetration tests, GPS/address exfiltration, real iOS/Android device tests, VoiceOver/NVDA/TalkBack and accessibility approval.
6. **Release go/no-go:** DOOBR-AUDIT-9/10 and applicable R06 gates must be explicitly signed PASS on the exact deployed artifact before *any* operational promotion. No unilateral CI-based public-transaction activation. Record responsible owners, rollback authority, monitoring alerts and incident escalation contacts.

## Explicit outstanding acceptance register — NOT COMPLETE

- **DOOBR-AUDIT-9:** production-equivalent integrated live service security, canonical issuer endpoints/credentials, sign/revoke/expiry, 420Compliance/regulatory authorization, tenant-private authenticated API and PostgreSQL transaction/failover acceptance.
- **DOOBR-AUDIT-10:** independent regulatory/legal, retailer, insurer, privacy, security and operational go/no-go, including source/deploy SHA and release signing.
- **R06.1–R06.4:** real provider integrations, API/deployment infrastructure, service-to-service authentication and tested canonical contracts (not just injected mocks).
- **R06.5/R06.9:** BC/Vancouver retailer licensing, valid carrier classification, independent legal review and signed policy/municipality sources.
- **R06.3/R06.4:** independent 420Pay merchant/payment finality and Dev Vault conservation with real payment reversal/refund evidence.
- **R05.6 external acceptance:** actual multi-node deployment/failover, TLS, PITR/WAL recovery, encrypted restore and disaster recovery drills.
- **R05.7 external acceptance:** device trust/proof, secure mobile revocation, manual VoiceOver, NVDA, TalkBack and accessibility assessor approval.
- **R05.8 external acceptance:** signed independent security assessment and all high/critical findings resolved or dispositioned under approved policy.

## Stop/go and rollback decision

Default: **NO-GO**. Public DOOBr informational presence may remain available only while privacy-preserving and factually non-operational. Checkout, regulated order dispatch, settlement, private data disclosure, and seven frozen Genesis Travel transaction operations remain **disabled**. Any missing authority, unknown policy or revoked licence, uncertain settlement, failed invariant, unverified identity, incomplete security approval or inconsistent SHA means remain NO-GO. During incidents, use R05.8 procedures; never invoke `0001_initial.down.sql` on live data, perform unauthorized financial compensation, or publish exact location records.

## Evidence log

- R05.1–R05.8: repository-side qualified on individual exact implementation SHAs; cross-reference each corresponding `docs/doobr/DOOBR-R05-*-*.md`.
- R04.11: prior app Level 2 qualified at `870110aab72c65459ac1e3a99978e34e3b9b231e`; that is not a replacement for R05.10.
- R05.9: exact workflow implementation SHA and run/job outcome must be recorded **after** CI completes. No inferred completion.
- R05.10 and external approvals: **NOT STARTED / NOT COMPLETE** at this handoff.

**Next canonical step:** R05.10 Once-only full Level 3 exact-SHA repository qualification after main reconciliation.
