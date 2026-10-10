# BNB-2.5 — Reservation and Booking Engine

**Implementation status:** repository-side BNB-2.5 Level 1 PASS and app milestone Level 2 PASS on implementation SHA `0197224ec931362773219927a9498538bb5ce913`; external Pay booking finality and testnet operational acceptance remain blocked.
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

## Booking request/instant/confirmation boundary implementation closeout

**Candidate implementation SHA:** `0197224ec931362773219927a9498538bb5ce913`; do not mark PASS until exact-SHA runtime checks and milestone app workflows have actually completed successfully. No repository-wide Foundry, Genesis or Docs Level 3 here.

Guest booking requests now **require a real issued nonexpired guest-bound quote** linked to a held inventory record. Legacy unpriced holds can never become booking requests, although their nonbinding inventory tests remain valid. All requests have one hold, one time-bounded deadline, property controller snapshot, immutable quote/policy, guest session and actor-scoped idempotency; submitting a request shortens the held stock deadline to the decision deadline. A request is never a Pay-finalized confirmation. Host acceptance validates current property controller, published status, held stock deadline, unexpired quote and guest policy; transferred/suspended former hosts cannot approve or read guest request details.

The guest/host API supports private, bounded request inboxes, accept/decline/withdraw and pending-payment reservation reads. Instant approval is an **explicit owner-draft/version-controlled listing policy**, never implied by publication, anonymous input or the host merely enabling a payment button. Instant eligibility creates a pending-payment record but **not a confirmed reservation**.

### Reservation modification and cancellation

- Guest/host can cancel only truly **unfunded `payment_pending`** reservations; the corresponding hold is released exactly once, and duplicate cancellation is idempotent. Payment-finality or already-expired reservations cannot be silently canceled/refunded.
- Guest can request a consented, quote-bound **atomic prepayment replacement** via `POST /v1/bnb/reservations/{id}/replace` with fresh `new_quote_id`, `request_type`, signed Identity session and `Idempotency-Key`. Under the shared property row lock, the original stays intact on any quote, authority, calendar, capacity or concurrent failure. On success, the original reservation and hold become canceled, a separately frozen replacement hold/request is created with a new price, and any new instant reservation is only payment pending. A host-request replacement must be newly approved: it does not inherit the original host's acceptance. One-time quote and nonce consumption prevents replay.
- `/modify` without a replacement quote deliberately rejects in-place price/date mutation; no previously accepted economic terms are edited in place.
- Guest/host can expire a payment-pending reservation only once the authoritative server hold deadline has passed; this changes reservation status to `expired` and releases the hold. Confirmed/funded reservations cannot enter that path.
- Price quotation responses now expose exact canonical policy bytes and half-open UTC interval required for nonbinding holds. The public UI offers quote-to-hold-to-request and a separate private guest/host request inbox, never displaying private addresses or a fabricated "paid" status.

### Step-specific adversarial and app-milestone validation

Targeted PostgreSQL/HTTP tests exercise cross-guest/host authorization, request and replacement replay/collision, owner revocation/property suspension, host/guest request transitions, instant-policy CAS and owner boundaries, deadline/hold equality, legacy unpriced booking rejection, cancellation/expiry at-most-once, and failed replacement rollback with old inventory preserved. BNB-2.1 account/recovery/claims, BNB-2.2 property/calendar, BNB-2.3 multi-process capacity/sync, BNB-2.4 immutable pricing/quotes, and BNB-2.5 request/reservation suites are exercised through retained app-scoped runtime CI and browser/axe smoke. Level 2 M1 at BNB-2.5 requires exact-version app checks, not a redundant repository-wide Foundry run.

**External/testnet gate:** no 420Pay-authorized receipt verifier is present. Real payment finality, true confirmed state, postpayment change/cancellation/refund, merchant payout/Swap and independent issuer/deployed property authority remain on `T-BNB-BOOKING-1` and upstream testnet roadmap. Neither synthetic tests nor BnB DB flags may be used as real confirmation authority. **Repository-side qualification is not live booking acceptance.**

## Exact-SHA qualification closeout

Ten BnB app workflows (BNB-1.1–1.9 and 420BnB Runtime Slice) completed successfully against implementation SHA `0197224ec931362773219927a9498538bb5ce913`, including runtime CI [#38091207508](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38091207508) (job `114327841006`, zero failed steps). This satisfies targeted BNB-2.5 Level 1 and the retained app-specific BNB-2.5 integration milestone Level 2 without rerunning redundant repository-wide inventories. 420Docs Qualification was intentionally skipped outside Level 3. Durable audit record: `docs/bnb/qualification/BNB-2.5-LEVEL1-AND-M1-LEVEL2-CLOSEOUT.json`.

Exact postqualification commits modifying **only documentation/evidence** inherit the qualified executable SHA. Later API/tests/CI/config/migrations/frontend changes require fresh targeted qualification. No full repo-level Level 3 reconciliation or monolithic merge has occurred. The published UI must not imply confirmed booking or funds receipt; approved 420Pay finality and postpayment cancellation/modification are blocked under `T-BNB-BOOKING-1` until real operational acceptance.
