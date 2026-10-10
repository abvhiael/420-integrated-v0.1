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

## Policy, media, browser and timezone hardening

- New `006_host_policy_media.sql` stores host-authored rules/cancellation policy and IANA timezone identifiers, plus private media URL, accessible alt text, rights statement, and moderation state (initially **pending**, never self-approved).
- New owner-only endpoints `PUT /v1/bnb/account/properties/{id}/policy` and `POST /v1/bnb/account/properties/{id}/media` require active signed local session, draft-only row locking, expected version, rights/HTTPS validation and audit trail.
- Publication review snapshot freezes any submitted policy and count of already independently approved media. Incomplete review submissions remain pending and **cannot** publish.
- Calendar accepts canonical UTC instants or appropriately offset timezone-local timestamps; any non-UTC offset inconsistent with the property's IANA zone is rejected. Date-only, DST ambiguity and full local-day allocation semantics remain open.
- Targeted CI now installs Chromium/Playwright to smoke-test responsive host page, semantic controls, anonymous fail-closed buttons and visible status. This is **not** complete WCAG 2.2 AA automated/manual acceptance or full authenticated browser journey.
- New PostgreSQL adversarial cases cover invalid IANA zone, unsafe media URL, pending moderation, stale versions, no-auth changes and wrong time-zone offset.

**Still not accepted:** full accessible host media/policy editing UI; approved media processing, copyright provenance and moderation operator; complete Playwright authenticated host journey/axe-based audit; unit-capacity calendar allocation under overlapping quantity reservations and multi-instance races; policy-change semantics for already accepted booking snapshots; live independent issuer and property/host approval. Those require additional implementation/qualification; do not label BNB-2.2 COMPLETE.

## Moderator and concurrency hardening (2026-10-10)

The private `/v1/bnb/internal/media/{media_id}/decision` endpoint now requires a purpose-bound signed independent reviewer credential through `BNB_MEDIA_REVIEW_*` trust configuration, verifies exact media and decision scope, requires valid transitions, and uses `007_media_review_nonce.sql` for single-use issuer JTI. Without provisioned external reviewer authority, all approvals fail closed (HTTP 503). This adapter is **not** evidence that a reviewer has been legally/governance approved or operationally provisioned.

The targeted browser check has been expanded from Chromium smoke to responsive mobile/desktop axe-core `wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa` violation assertions, in addition to basic keyboard, form and anonymous-state checks. This does not replace manual screen-reader, browser interoperability, or authenticated workflow acceptance.

A new shared-PostgreSQL concurrency test races **eight independent TestClient instances** for one inventory slot and verifies one success/seven capacity denials. It is still in-process integration—not two separately deployed service processes or a full multiple-unit reservation allocator. Live multi-instance/provider authority remains assigned to `BNB-TESTNET-WORK-ROADMAP.md`. No work here enables guest booking finality, payments or publication.

**Qualification:** app-specific Level 1 exact-SHA CI pending. Do not describe these new tests as green before the reported run completes.

## True multiprocess and unit allocation iteration

- `008_unit_hold_allocation.sql` adds a unit-scoped hold reference, preserving the old no-unit schema for legacy properties. New unit-configured properties require explicit unit selection. Capacity is checked under the shared property row lock against overlapping holds for that exact unit. Other units remain independently allocatable; legacy properties retain conservative property-wide capacity semantics.
- Two independently launched Uvicorn OS processes use the same PostgreSQL instance; the adversarial test concurrently sends eight real HTTP requests for one slot and expects one admission and seven conflicts. This is a **local multi-process integration test** and not deployed testnet acceptance.
- Additional tests cover unit selection, isolated unit capacity, overbooking refusal and persisted per-unit allocated quantities. No actual payment finality or canonical confirmed booking lifecycle is enabled.

**External/manual acceptance remains outstanding:** operational moderation approval requires authorized reviewer identity, governance decision, signing/key custody and independently retained review trails. CI cannot issue its own authorization. Human WCAG 2.2 AA testing requires keyboard, screen-reader, and representative assistive technologies on supported browsers, with qualified human reviewer evidence and defect closure. Automated axe/Playwright does **not** substitute for that acceptance. Full production-equivalent booking/payment integration remains in the testnet roadmap.

**Qualification status:** targeted exact-implementation-SHA GitHub runtime acceptance required; do not claim this iteration complete on a queued check.

## BNB-2.2 repository-level closeout and external handoff

**Qualified implementation SHA:** `70f6dacd41a2582bd26bc8ea0d78aa543b2f4200` (targeted 420BnB runtime run [38082344067](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38082344067): SUCCESS). Earlier multiprocess/unit allocation run [38078123432](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38078123432) also passed. This entry and the testnet roadmap change are evidence/documentation only; do not treat them as new executable qualification.

**Repository-side BNB-2.2:** local host/property draft, unit inventory, calendar blocks, policy/media pending review, reviewer signed-adapter fail-close, quantity-scoped hold allocation, two-Uvicorn-process PostgreSQL contention, and automated Chromium/axe mobile/desktop checks qualified to the stated test coverage. Automated passing evidence does **not** prove legal publication, full guest booking finality, independent review or human WCAG 2.2 AA accessibility.

**Explicitly deferred to testnet roadmap:**
- `T-BNB-MEDIA-1`: independent real moderator approval, governance/operator credentials, managed signing keys, issuance, revocation, appeals, live signed decision evidence.
- `T-BNB-ACCESSIBILITY-1`: real qualified human screen-reader, keyboard, supported-device/browser matrix and dated independent acceptance.

These two requirements are not waived. BNB-2.2 can proceed as **repository-side Level 1 PASS / live operational acceptance DEFERRED**, not an unrestricted release. Payment, booking finality and self-publication remain disabled. No Level 2 or Level 3 broad rerun at this ordinary step.

**Next roadmap:** inspect exact canonical BNB-2.3 definition before renumbering/implementing; prior BNB-2.1/2.2 handoff files do not establish that step's authoritative scope.
