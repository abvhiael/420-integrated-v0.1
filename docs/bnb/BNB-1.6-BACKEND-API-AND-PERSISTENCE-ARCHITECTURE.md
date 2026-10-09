# BNB-1.6 — Backend, API and Persistence Architecture

**Status:** Architecture contract only; no live BnB server, endpoint or transactional database is implemented by this step. **PR:** #600. **Inputs:** BNB-1.1–BNB-1.5; GEN-SVC-0.2–0.10 API, privacy, shared object and authorization conventions; Travel GEN-SVC-3 fail-closed gateway. **Next:** BNB-1.7 — Guest and Host Experience Architecture.

**Canonical financial authority:** **420Pay** is the sole canonical financial authority for payment intent, merchant financial identities, invoices, payment finality, settlement, authorized refunds and governed payouts. **420BnB** maintains only accommodation-specific property, listing, availability, inventory holds, booking requests, reservation state and immutable policy/quote snapshots. It must never independently authorize or execute **settlement, custody, refunds or payouts**; its backend stores only provenance-bound references to independently verified Pay decisions and receipts. A local database write, privileged BnB admin, webhook, indexer, UI action or booking confirmation cannot create financial authority. The canonical Pay contract assignments and approved Pay-bound 420Swap restrictions in BNB-1.5 remain unchanged.

## Architecture and trust zones

The future BnB deployment comprises an untrusted guest/host browser; authenticated API ingress; property/listing service; availability/hold/booking transaction service; financial reconciliation worker; outbox event publisher; private media/identity adapter; independently governed Pay/Swap/Arbitration verification clients; public Search/Travel projection workers; and operator audit tooling. Only one durable primary booking database is authoritative for BnB inventory. Search, analytics, cache, notification and webhooks never create authoritative reservations or payment finality.

API ingress validates session audience, expiration/revocation, principal, tenant/property delegation, capability, origin, payload, version and replay/idempotency before a mutation. Property publication requires independently confirmed control/eligibility. Service-to-service requests use authenticated short-lived credentials and scoped service roles; no generic 'admin' privilege may settle funds.

## API contract: future /v1/bnb namespace

| Endpoint | Authorized principal | Contract, state and failure boundary |
| --- | --- | --- |
| GET /v1/bnb/listings | public | cursor pagination with bounded limit; only published, visibility-filtered, coarse-location projections; freshness marker |
| GET /v1/bnb/listings/{listing_id} | public / scoped | published revision, cancellation rules and provenance; never private address or access credentials |
| POST /v1/bnb/properties | verified host | property draft, independent controller check; idempotent; no automatic public publication |
| PATCH /v1/bnb/properties/{property_id} | controller / delegated property editor | optimistic version precondition; changes to controller/payout never implied |
| POST /v1/bnb/listings/{listing_id}/publish | verified authorized controller | approved policy/revision/property authority; transactional state transition |
| GET /v1/bnb/availability | guest / public filtered | nonbinding inventory snapshot, UTC dates/property timezone, projection timestamp |
| POST /v1/bnb/quotes | authenticated guest | fixed listing revision, unit, interval, occupancy, policy and exact integer total; expiry; no Pay authority |
| POST /v1/bnb/holds | authenticated guest | atomic unique interval/capacity enforcement, bounded TTL, same-key replay returns same result |
| POST /v1/bnb/booking-requests | authenticated guest | holds/quote/policy required; request vs instant semantics; bounded approval deadline |
| POST /v1/bnb/booking-requests/{id}/decision | authorized property controller | pending request and deadline, capability check; accepting not financial finality |
| GET /v1/bnb/reservations/{id} | guest or authorized host/staff | row-scoped ownership and privacy; stable Booking ID mapping |
| POST /v1/bnb/reservations/{id}/cancel | guest or authorized controller | policy-snapshot eligibility, race-safe state; financial remedy separate |
| POST /v1/bnb/payments/intents | authenticated payer through governed adapter | disabled until Pay approved; canonical invoice, quote, asset and principal binding |
| GET /v1/bnb/payments/{id} | payer / authorized host limited fields | canonical proof provenance; pending != finalized; no client-settable paid status |
| POST /v1/bnb/disputes | authorized stay party | evidence scope, independently mediated case; no fund transfer |
| POST /v1/bnb/reviews | completed verified-stay party | Reputation verification and anti-self-review; moderated, scoped |
| GET /v1/bnb/host/reservations | authorized property controller/delegate | property-scoped cursor; redacted guest data until appropriate |
| GET /v1/bnb/admin/audit | independently authorized auditor | immutable redacted provenance, bounded access and audit trail |

