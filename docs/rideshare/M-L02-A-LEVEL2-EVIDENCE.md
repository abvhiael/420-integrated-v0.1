# LIFTd M-L02-A — Level 2 Integration Qualification Certificate

**Milestone:** M-L02-A — qualify rider booking journeys and driver onboarding with the backend, including expired sessions, revoked eligibility, inaccessible locations and quote changes.

**Disposition:** **COMPLETE — Level 2 PASS** (repository app-integration scope).  
**Exact qualified executable implementation SHA:** `596bcfc329555916e26f42a50702481b0f348193`  
**Pre-milestone development base:** `ccb9841306382a9d22cf0a733f7514f6fff6ded0` (L02.6 evidence branch HEAD).  
**Current main at review:** `eeaa4e593e8f5f16e2bc566b20ddbe04576589c1` (qualification branch 536 commits behind, 195 ahead when inspected; Level 3 reconciliation required).  
**Qualification branch:** `qualification/liftd-m-l02-a-level2-20261014`  
**PR:** [#656](https://github.com/abvhiael/420-integrated-v0.1/pull/656) — draft/open/unmerged.  
**Date:** 2026-10-14.

## Mandatory exact-SHA Level 2 evidence

- Dedicated owner workflow: **LIFTd M-L02-A Level 2**.
- Authoritative [GitHub Actions run #38654899486](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38654899486): **completed, success**.
- Integration job **#116162221907**: **completed, success**, no failed steps.
- Workflow performs explicit exact-head assertion with Node 22, isolated real PostgreSQL 16, locked npm install, Go Location/privacy consumers, foundation verifier, source syntax/static checks, complete retained rider browser tests, cross-component booking/onboarding adverse-path tests, prior L01 domain/security suites, actual PostgreSQL onboarding/preferences/dispatch, authoritative quote consent/trip lifecycle, actual payment and safety tests, and an exact-SHA artifact.
- Superseded first candidate run [#38654745422](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38654745422) **failed** in new cross-client negative regression, revealing a real frontend trip-snapshot scope bug. Do not cite that run as green. Root cause: the trip view accepted an authenticated response for a different requested trip ID. Fixed in `rideshare/web/trip-experience-controller.mjs` and verified against the final SHA; new assertion added in `rideshare/test/integration/l02-rider-onboarding.test.mjs`.

## Scope and security disposition

- **Rider booking:** protected pickup/destination flow, permission denied and inaccessible geocoding fail closed without invented coordinates/routes; scoped L01 Location contract; no authority-free route estimates.
- **Quotes and consent:** immutable server fare/CAD/cancellation terms, explicit consent, quote expiry, altered fare rejection, stable command IDs and authenticated trip creation; actual PostgreSQL quote, consent and lifecycle integration is retained.
- **Rider trip:** assignment/arrival/progress must be read from authorized server trip state; cross-rider and cross-trip responses are denied; cancellation and incident reporting remain scoped to canonical L01 transition/safety owners.
- **Driver onboarding:** private receipt verifier required before document submission, driver/reviewer permission separation, independently bound transport decision, remediation/revocation gates and private projection redaction; real PostgreSQL 16 enforces revisions, concurrency, replay history and recovery.
- **Sessions:** retained signed-session verification/revocation/expiry security tests remain mandatory alongside milestone checks; frontend cannot grant privilege or independently infer expired/revoked session acceptance.
- **Transport eligibility:** L01 retained eligibility/dispatch tests verify distinct driver, vehicle and independent transport proof binding; production/official credential issuers are not instantiated by test fixtures. A submitted driver is never automatically licensed or admitted.
- **Payments:** rider request or trip completion is not proof of payment finality; existing L01 Pay/safety suites remain canonical.

## Files introduced or corrected

- `rideshare/test/integration/l02-rider-onboarding.test.mjs`: integrated route->quote->consent->trip, invalid location, changed/expired fare, authenticated trip response isolation, expired and forged onboarding/reviewer proofs.
- `rideshare/web/trip-experience-controller.mjs`: reject a backend snapshot whose trip identifier does not equal the requested trip identifier.
- `.github/workflows/liftd-m-l02-a-level2.yml`: exact-SHA retained app Level 2 PostgreSQL/Node/Go integration workflow.
- `docs/rideshare/LIFTD-ROADMAP.md`: canonical milestone tracking.
- This certificate records evidence and deferrals.

## Deferrals and no-drift constraints

**Level 2 qualifies code-level integration** against approved test fixtures and real isolated PostgreSQL. It does not prove production deployed Identity session issuers, official passenger-transport licensing/Registry approvals, production encrypted document vault, operational payments, real-time geocoding/search and vehicle availability, independently accepted contact/messaging, independent assistive-technology/mobile acceptance or licensed Vancouver operations. These remain separately gated by their owning integrations/testnet roadmap. In particular, L02.5's scoped contact remains deliberately fail-closed pending approved messaging; the prior roadmap's L02.5 administrative Level 1 evidence/status should be reconciled separately and is not silently certified by this milestone.

**Level 3:** run only at completion of Phase L02 after current-main reconciliation, with canonical full Solidity Foundry *once*, independent Genesis address-authority inventory, Integrated, Docs, and affected services/SDK/Indexer/Search/RPC and adversarial/security suites on **one** exact merge-candidate SHA. No Level 3 global workflow was deliberately dispatched for M-L02-A.

**Evidence-only rule:** any post-qualified commits altering only this certificate or roadmap disposition inherit executable SHA `596bcfc329555916e26f42a50702481b0f348193`. Changes to executable source, tests, CI/config, dependencies, artifacts or substantive requirements require requalification.

**Next canonical step:** no subsequent L02 number is yet defined in the inspected roadmap; establish exact scope from repository authority before beginning the next ordinary step.
