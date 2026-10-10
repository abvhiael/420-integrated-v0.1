# BNB-2.2 — Host and Property Management implementation review

**Status:** IN PROGRESS / PARTIAL; Level 1 acceptance pending exact-SHA CI and remaining canonical host/property requirements. This record does not supersede the BNB-1.3 domain contract or authorize live publication.

## Canonical source alignment

- BNB-1.3 domain model: HostProfile, Property, PropertyDelegation, RentalUnit, ListingRevision, AvailabilityBlock, RatePlan, privacy, revisions, auditable mutations, and ownership/issuer separation.
- BNB-1.7 host journey: independently verified onboarding, draft editor/gallery/policy, publication review, calendar with DST, booking queue, payout read-only, scoped delegation.
- BNB-2.1 security closeout: signed Identity/session, independent property claims remain **pending** until reviewed, actor headers never grant permissions, and production issuer acceptance is handed to `BNB-TESTNET-WORK-ROADMAP.md`.

## This implementation slice

- Authenticated host can create a **draft** without self-asserting independent verification.
- Host can list only their own property drafts/records using coarse public-region metadata, never the private address.
- Host may edit only an owned **draft** under a PostgreSQL row lock and explicit expected version. Updates increment the version and produce an audit record.
- Draft intake does not publish, pay, create a binding booking, or grant property management capabilities.
- Tests exercise unauthorized header injection, stale version replay, ownership mismatch, state-change denial, read redaction, and transactional persistence.
- Property manager grant/revoke endpoints verify the acting owner, independently reviewed current property claim, active grantee, bounded capability and expiration, with audited mutation and no financial powers; negative API tests assert unverified owners cannot grant or revoke.

## Remaining BNB-2.2 exit work — not yet accepted

- Versioned listing snapshots and publication-review lifecycle beyond local draft revisions.
- Independently approved host, property title/licence/authority proof and review; external-live acceptance remains in T-BNB-PROPERTY-1.
- Manager grant/revocation API is implemented but fails closed unless an independently reviewed, unexpired property claim exists. Invitation/consent, expiry/revocation races, self-service manager UX and end-to-end acceptance remain outstanding; no unilateral financial authority.
- Unit-specific inventory, calendar/timezone/DST-safe host blocks, optimistic conflict checks and multi-instance races.
- Host onboarding forms, media/rights, listings dashboard, browser accessibility and complete journey BNB-U10–U12.
- Explicit state/event/audit retention and property transfer/dispute procedures.
- Complete adversarial permission coverage and exact implementation SHA app-runtime CI.
- App-scoped Level 2 only at the canonical meaningful integration milestone; no Level 3 repository suite now.

These requirements are not waived by the earlier BNB-2.1 Level 1 PASS and cannot be marked complete merely by BnB runtime green. Restricted publication and financial operations remain fail-closed.
