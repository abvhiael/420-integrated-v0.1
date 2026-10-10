# BNB-1.3 — Domain Model and State Machines

**Status:** Normative design contract for future implementation; not executable booking authority.  
**Baseline:** BNB-1.1 and BNB-1.2 on PR #600; frozen Genesis catalog and GEN-SVC-0/GEN-SVC-3 constraints remain controlling.  
**Milestone:** M1 (BNB-1.1 through BNB-1.3); Level 2 app-scoped integrated review required after this step.  
**Explicit release boundary:** `travel.bnb_booking=false`, `bnb_compatibility.enabled_at_genesis=false`. Never activate `GenesisTravelTransactions` or promote a Genesis application through this document.

## 1. Ownership, canonical versus derived data

420BnB's *future authorized application service* is canonical for accommodation-specific property-unit inventory, listing revisions, booking requests, holds, reservation lifecycle and the contractually bound cancellation policy snapshot. It is not canonical for host identity, licensed/registered status, 420Location's public place object, 420Reputation review truth, 420Pay payment finality/refunds/payout, 420Arbitration outcome, chain state or 420Travel plans. Those are external authorities consumed through versioned, authenticated adapters. No asset custody is conferred by listing or booking records.

A GEN-SVC-0 `Booking` is the shared interoperable vocabulary; within this service an accommodation `Reservation` is its domain-specific implementation, with a stable mapped `booking_id`/public reference. Do not persist a second mutable `Booking` ledger that can disagree with Reservation. The existing `travel-compat/v1` `Reservation` is only an opaque planning reference, not a sufficient on-chain or runtime schema; a separate versioned BnB API is mandatory.

Each record has opaque scoped ID, schema version, creation/update UTC timestamps, authoritative owner/source, visibility, immutable audit sequence and explicit tombstone semantics. Cross-domain references are typed and provenance-bound; no client-supplied verification flags.

## 2. Entity inventory and constraints

| Entity | Authority, principal fields and constraints | Privacy and lifecycle |
| --- | --- | --- |
| HostProfile | Host identity reference verified independently; public presentation separately consented; verification source/version | Non-verified drafts cannot imply certified status |
| GuestProfile | 420Identity principal reference; account-specific preferences and contact handles | PRIVATE; redact from public projection |
| Property | Property ID; verified controller; Place reference if published; address separately access-controlled; jurisdiction, license provenance | DRAFT → REVIEW_PENDING → ACTIVE → SUSPENDED / ARCHIVED; ownership change independently verified |
| PropertyDelegation | Property ID, principal, capability set, expiry, revocation sequence | Per-property scoped, revocable; no settlement permission by implication |
| RentalUnit | Property ID, unit ID, capacity, occupancy; finite bookable quantity (1 for exclusive space, bounded N otherwise) | PRIVATE unit inventory; no public exact access credentials |
| ListingRevision | Listing ID, property/unit reference, immutable revision, visibility, amenities, occupancy, rules, policies, price-plan references, published snapshot hash | DRAFT → PENDING_REVIEW → PUBLISHED → SUSPENDED/UNPUBLISHED → ARCHIVED |
| AvailabilityBlock | Unit / date interval, hold or host block, priority, origin revision and responsible principal | Private inventory ledger; reservations consume capacity |
| RatePlan | Currency/asset policy reference, nightly amounts, fee and tax components, min/max nights, host-defined restrictions | Must be frozen by quote version; no floats |
| PriceQuote | Quote ID, listing revision, unit, UTC interval / property timezone, guest count, exact fee/tax/total integer minor units, currency/asset, exchange quote if approved, expiry, policy hash, signed provider authority | ISSUED → ACCEPTED/EXPIRED/REVOKED; no payment authority |
| InventoryHold | Hold ID, request ID, unit, bounded interval and quantity, expiry, idempotency key, parent quote; capacity reservation | ACTIVE → COMMITTED/RELEASED/EXPIRED; cannot create negative capacity |
| BookingRequest | Guest ID, property, listing revision, quote ID, request type (INSTANT/REQUEST), approval deadline, current status | REQUESTED → ACCEPTED/DECLINED/EXPIRED/WITHDRAWN; acceptance is not Pay finality |
| Reservation | Reservation ID, shared Booking ID, guest ID, host/controller snapshot, unit, exact UTC window, timezone ID, policy and quote hash, hold ID, payment settlement reference, lifecycle status | PENDING_PAYMENT → CONFIRMED → STAY_IN_PROGRESS → COMPLETED, with terminal CANCELED/EXPIRED/FAILED/DISPUTED overlays |
| PaymentIntentRef | Reservation ID, approved 420Pay intent, payer, payee/recipient commitment, amount, asset, chain, nonces | No duplicate custody; only Pay attests FINALIZED |
| CancellationCase | Reservation ID, actor, reason, frozen applicable policy/revision, cancellation time, authorized refund decision | Requested → REVIEWED → SETTLEMENT_PENDING → CLOSED |
| RefundRef | Canonical Pay refund ID, reservation/settlement references, beneficiary, amount and finality | Derived read model, not BnB-local money |
| HostPayoutRef | Approved Pay payout ID, receiving host identity/commitment, net amount and finality | Derived read model, payout never awarded by host role |
| StayEvidence | Minimal private interaction/completion proof for eligible review, non-public guest information | Only objective proof can feed reputation eligibility |
| DisputeRef | Separate Arbitration case ID, issue class, affected booking, ruling and settlement references | Moderator cannot execute financial remedy |
| EventOutbox / AuditRecord | Durable monotonic sequence, event ID, aggregate version, causation and idempotency identity, actor, stable machine event | Append-only within retention policy; no public PII payload |

