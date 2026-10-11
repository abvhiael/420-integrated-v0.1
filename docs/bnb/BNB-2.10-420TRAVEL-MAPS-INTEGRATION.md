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
