# BNB-2.12 — Compliance and Trust

Canonical scope: 420Compliance integration, accommodation licensing, jurisdiction restrictions, applicable age/identity rules, privacy and moderation.

**Status: PARTIAL / Level 1 NOT YET QUALIFIED.** This evidence is not a declaration of legal compliance, independently licensed accommodation or authorized age/identity acceptance.

## Repository-side implementation
- Existing BNB-2.10 independently signed 420Location property/place and jurisdiction policy ingestion, revision, expiry, revocation and private-location minimization are retained.
- New `020_compliance_eligibility.sql` records independent issuer-scoped, expiring accommodation decisions, licensing evidence reference, guest minimum-age policy, identity requirement, property-version binding, monotonic revision and revocation.
- `POST /v1/bnb/compliance/eligibility` requires `BNB_COMPLIANCE_AUTHORITY_*` RSA issuer/audience/public key; validates property identifier, independent location jurisdiction match, decision, revision, license reference, age bound, strict identity flag, and current property version. The new `/revoke` endpoint is signed and issuer-scoped.
- Authorized 420Travel accommodation publication now requires an *additional* current allowed compliance decision for exactly the current property version/jurisdiction, alongside the earlier signed Location binding and jurisdiction policy. Missing, expired, prohibited, revoked or version-stale eligibility excludes publication.
- `test_bnb212_compliance.py` adds negative tests for absent issuer, malformed claims and the filtered public projection. The BnB Runtime Slice now applies migration 020.
- Existing BnB independently moderated host/property media, review and abuse flows remain in force; personal/private addresses remain absent from the authorized Travel projection.

## Repository-side implementation and adversarial status

- Age and identity rules are enforced at protected booking request admission, using separately approved, purpose-scoped `BNB_GUEST_ELIGIBILITY_*` proofs. The verifier binds the guest identity, property ID, jurisdiction, verified minimum age and independently verified identity flag, without persisting birthdates or identification documents. An absent/invalid proof fails closed where age or identity verification is mandatory.
- A protected request requires the signed, current `BNB_COMPLIANCE_AUTHORITY_*` licensing decision, exact property version, active independently signed Location binding and jurisdiction policy. It rejects absent, expired, revoked, prohibited or stale authority. No actual booking/payment finality is asserted.
- All three ordinary public catalog routes—search, public listings and listing detail—require the same policy-bound publication constraints. 420Travel authorized listings and public verified-stay reputation also withhold unlicensed/revoked properties. Saved stay/history may remain accessible privately to account owners for record and dispute management, without restoring public publication.
- Existing independently signed review/media moderation, private messages and abuse dispositions remain intact from earlier BnB audit steps. Private addresses and guest identity evidence are not published.
- `test_bnb212_compliance.py` covers missing issuer configuration, invalid claim typing and jurisdiction, effective policy presence in authorized projections, live PostgreSQL expiry/revocation/prohibited jurisdiction/property version retraction, signed revision/replay/wrong issuer, verified guest age, and booking admission denial after revoked licence. The legacy booking lifecycle fixture is explicitly synthetic, CI-only; no acceptance claim or self-signed live approval is inferred.
- BnB Runtime Slice applies migration 020 and runs retained prior app API, PostgreSQL adversarial, accessibility and packaging tests. CI must PASS on the exact last executable SHA before Level 1 is complete.

## Remaining qualification and independent external authority

**Repository-side Level 1 remains pending exact-SHA CI.** Neither a queued CI run nor a prior implementation SHA certifies the final revision. Upon pass, record run/job evidence and mark repository-side implementation closed only for the implemented software boundary.

`T-BNB-COMPLIANCE-212` in the separate testnet work roadmap retains independent legal issuer authorization, actual 420Compliance regulatory publication/consumer deployment, legally verified accommodation licences and geographic rules, provider-issued guest age/identity proof, key custody/rotation, real policy and licence revocation, independent privacy/legal review, operational moderation/appeals and production-equivalent end-to-end testing. These cannot be simulated with repo-minted credentials.

**Level 2:** at a meaningful shared Compliance / Location / Travel app integration milestone if not already covered by the final same-SHA retained app suites. **Level 3:** one comprehensive accumulated app-phase reconciliation with current main, using canonical Solidity and Genesis owners without duplication. PR #600 remains draft/unmerged; do not infer merge qualification.

## Authority and release boundary
Never turn verified property identity into proof of an accommodation license or verified guest age. BnB's public Travel listing gate is conservative. The rest of the app must remain transaction-disabled until official Pay/Identity/property/Compliance releases are independently qualified.