## 3. Time, capacity, pricing and tenancy invariants

1. **Intervals:** Represent lodging occupancy by local property check-in/check-out dates plus IANA timezone and derived UTC instants. Stay interval uses half-open `[check_in, check_out)`; positive nights; checkout exactly at next checkin is not overlap. Disambiguate DST transitions by recorded zone and explicit local-policy rule, never client-local clock alone.
2. **Capacity conservation:** For each bookable unit/date, `0 <= blocked + confirmed + active_holds <= authorized_capacity`; committed hold converts to reservation occupancy exactly once; expiration/cancel release exactly once; rejected/declined requests must not consume inventory indefinitely. Multi-unit inventory must allocate explicit identifiable units or a transactional bounded pool with equivalent proof.
3. **Concurrency:** ACID transactional row/interval locking or equivalent serialized compare-and-swap ledger; concurrent identical or conflicting booking attempts cannot both succeed beyond capacity. Multiple service instances must share authoritative state; read-side Search projections never reserve stock.
4. **Expiry:** Server-time bounded holds and quotes, hard expiry independent of client retry; expired quote cannot be accepted; payment receipt arriving after expiry must route to explicit late-payment remediation, never silently revive availability.
5. **Idempotency/replay:** Unique domain-scoped `(principal, operation, idempotency_key)` bound to normalized immutable request digest; retry same digest returns same result, different digest rejects; external Pay and Arbitration callbacks bind source, chain, domain, nonce, original operation and settlement ID.
6. **Money:** All amounts are checked unsigned integers in canonical asset smallest units; fiat indications in ISO currency minor units with exact rounding/FX metadata. `sum(itemized charge components) == quoted total` and refund/payout accounting cannot exceed finalized captured funds. Do not infer 420-token exchange price from the Travel `NightlyPrice` placeholder.
7. **Policy snapshot:** The agreed listing revision, capacity, house rules, taxes/fees and cancellation policy hash are immutable after acceptance. New host edits apply prospectively, never rewrite existing obligations.
8. **Authority:** Host/property manager cannot impersonate guest, change payer/payee, manually mark Pay finality, rewrite reviews or settle Arbitration. Moderation never edits the Pay ledger. Anonymous callers never receive exact private address, access instructions or guest identity.
9. **Transitions:** Every mutation validates actor, aggregate expected-version, original quote/hold, current state, deadline and authoritative external proof. Invalid transition fails without partial writes and produces an auditable machine error.
10. **Reorg/outage:** Confirmation depends on approved settlement finality. Reorg, webhook replay, orphan callbacks, provider outage and stale read models produce explicit recoverable statuses without double payment or phantom occupancy.
11. **Privacy and deletion:** User-visible projections enforce per-field authorization, and private addresses/check-in instructions are disclosed only to authenticated eligible parties at the authorized journey stage. Deletion/tombstones retain only lawfully required audit/financial links.

## 4. Booking request machine

