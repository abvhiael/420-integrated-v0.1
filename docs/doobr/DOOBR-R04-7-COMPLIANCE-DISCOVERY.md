# DOOBr R04.7 — 420Compliance and public discovery projection

**Canonical step:** 420Compliance policy decision, evidence/revocation adapter; 420Location/Search and Travel/Maps read-only projection integration. PR #601, branch `roadmap/doobr-bc-vancouver-infrastructure`. Current main/base at inspection `bc0faa5dafecda3de0620a9581f9953b89cd95fb`; audit branch then 357 commits ahead and 1110 behind. App-scoped Level 1, not R04.11 Level 2 or R05.10 Level 3.

## Implemented and verified boundaries

`doobr/compliance_discovery_adapter.py` accepts a **canonical independently verified** Compliance policy decision, binds exact tenant/provider/municipality, positive ALLOW decision, approved issuer, policy version, decision/evidence identifiers, nonrevocation and a bounded live time interval. Independently rechecks decision revocation and authoritative evidence. Invalid, denied, expired, revoked, contradictory or unavailable Compliance states fail closed. DOOBr has no local policy decision/override or legal release authority.

Public `read_only_region` checks canonical Location public-region validity and canonical Search discovery permission, retrieves a canonical coarse record, then reuses the R03.10 signed presence, privacy threshold, freshness and strict six-field public allowlist. Detailed GPS, addresses, actor/courier identities and arbitrary extra fields are rejected. 420Travel/Maps consume a privacy-safe informational status only: no checkout, booking, private address, courier positions, or payment activation. This does not constitute an authenticated production deployment of the shared 420Compliance or 420Location/Search interfaces, and live legal/licensing approvals remain independent.

Files: `doobr/compliance_discovery_adapter.py`, `doobr/storage/tests/test_compliance_discovery_adapter.py`, `.github/workflows/doobr-r04-7-level1.yml`. Unit tests cover allowed/denied policy, cross-region/provider/tenant scope, expiry, evidence and revocation denial, outages, privacy-injection, region mismatch and negative Location/Search decisions. CI also retains `test_travel_card.py` and R04.1 frozen authority guard, with exact-SHA before/after.

**Implementation SHA:** `a5fbe45ced3957e7cb20cf03c3a6b0cc021e5479`. **Qualification PENDING** until inspected exact-SHA targeted CI PASS. Independent canonical signatures, issuer trust roots/key rotation, service-to-service authentication, deployed Travel/Maps data pipelines, legal/operational releases and audit steps DOOBR-AUDIT-9/10 remain deferred. No new Solidity/Genesis authority and no global suites required here.

**Next canonical step:** R04.8 Notifications and Arbitration routing.
