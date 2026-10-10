# DOOBR R01.8 — Architecture decision lock and Level 2 qualification
Status: PENDING exact-SHA Level 2. PR #601 `roadmap/doobr-bc-vancouver-infrastructure`; main at milestone start `c5a4f220d1fbda01f707d359aa9bb32921a138b1`.
Canonical R01.8: **Architecture decision lock and Level 2 milestone qualification**. This is a qualified architecture baseline, not an operational delivery application.

## Prior qualification reconciliation
R01.1–R01.6 prior exact-SHA Level 1 recorded in their original documents and protected by retained test assertions. R01.7: both [run 38026097611](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38026097611) and [38026099727](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38026099727) PASS at `f6db961c4b11c1238bf0f8eb87e0d1daa402d392`. Later prior-to-R01.8 HEAD `20752dcf4a6992882544a3d104d5ad0d78997ec7` changes the roadmap only with the C01.4 Compliance shared-authority amendment: it changes substantive coordination requirements, so **R01.8 Level 2 must qualify the resulting accumulated exact candidate**, not inherit R01.7 CI alone.

## Locked architecture decisions and interface baseline
- **ADR-01 Product scope:** standalone post-Genesis replaceable application; product development permitted, live regulated dispatch and transfers NOT AUTHORIZED; no Genesis frozen-catalog addition.
- **ADR-02 Jurisdiction:** Vancouver-first BC profile used as review material only. Signed, effective, revocable legal decisions owned exclusively by separately developed **420Compliance** (C01.4 amendment). No DOOBR-authored parallel policy pack, no self-approved municipal override.
- **ADR-03 Carrier models:** `LICENSEE_EMPLOYEE`, `DELIVERY_PERSON`, `COMMON_CARRIER` separated. Regulatory values (hours/quantity/retention/returns) are subject to Compliance source-version/legal review; cannot be enabled by copying unapproved literals.
- **ADR-04 Credentials:** canonical Identity/Verify/Registry and independently authorized legal credential issuers; role-scoped, expiring, revocable and tenant-bound; no local trust minting.
- **ADR-05 Financial:** 420Pay owns canonical settlement, no DOOBR custody. `DevelopmentCompensationVault420` gets only authorized eligible net protocol revenue at an approved rate, with exact-revenue replay protection; no gross cannabis sale skim.
- **ADR-06 Discovery:** 420Travel/Maps and Search only sanitized coarse privacy-threshold presence and approved deep link; no courier GPS, personal addresses, retail order, checkout or dispatch authority.
- **ADR-07 API:** R01.7 `openapi-v1.yaml` OpenAPI 3.1 contract is design-only; public presence strict allowlist, authenticated order routes cannot execute until independently approved. HTTP errors fail closed; unknown/expired policy -> UNKNOWN public status / DENY private dispatch.
- **ADR-08 Events:** R01.7 `events-v1.json` at-least-once outbox and deduplicated consumers; aggregate ordering/idempotency, no fake exactly-once transport promise.
- **ADR-09 UX/mobile:** approved DOOBR logo source must be preserved; accessible web, separate consumer/courier workflows and native iOS/Android strategy; native device location security and App Store eligibility gated.
- **ADR-10 Privacy/security:** R01.6 SEC-01–SEC-20 traceability and R01.3/R01.5/R01.7 negative-case inventories; encrypted off-chain sensitive personal/regulatory data, restricted custody and safe-return exceptions.
- **ADR-11 Governance:** no permanent service namespace, contract grant, deployment address or fiat/crypto transaction rail implied without external approval; disabled Genesis Travel gateway remains fail closed.
- **ADR-12 Deployment:** Level 2 is architecture-only. R02–R05 must implement code and executable runtime tests; R05.10 Level 3 once, R06 live/testnet gates, original DOOBR-AUDIT-9/10 not complete.

## Cross-component acceptance matrix
| Interface | Canonical evidence | Level 2 verification | Later runtime owner |
| --- | --- | --- | --- |
| Genesis / Travel | Frozen app catalog + disabled compatibility gateway | Real config validator + scoped Go compatibility regression | R03.10/R04.7 |
| Compliance | R01.4 contract + C01.4 roadmap amendment | Contract/authority consistency and fail-closed design assertions | R04.7 / R06.4 |
| Consumer, courier, retailer, operator | R01.3 roles and lifecycle | Retained role/journey/abuse traceability | R02/R03/R05 |
| Privacy/GPS/custody | R01.6 threats | Retained SEC-01..20 coverage and no public PII schema | R02.8/R05 |
| API/Events | OpenAPI 3.1 + event schema | Parse, semantic checks and schema/public-field negative assertions | R02.6/R03/R05 |
| Payment/vault | 420Pay and canonical DevComp V1 policy | Source/authority and no-gross-fee structural checks | R04.4/R04.9 |
| Mobile/website | R01.7 UI architecture and official logo | Baseline decision checks | R03 |

## Level 2 qualification required
Run one retained **DOOBR R01 Level 2** workflow at the exact R01.8 candidate, independently of the step's Level 1: Python schema compilation/validation and decision assertions, retained R01.1–R01.7 verifier, `verify-doobr-audit-2.py`, `verify-doobr-audit-5.py`, `verify-doobr-audit-6.py`, `verify-doobr-audit-8.py`, `validate-gen-svc-3.py`, targeted `go test -count=1 ./genesis/svc3/travelapp -run 'TestGenesisCompatibilitySchemas|TestGenesisTransactionMethodsAlwaysDisabled|TestDOOBRAudit3|TestDOOBRAudit7'`, scoped `go vet` / `go build` on Travel where affected. No global Foundry/Geth/Docs suite. A pass is required and must record workflow ID, exact SHA and fail-safe coverage, not implied by previous Level 1.

## Exit and deferred obligations
Lock means **architecture design frozen for R02 handoff, not immutable canonical governance and not regulatory approval**. Changes affecting policy/authorities/contracts after this decision require versioned amendment and impacted requalification. Independent Compliance implementation and acceptance, licenses/insurance/partner contracts, signed policies, real 420Pay/Wallet/Identity/Verify integrations, actual mobile/web/browser/device tests and runtime dispatch remain unimplemented or externally gated. Level 3 R05.10, DOOBR-AUDIT-9/10 and R06 release gate remain outstanding.
Next: **R02.1 Postgres/PostGIS schema, migrations, tenant isolation, encryption/retention.**