`DRAFT` is client-only noncanonical until submitted. Canonical request begins `REQUESTED`. REQUESTED → ACCEPTED (host authorized, unexpired, hold valid) / DECLINED (authorized host) / WITHDRAWN (requester) / EXPIRED (deadline). ACCEPTED → reservation PENDING_PAYMENT. Instant booking skips discretionary approval but still requires quote, verified policy and atomic hold. DECLINED/WITHDRAWN/EXPIRED are terminal; retries may create a *new* request with a new idempotency identity but never revive the old one.

## 5. Inventory hold machine

CREATED is internal atomic operation; exposed state ACTIVE. ACTIVE → COMMITTED only with matching reservation and allowed payment/lifecycle event, or → RELEASED for explicit abort, or → EXPIRED after server deadline. COMMITTED/RELEASED/EXPIRED are terminal. Competing transitions must acquire the same transaction/version guard, preserving at-most-once stock release and at-most-once commit. A committed hold changes accounting bucket but not total allocated nights.

## 6. Quote machine

ISSUED → ACCEPTED before server expiry and only by authorized guest for exact date/quantity/listing revision/policy/asset; ISSUED → EXPIRED on deadline or → REVOKED by authorized upstream invalidation. ACCEPTED binds one booking intent; any subsequent price/policy change requires a newly issued quote and fresh guest consent. Expired/revoked quotes never return to ISSUED or become authorized payment requests.

## 7. Reservation machine and money-boundary sequencing

| Current | Event and authority | Next | Safeguards |
| --- | --- | --- | --- |
| NONE | Authorized guest accepts valid quote and atomic hold is created | PENDING_PAYMENT | Unique booking + quote; capacity and disclosure checks |
| PENDING_PAYMENT | Approved Pay finality proof matches payer, beneficiary policy, amount, asset, chain, intent and reservation | CONFIRMED | Verify finalized receipt; idempotent callback; only one commitment |
| PENDING_PAYMENT | Hold/payment deadline reached with no proven finality | EXPIRED | Release inventory once; late receipt routed to recovery |
| PENDING_PAYMENT | Payment rejected and terminal under approved adapter | FAILED | Release inventory once; no false 'paid' UI |
| CONFIRMED | Authorized service verifies check-in window and stay evidence | STAY_IN_PROGRESS | Never expose private arrival details before permitted |
| STAY_IN_PROGRESS | Check-out or evidence-based completion policy satisfied | COMPLETED | Pending dispute/refund states remain individually tracked |
| CONFIRMED / STAY_IN_PROGRESS | Cancellation policy authorizes request | CANCELLATION_PENDING | Freeze case and payment disposition; no invented refund |
| CANCELLATION_PENDING | Authorized inventory release and Pay settlement outcome reconciled | CANCELED | No double-release or overrefund |
| CONFIRMED / STAY_IN_PROGRESS / COMPLETED / CANCELED | Separately authorized Arbitration claim | Unchanged lifecycle + dispute overlay | DISPUTED is not an alternative state replacing financial truth |

**No local shortcut:** a Pay intent submitted, transaction hash seen, or callback delivered does not equal finality. Booking confirmation is forbidden until authoritative reconciliation succeeds. Late finalized payments following expired holds require explicit compensating refund/manual review; do not reoccupy sold inventory.

## 8. Cancellation/refund and payout machines

Cancellation case: REQUESTED → POLICY_EVALUATED → (APPROVED / DENIED) → (SETTLEMENT_PENDING when approved) → SETTLED / RECOVERY_REQUIRED. Cancellation of inventory and money are separate idempotent operations with durable reconciliation: never claim refunded until Pay confirms finality. Refund: ELIGIBLE → SUBMITTED_TO_PAY → FINALIZED or REJECTED/RETRYABLE_FAILURE; all refunds apply cumulative amount cap `refund_finalized_total + refund_reserved_total <= captured_total`. Payout: NOT_ELIGIBLE → ELIGIBLE (per approved freeze period and policy) → SUBMITTED_TO_PAY → FINALIZED / RECOVERY_REQUIRED; refunds and payouts share conserved settlement accounting and cannot double-spend earmarked funds. No local BnB contract independently holds or transfers guest assets absent a separate protocol decision.

## 9. Publication and delegation machines

