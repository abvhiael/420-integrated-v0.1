# BNB-1.7 — Guest and Host Experience Architecture

**Status:** Normative UX/product architecture, not deployed client or enabled transaction flow. **Dependencies:** BNB-1.2 journey IDs J01–J16, BNB-1.3 states, BNB-1.4 authorities, BNB-1.5 finance, BNB-1.6 /v1/bnb APIs. **Next canonical step:** BNB-1.8 — Security, Privacy and Abuse Architecture.

## Product surfaces and navigation

**Guest:** Search → Map/List → Listing Details → Saved/Compare → Quote → Booking request/Instant eligibility → Payment approval (when enabled) → Reservation Details → Cancellation/Refund → Dispute → Verified-stay Review. Journey from 420Travel preserves destination/filter parameters, not implied inventory confirmation. Anonymous browsing uses public coarse location only; authenticated actions require verified, tenant-scoped sessions.

**Host:** Host Onboarding/Controller Verification → Property Draft → Listing Editor/Gallery/Policy → Publication Review → Calendar and Availability → Booking Request Queue → Reservation Detail → Pay-derived Payout Status → Disputes/Reviews → Property-Scoped Delegation. A manager can act only within property-specific, revocable capabilities; hosting permission never implies payout controller authority.

**Moderator/support:** Restricted case inbox, reason-coded content decisions, appeal records and redacted audit timeline. Moderation and customer support do not override reservation capacity or canonical financial finality.

## Guest interaction and state contract

Search filters include dates, occupancy, amenity, budget, accessibility, house rules and cannabis-friendly descriptors where lawful. Search results must display total-price basis and fee qualifications, approximate location, verified *provenance* (not endorsement), availability freshness and clear stale/unavailable fallback; no fabricated badges or implied confirmed inventory.

Listing detail shows photograph licensing, public host claims with verification source, public reviews, check-in/out and occupancy, cancellation policy version, accessibility facts and safety guidance. Precise address, personal contact, door codes and booking-party details remain permission/eligibility gated.

Quote screen shows selected listing revision, dates and timezone, nightly price, fees, taxes, supported asset/currency, **total due**, deposit status, expiry, cancellation terms and approved 420Swap quote terms only when supported. Reject revised totals without renewed guest consent. A quote is not a held reservation. Display capacity conflict, expired quote, required host decision and hold expiry distinctly.

Before enabled checkout, show pending booking/host approval and payment as **separate state axes**. 420Pay is canonical financial authority; wallet submission, block inclusion, toast, callback or payment intent does not mean finalized payment. Reservation is confirmed only after independently verified Pay finality and valid capacity/state reconciliation. Handle wrong chain, expired quote, abandoned signature, payment failed, late successful payment, reorg and refund recovery with accessible, non-misleading explanations. Never fabricate a booking confirmation or refund receipt.

Cancellation surfaces bind original policy snapshot and eligibility estimate; show requested, authorized, pending finality, partially refunded and finalized refund separately. 420Arbitration decisions are independent of moderation. Verified-stay review eligibility derives from authorized 420Reputation evidence; not from a UI flag.

## Host interaction and state contract

Onboarding must distinguish account sign-in, identity/ownership verification, local accommodation eligibility and actual approval. Listing editing uses autosave draft, immutable publish revision, media accessibility text and explicit publication review; unauthorized controller or revoked delegation fails closed. Calendar renders local timezone with DST and half-open UTC intervals; multi-unit quantity; overlapping holds, expired requests, closures and confirmed bookings distinguished visually and textually. Calendar update requires server-side version checks; optimistic UI reverts on conflict.

Booking queue shows guest request state, hold/decision deadline, occupancy, policy and price snapshot; accept/decline actions require fresh authoritative status. Host dashboard may display Pay-reconciled payout information but cannot redirect canonical beneficiary or approve custody, refunds, payout, settlement. Payment and payout proofs are never inferred from analytics or notification delivery.

## Shared accessibility, localization and resilience

Responsive desktop/mobile navigation, WCAG 2.2 AA design target, keyboard-only operation, focus management after dialogs/errors, semantic landmarks, labeled form fields, screen-reader announcements for pending/failed/confirmed events, error summaries linked to fields, accessible calendar alternative and reduced-motion support. Locale-aware content, currency display (without floating-point settlement assumptions), regional formatting and timezone disclosure. Keep accessible empty/loading/offline/outage/expired/no-results/permission-denied states, retry without duplicate write, progress preservation with no sensitive data in local storage, predictable back navigation and explicit irreversible-action confirmation.

Private addresses, identification, access instructions, guest roster and financial references are masked based on actor and reservation status; Search/Analytics/Travel projections expose only approved public data. Uploaded media has rights and moderation checks. Never expose exact guest position or private lodging coordinates in public map pins.

## Traceability and acceptance matrix

| ID | Required user-experience evidence and negative scenario |
| --- | --- |
| BNB-U01 | Visitor destination/date search, filters, public map/list; no private address or stale inventory promise |
| BNB-U02 | Listing detail, accessible gallery, policies, provenance and honest verification |
| BNB-U03 | Guest saved listing, cross-session resume and Travel handoff without booking side effects |
| BNB-U04 | Binding quote, fee/tax/total transparency, expiry and re-consent after change |
| BNB-U05 | Guest booking request/hold expiry, host decision and concurrent capacity errors |
| BNB-U06 | Wallet/420Pay pending versus finalized and authorized Pay-bound 420Swap conversion |
| BNB-U07 | Reservation confirmation, late payment and failed/reorg recovery states |
| BNB-U08 | Cancellation, partial refund, Pay-finality and Arbitration-dispute progress |
| BNB-U09 | Verified-stay Reputation review and host reply, moderation provenance |
| BNB-U10 | Host verification, listing draft/revision, publish gating and media rights |
| BNB-U11 | Calendar quantity, timezone/DST, conflict, host blocks and occupancy |
| BNB-U12 | Revocable scoped property manager delegation and request queue permissions |
| BNB-U13 | Host payout summary from canonical Pay proof; no host/admin fund authority |
| BNB-U14 | Moderator/support restrictions, review/appeal and audited privacy decisions |
| BNB-U15 | Responsive WCAG keyboard/screen reader/localization/timezone and accessible error states |
| BNB-U16 | Off-line/stale/indexer failure, idempotent retry, redaction and immutable booking authority |

## Qualification and gaps

**BNB-1.7 Level 1:** validate this architecture against retained BNB-1.2 journeys, BNB-1.3 booking state model, BNB-1.5 canonical Pay/Swap requirements, BNB-1.6 API definitions, GEN-SVC-0 disabled default and Travel fail-closed methods. **Milestones:** M1 and M2 previously qualified; no new milestone at BNB-1.7. **Level 3:** BNB-1.10.

**Not implemented by this document:** rendered guest or host views, live Playwright/accessibility acceptance, authenticated APIs, inventory database, actual payment, refunds, custody, verified reviews and deployed service integration. These require executable buildout before any operational claim; never treat design-only source checks as production acceptance. The BnB/Travel Genesis payment gateways remain disabled.

**Next canonical step: BNB-1.8 — Security, Privacy and Abuse Architecture.**
