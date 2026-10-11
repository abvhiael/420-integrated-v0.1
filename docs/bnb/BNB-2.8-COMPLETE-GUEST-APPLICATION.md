# BNB-2.8 — Complete Guest Application

**Canonical step:** Accommodation search, listing pages, saved stays, checkout, reservation dashboard, messaging, reviews, receipts. **PR:** #600. Repository truth and BNB-1.3/1.5, BNB-2.3/2.4/2.5/2.6/2.7 evidence remain authoritative.

## Public and authenticated application surfaces
- Public `GET /v1/bnb/search` accepts a bounded region/text/capacity query (escaped SQL LIKE wildcards, deterministic pagination) and returns **published** listings only, with public region, no street address, no owner/session data. `GET /v1/bnb/listings/{id}` returns one published listing and independently approved reviews only. Existing calendar/quote/hold endpoints continue to enforce timezone, quantities, source-staleness and occupancy.
- The guest web experience supports responsive public search, listing detail, quote and temporary hold/request checkout flow. The guest cannot claim actual Pay-finalized checkout or payment from the browser; previously qualified Pay-only authorizations remain intact.
- Signed 420Identity-scoped saved stays (list/save/unsave) are unique per guest/property, and the guest dashboard provides own reservations and booking request IDs without leaking host-private claims, street addresses or other guests.
- Guest-private booking-request messages require either the original guest or current eligible host and an open thread. Caller-scoped nonce replay is idempotent for identical messages and rejects mutation; no arbitrary cross-property message access.
- Guest reviews require a verified, completed, **confirmed** stay and a single submission per reservation. All submissions remain `pending_moderation` and invisible on public listing pages pending independent moderation authority; BnB does not forge publication approval.
- Existing private guest receipt endpoint reports 420Pay-issued receipt provenance only and fails closed without independent finality. Guest UI never labels a pending-payment reservation settled.

## Qualification
Level 1 covers migration 017, public/privileged discovery privacy, saved-stay uniqueness, guest dashboard scoping, message nonce/replay and closed threads, review eligibility/moderation, Chromium guest journeys, mobile accessibility smoke, and inherited booking/Pay/adversarial regressions. Qualify an exact executable SHA; no skipped required check is counted as passing.

**External release gates:** actual operational 420Pay/420Swap payment execution and receipt finality, human-operated review moderation, independently authorized host/property claims and production accessibility/manual screen-reader acceptance remain testnet/human gates. No synthetic UI fixture or local mock Pay proof qualifies them. Level 2 remains milestone-based and Level 3 belongs solely to the complete app-phase reconciliation against current main and canonical Solidity/Genesis owners.