These are **proposed** contracts, not registered HTTP routes. Every response bears `id`, `version`, `created_at`, `updated_at`, `status`, `visibility`, `source` where applicable, plus correlation ID; dates use RFC 3339 UTC; IDs are opaque; paging is cursor-based with maximum limit and rate-limit metadata. Require stable error codes `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `STALE_VERSION`, `CAPACITY_EXHAUSTED`, `QUOTE_EXPIRED`, `HOLD_EXPIRED`, `PAYMENT_UNAVAILABLE`, `FINALITY_PENDING`, `PROOF_INVALID`, `POLICY_BLOCKED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`. Reject unknown schema versions, unexpected fields in signed envelopes, oversized payloads and incompatible chain/service manifests; sanitized errors must not leak resource existence or secrets.

## Relational ownership and persistence

Proposed PostgreSQL data model has `host_profile`, `guest_profile`, `property`, `property_delegation`, `unit`, `listing_revision`, `availability_block`, `rate_plan`, `price_quote`, `inventory_hold`, `booking_request`, `reservation`, `booking_state_event`, `cancellation_policy_snapshot`, `payment_intent_ref`, `financial_proof_ref`, `refund_ref`, `payout_ref`, `dispute_ref`, `idempotency_record`, `inbox_event`, `outbox_event`, `audit_event`, `media_acl` and `schema_migration`. Cross-tenant and property foreign keys are mandatory. Financial tables are references to Pay evidence, never local substitute ledgers or custodial balances.

Each mutable record has `version` and immutable creator/authority provenance; event append sequence is monotonically increasing; state transitions use explicit allowed-edge checks in same DB transaction. Reservations map to exactly one stable shared GEN-SVC-0 `Booking` identifier, not a competing mutable booking ledger. Enforce uniqueness on `(actor_scope,idempotency_key,operation)`, `(source_service,chain_id,tx_hash,log_index,finality_epoch)` as applicable, `(reservation_id,payment_id)` and `(booking_id,state_event_seq)`. Deduplication checks payload digest equality: same key with different request fails `CONFLICT`. Uniqueness alone is not a substitute for signature/authority verification.

**Overbooking invariant:** for every rentable unit and intersecting interval, confirmed reservations plus active holds never exceed configured capacity. Use PostgreSQL serializable or explicit locking and exclusion/occupancy accounting strategy, with a documented retry ceiling; host block, hold expiry, confirmation and cancellation all mutate one capacity ledger. Quote issuance does not reserve capacity. A worker cannot revive an expired hold or confirm inventory after a newer booking consumes it. Half-open UTC intervals and timezone/DST conversion are normalized once, with property timezone retained for display and applicable local rules.

**Outbox/inbox:** write booking mutation and outbox event atomically; emit at least once with durable cursor. Subscribers must dedupe by source/event/domain before projections, notifications or financial reconciliations. A network retry may repeat transport, never economic state change. Canonical Pay proof is independently checked against chain/asset/payer/merchant/invoice/finality; a copied callback or search projection cannot mark booking paid. Reorg/reversal returns to protected recovery state. Failure between capture and booking confirmation uses bounded reconciliation, not a second charge. A late payment after hold expiry goes to refund/recovery without violating capacity.

**Persistence operations:** versioned forward/backward-compatible migrations; backup encryption and tested restore point; PITR and RPO/RTO documented at deployment; scoped data retention and deletion/tombstone with legal-hold exceptions; immutable non-secret audit trail; private address, access codes, identification and payment/guest secrets encrypted with field-level access. Public search read-model must be coarse-location and visibility filtered before export. GDPR/PIPEDA/right-to-delete handling subject to applicable obligations and retained lawful audit trails. No actual migration/deployment is claimed.

## Required nonfunctional and adversarial tests

| ID | Acceptance requirement and later executable proof |
| --- | --- |
| BNB-B01 | API schemas, pagination, request limits, stable errors and RFC 3339 UTC |
| BNB-B02 | Identity/tenant/property delegation authorization and revocation |
| BNB-B03 | Atomic capacity, hold expiry and overlapping interval concurrency |
| BNB-B04 | Price/quote-policy snapshot and stale-version/optimistic locking |
| BNB-B05 | Idempotent create/decision/cancel and replay payload conflict |
| BNB-B06 | Pay finality/provenance isolation and late-settlement recovery |
| BNB-B07 | Split/refund/payout financial reference deduplication, no custody |
| BNB-B08 | Outbox/inbox crash, retry, poison message and reorg recovery |
| BNB-B09 | Privacy/search/analytics projection authorization and PII redaction |
| BNB-B10 | Schema migration, rollback, restore and multi-instance consistency |
| BNB-B11 | Rate limits, anti-abuse, content/media validation and audit access |
| BNB-B12 | Frozen Genesis Travel gateway / deferred booking and escrow |

## Gap register, milestone, qualification

**Present repository state:** retained Travel `travel-compat/v1` types and disabled `GenesisTravelTransactions`; BNB-1.1–BNB-1.5 architecture docs/verifiers and Pay/Swap protocol references. **Missing implementation:** typed API server and router, migration SQL, durable inventory DB and isolation tests, auth middleware, transactional holds/booking state, proof reconciliation worker, outbox/inbox, persistence backups, multi-instance/runtime/security suites and deployed acceptance. These remain required in subsequent buildout; architecture-only qualification must never be mistaken for deployed functionality.

**BNB-1.6 Level 1:** scoped source-to-spec verification covering BNB-B01–B12, GEN-SVC-0 conventions, canonical Travel-disabled config and lack of forged runtime claims. The milestone defined at BNB-1.5 is M2; BNB-1.6 does not trigger a new ceremonial Level 2 unless implementation materially changes shared authority. **BNB-1.10** remains the phase Level 3 closeout with qualified code and deployment state.

**Next canonical roadmap step: BNB-1.7 — Guest and Host Experience Architecture.**
