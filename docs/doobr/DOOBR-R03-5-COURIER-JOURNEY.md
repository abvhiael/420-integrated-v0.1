# DOOBR R03.5 — Courier offers, navigation, custody and proof-of-delivery flow

**Status:** PENDING exact-SHA Level 1 workflow. PR #601, branch `roadmap/doobr-bc-vancouver-infrastructure`. Qualification: Level 1 at this step, retained client Level 2 at R03.12, Level 3 comprehensive reconciliation R05.10. Last known main before this step: `6d2932deb243328e1956619e10ef250a8bcc1d88`.

## Implementation and controls
- `doobr/courier_journey.py` adds a read-only, tenant-scoped, independently signed-session authorized view of courier offers and assigned journeys. Requires per-order courier permission and exact courier ID in offer/assignment queries; stale offered offers are denied, no assignment means no active journey unless a fresh owned offer is present.
- The view deliberately does **not** expose addresses, GPS, route endpoints, recipient identity, signatures or custody proofs; it directs clients to independently authorized navigation/custody interfaces.
- Existing `doobr/dispatch.py` holds serialized offer decision, expiry, capacity and independent eligibility; `doobr/tracking.py` gates private location permission and encrypted tracking; `doobr/custody.py` owns atomic proof, external verification, encryption and replay-safe order transitions. None is duplicated or bypassed by R03.5.
- Public `web/doobr/journey.mjs` refuses untrusted, forged offer/route/delivery evidence inputs. Accessible public site is explicitly non-operational and never collects private data.
- `doobr/storage/tests/test_courier_journey.py` covers owned/foreign offers, expiry, revocation, denied identifiers, privacy and read-only invariants; browser contract tests refuse forged proof and GPS. Scoped workflow `.github/workflows/doobr-r03-5-level1.yml` checks the exact commit and retained website and courier tests.

## Outstanding operations and qualification boundaries
This is an implemented non-operational courier journey read model and public-safe status interface, **not** a live authenticated courier mobile application. Live signed 420Identity issuer, deployment, location permission UX, navigation integration, authorized evidence submission and regulatory approvals are still required; they are not represented as passing or waived. No regulated dispatch, route disclosure, recipient proof ingestion or delivery can be initiated from the public site. The actual operational client integration and device adversarial acceptance are not satisfied by these mocked/unit-level checks; R03.8, R03.9 and R03.11–R03.12 retain client/device requirements. Final app-phase Level 3 qualification remains scheduled for R05.10, not run here.

**Next canonical step:** R03.6 — Retailer intake, dispatch and exception management.
