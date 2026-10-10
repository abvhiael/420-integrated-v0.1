# BNB-2.5 — Reservation and Booking Engine

**Implementation status:** app-side lifecycle implementation underway, exact-SHA qualification pending.
**Authority:** BNB-1.3 domain state machines, BNB-1.5 canonical Pay ownership, current Genesis disabled booking/escrow flags, previous BNB-2.1–2.4 evidence; PR #600.

## Implemented scope

- Migration 013: property-level instant-book opt-in (draft-only, owner/version-gated); request IDs linked to one inventory hold, guest and host, deadlines, quote ID, strict request state; reservation links retain immutable accepted hold policy and quote references, and public booking reference.
- Guest-only request submission requires active unexpired inventory hold, matching guest, published property, unexpired quote when present, server-bounded approval deadline, single-use hold association and actor/operation-scoped payload digest/idempotency key.
- Request mode starts `requested`; host may accept or decline while hold and deadline remain live; guest may withdraw; deadline forces terminal `expired`. Acceptance atomically creates precisely one `payment_pending` reservation without recording a Pay proof or claiming confirmed booking.
- Instant mode is denied unless an authorized draft-set listing instant-book policy was explicitly enabled; approved option creates a `payment_pending` reservation atomically with request. This is eligibility, **not payment/booking confirmation**.
- Guest/host request and reservation access is private, restricted to original principals. Prepayment cancellation is an atomic terminal transition and idempotent; modifications of accepted reservations cannot silently mutate terms and require a fresh quote/new request instead. Financed/confirmed cancellation and refund remain entirely under authorized Pay.
- Direct guest release of a hold while a booking request is pending or accepted is forbidden; caller must use request withdrawal or prepayment reservation cancellation.

## Explicit live authority boundary

No host, guest, admin, moderator or local callback can set `confirmed`, manufacture 420Pay finality, execute refunds or payouts, or turn the Genesis Travel/BnB transaction flags on. Requests and instant eligibility produce nonbinding payment-pending records only. Final canonical reservation confirmation, postpayment modifications/cancellation/refunds, full host licensing, real independent property claims, issuer credentials, pending payment expiry/recovery and live deployment must be qualified via their approved upstream/testnet authority.

## Level 1 target tests

PostgreSQL migration, signed principal session tests, quote/hold inherited invariants, request replay and different-payload collision, unauthorized host decision, withdraw/decline, independent signed guest/host acceptance, instant eligibility, expiry, idempotent prepayment cancellation, immutable modification refusal and private read. Existing two-Uvicorn-process contention, browser/axe, nonroot container build and no-financial-authority checks remain in app workflow.

**Qualification:** not yet claimed; validate exact implementation SHA using `420BnB Runtime Slice` and observe failed steps before recording PASS. **Level 2** app-scoped integration required at BNB-2.5 milestone after Level 1; **Level 3** held for full BNB audit phase closeout. No duplicate repo-wide Foundry/Genesis/Docs runs.