Property: DRAFT → REVIEW_PENDING → ACTIVE / REJECTED; ACTIVE → SUSPENDED → ACTIVE or ARCHIVED; rejected claims may be resubmitted with new independent evidence, not self-approved. Listing: DRAFT → PENDING_REVIEW → PUBLISHED / REJECTED; PUBLISHED → UNPUBLISHED / SUSPENDED; republish requires current controller and jurisdiction checks. Delegation: PROPOSED → ACTIVE (verified owner approves) → REVOKED / EXPIRED; revoked delegate's subsequent requests and queued jobs must be reauthorized before mutation. Publication status does not imply an authorized host identity or regulatory approval.

## 10. Event and adapter contracts

Every state-change event must have domain/version, aggregate ID and expected/new version, timestamp UTC, actor provenance, correlation/causation ID, stable idempotency event ID, redacted payload and canonical source. Delivery uses durable outbox with bounded retries, replay and restart recovery; consumer deduplication cannot rely on transport at-most-once. Typed adapter errors distinguish UNAVAILABLE, UNAUTHORIZED, STALE_REVISION, EXPIRED, CONFLICT, WRONG_ASSET, PROOF_INVALID, FINALITY_PENDING, SETTLEMENT_FAILED and POLICY_BLOCKED. Notifications/indexers are derived, can lag and must never confer authority.

`travel-compat/v1` must remain structurally backward-compatible and fail-closed. A separately designed BnB API version maps typed public listing/availability/booking references; never reuse Travel `GenesisTravelTransactions` as a configurable live switch.

## 11. Requirements and adversarial acceptance matrix

| ID | Requirement | Target tests for future executable implementation |
| --- | --- | --- |
| BNB-D01 | Stable canonical entities and Booking/Reservation mapping | Duplicate shared booking ID, cross-tenant IDs, incorrect source and tombstone tests |
| BNB-D02 | Property, listing, manager roles | Forged owner, revoked manager, unverified listing publication |
| BNB-D03 | Half-open timezone-aware intervals | DST ambiguity, leap days, boundary-adjacent checkout/check-in |
| BNB-D04 | Inventory finite capacity and holds | Concurrent bookings, double release, hold expiry race, unit overcapacity |
| BNB-D05 | Quote/version/policy binding | Stale quote, changed policy, expiry, wrong guest, currency mismatch |
| BNB-D06 | Booking request lifecycle | Decline/withdraw/expiry/replay, unauthorized approval |
| BNB-D07 | Reservation state machine | Wrong-state transitions, forged confirmation and late Pay receipt |
| BNB-D08 | Cancellation/refund/payout conservation | Overrefund, dual payout, denied cancellation, partial settlement failure |
| BNB-D09 | Pay and Arbitration authority | Forged/replayed callback, wrong chain/asset, no independent dispute proof |
| BNB-D10 | Private listing/guest/location data | Cross-tenant search, unbooked access instructions, log/index leaks |
| BNB-D11 | Derived indexes, notifications, event integrity | Outbox retry, replay, partial failure, stale projection |
| BNB-D12 | Genesis compatibility and release gate | Old Travel types parse as before; disabled operations still reject |

These are requirements for subsequent implementation phases, not claims that they are already tested.

## 12. Existing prerequisites and exact boundaries

- `genesis/svc3/travelapp/compatibility.go` defines only v1 compatibility schemas and a permanently disabled transaction gateway.
- GEN-SVC-0 shared `Booking` is the universal vocabulary; any future BnB entity must map one-to-one to an authoritative reservation, rather than create a competing ledger.
- `config/420travel-genesis.json` and `config/genesis-consumer-services.json` keep booking off at Genesis.
- No BnB contract deployment, new frozen address, payment router activation, Identity authority, permission expansion or existing Travel compatibility behavior is modified in BNB-1.3.

## 13. Phase handoff and qualification

**BNB-1.3 exit:** a complete entity/source/privacy inventory, unambiguous reservation + hold + quote + cancellation + refund + payout + listing/delegation state machines, concurrency/finance/replay invariants, stable BNB-D01–D12 traceability, and conservative compatibility / Genesis release boundaries. The Level 1 verifier is required to pass at exact implementation SHA; the **M1 Level 2 milestone** must evaluate 1.1–1.3 together on that same SHA with app-scoped checks. Full Level 3 remains deferred to BNB-1.10.

**Next canonical roadmap step:** BNB-1.4 — Protocol Authority and Integration Boundaries.
