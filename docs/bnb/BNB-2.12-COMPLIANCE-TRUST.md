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

## Not yet satisfied
- Link the age/identity rules to externally attested **guest** eligibility, without treating a self-declared age as verified, and enforce those rules consistently for every applicable reservation/booking and public access pathway.
- Complete legal policy scope and license decision revocation/expiry adversarial tests with PostgreSQL, changing property controllers, outdated claims, and concurrent rule changes.
- Establish verified 420Compliance consumer/source contract and demonstrate exact policy version provenance; the repository-side signed ingress is not itself live 420Compliance service deployment.
- Verify targeted CI and record exact-SHA Level 1 evidence. Additional Level 2 app integration only at a justified shared milestone.
- Independently administered legal/licensing authorities and production-equivalent testnet acceptance require genuine external signoff; document these separately.

## Authority and release boundary
Never turn verified property identity into proof of an accommodation license or verified guest age. BnB's public Travel listing gate is conservative. The rest of the app must remain transaction-disabled until official Pay/Identity/property/Compliance releases are independently qualified.
