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

## Implementation extension — 2026-10-10

Implementation SHA: `968137add514b82af193920b62570b108d97ae4b` (targeted qualification pending).

- Migration `005_host_management.sql`: versioned host unit quantity, immutable review snapshot/hash with one pending request per property, unit-scoped calendar blocks and owner audit provenance.
- Unit intake and private list APIs enforce owner session, draft state, property lock, expected-version CAS and aggregate capacity ceiling. Property capacity edits cannot drop below configured units.
- Calendar API adds unit-scoped blocking, overlapping block and outstanding hold denial, private host readback and version-checked block removal. Existing unscoped property blocks conservatively remain global.
- Publication review submission requires full unit quantity reconciliation, takes a frozen property/unit JSON snapshot with SHA-256, records pending state, and never self-approves or changes property to published. Owner may withdraw a still-pending review.
- Host web UI provides memory-only bearer session verification, private draft intake, listing and unit/review readback, accessible status messages, never payment or publication controls.
- Expanded PostgreSQL API tests cover capacity, stale revision, block overlap, review replay, nonpublication, owner-only access, withdrawal and block removal. Workflow applies new migration on Postgres 16.

**Qualification state:** LEVEL 1 PENDING. CI queued/not yet verified at this record's creation; documentation is not a PASS. No Level 2/Level 3 rerun.

**Unresolved host-management requirements:** full independent publication-reviewer issuance/approval and live revocation are testnet/external-governance work. Remaining repository-side scope includes an end-to-end accessible unit/calendar editor and listing media/policy editor, media rights and moderation acceptance, robust timezone/DST modeling, complete multi-unit quantity allocation for guest booking, actual cross-instance concurrent admission/property ownership transfers, grant-consent/expiry end-to-end and broader browser/adversarial acceptance. Publication, financial operations and booking confirmation remain disabled. BNB-2.2 cannot be declared complete until required repository-side exit criteria pass as well.

### Host UI and syntax qualification addendum

The host dashboard now includes an authenticated draft unit form, request-independent-review action, and an owner-scoped calendar-block form. The client sends source-issued Identity bearer credentials only from transient memory, uses `credentials:"omit"`, and does not store credentials in localStorage/cookies. Input and errors remain visible through semantic labels and live status updates. This is not an independently approved Identity login experience and does not satisfy full WCAG/browser testing.

The targeted BnB runtime workflow now executes a JavaScript syntax check on the inline host script. Full Playwright/browser interaction, host media upload rights, published listing policies, multi-instance property management, timezone ID + DST policies, and approved independent reviewer integration remain unqualified. No publication, settlement or guest booking privilege is introduced.
