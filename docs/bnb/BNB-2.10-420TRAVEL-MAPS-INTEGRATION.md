# BNB-2.10 — 420Travel and Maps Integration (implementation in progress)

**Canonical step:** Destination searches, accommodation discovery, map markers, booking handoffs, jurisdiction-aware listing filters. **PR:** #600. **Phase Level 3:** deferred.

## Implemented repository slice

- Read-only `GET /v1/bnb/travel/discovery` delegates discovery to the established BnB published-listing query. Destination is interpreted as the bounded public-region filter; capacity/limit/offset use the existing server-side guardrails. It never returns private addresses.
- A versioned `bnb-travel-discovery/v1` projection includes publicly authorized listing identifiers, title, coarse region, guest capacity, nonbinding nightly amount, and a GET-only no-side-effects BnB listing handoff.
- Explicit `transaction_enabled=false`, `nonbinding=true`, `jurisdiction_authority=unverified`, `map_precision=region_only`, `map_marker=null`, `legal_compliance_verified=false`. This is not a fabricated coordinate, approved destination compliance decision or live 420Travel deployment.
- The public BnB browser includes a coarse destination-discovery experience with accessible labels and status. Regression tests cover invalid parameters and public/financial/privacy boundaries.
- No Travel Genesis compatibility flag, transaction gateway, 420Pay/420Swap authority, host/property verification, or frozen address map was changed.

## Requirements and remaining work

| Canonical requirement | Status | Evidence/gap |
| --- | --- | --- |
| Destination searches | PARTIAL | Region-based BnB search implemented; canonical 420Location place/destination IDs and Travel route handoff not yet wired |
| Accommodation discovery | PARTIAL | Published BnB projection and public browser; no actual 420Travel consumer adapter or indexed freshness contract |
| Map markers | BLOCKED | Current BnB schema stores public region only; approved coarse geospatial precision/provider projection and marker updates needed, never interpolate private coordinates |
| Booking handoffs | PARTIAL | Safe no-side-effect listing GET reference; signed consent-based booking journey and cross-app resume remain to be implemented under BnB's own authority |
| Jurisdiction-aware filters | BLOCKED | Requires independently maintained jurisdiction rules/issuer with version, region scope, effective date, revocation/fail-closed state and explicit consumer disclosure. Never infer legality from cannabis descriptors |
| Negative/adversarial tests | PARTIAL | Standalone projection bounds/privacy tests added; concurrent publication changes, stale map/search, forged location-policy issuer, cross-app handoff replay and browser navigation still needed |
| Level 1 targeted CI | PENDING | GitHub Actions BnB Runtime Slice must PASS on final executable SHA; no queued/missing job may count as green |
| Level 2 | DEFERRED | Determine genuine cross-service milestone once actual 420Location/Travel integration exists |
| Level 3 | DEFERRED | Once at final BnB audit-phase merge candidate |

## Authority guardrails

420Location owns source place identity/location precision; 420Travel is discovery/planning and its Genesis BnB transaction gateway remains disabled. BnB alone authorizes its listings and any separate booking lifecycle, subject to independently approved property rights and policy. Neither Travel compatibility structs nor public region strings prove legal permission or accommodation availability. Canonical 420Pay/420Swap financial authority is unchanged.

## Qualification record

This document is a **partial progress record, not a PASS certification**. Final executable SHA, workflow/run/job outcome, exact tests, security verification, browser/Maps/Travel acceptance and repository-side completion state must be added once completed. Do not advance the canonical roadmap based on this record.

## BNB-2.10 remaining implementation worklist (authoritative execution tracker)

These items are mandatory to complete BNB-2.10 repository-side scope, not a claim that external governance approvals have occurred.

1. **L10 — 420Location destination and nearby integration.** The existing `/travel/api/v1/places` is a public, no-coordinate allowlist. The BnB resolver now validates a public `place_id`, fails closed on missing/stale/duplicate/untrusted responses, and narrows searches to the public region. Still required: canonical public place ID-to-property binding (independently verified, controller-revocable), nearby distance queries only where precision is authorized, robust pagination/provider provenance and revocation/freshness acceptance. No geocoding from `public_region`.
2. **T10 — Actual 420Travel consumer integration.** Wire a bounded BnB public adapter into Travel destination, map and list views without changing Travel Genesis compatibility transaction contracts. Use fresh non-cacheable BnB reads; remove cards when unpublished/suspended, transferred or unavailable. Test BnB outages and partial-data errors. Never expose host/private fields or suggest inventory is guaranteed.
3. **M10 — Public map markers.** Create a map-marker contract bound to independently approved coarse (or expressly permitted public-pin) place visibility, issuer/version/revocation and precision. Existing Travel map already shows published 420Location pins but BnB must not borrow coordinates without a verified property-to-place association. Withdraw marker when property or place becomes private, deleted, suspended, revoked or stale; accessible list navigation must remain.
4. **H10 — Booking handoffs.** The current BnB discovery envelope carries a GET-only property detail reference and browser navigation. Finish explicit cross-origin Travel-to-BnB navigation with exact property ID, request intent and no side effects. BnB must independently validate publication, fresh inventory, authenticated session, policy/price/quote and quote expiry before any transaction. Reject foreign or replayed intents; no client-provided financial finality or Travel Genesis bookings.
5. **J10 — Jurisdiction rules and filters.** Define approved jurisdiction issuer/registry contract and real signed effective-dated policy ingestion with revision, geographic scope, revocation, sunset and fail-closed behavior. Independently reviewed eligibility decisions must precede jurisdiction-sensitive public presentation. Cannabis descriptors are informational and never certify legal compliance. Where no approved policy exists, mark legal status unverified and withhold regulated offerings.
6. **Q10 — Targeted tests and exact-SHA closeout.** Add PostgreSQL/HTTP cross-app integration for publishing/unpublishing, ownership transfer, stale map/search, malicious/untrusted place/policy payloads, location precision and private-address leakage, cross-property IDOR, guest booking handoff/replay/repricing/expiry, provider timeouts, and accessible browser map/list journeys. Run BnB Runtime Slice and affected Travel/Location targeted workflows only after code changes; document run/job IDs and exact executable SHA. Introduce Level 2 BnB-focused Travel/Maps cross-service milestone only after full adapters converge; Level 3 remains reserved for final audit-phase reconciliation.

**Present blockers:** The currently available 420Travel public JSON projection deliberately excludes coordinates and does not certify property/place associations or legal jurisdiction approvals; no independent jurisdiction rules issuer is wired into 420BnB. Implement or obtain upstream authoritative adapters before calling M10 or J10 complete. Testnet operational approval remains a separate gate; repository-side validation and deliberate fail-closed paths are still required.
