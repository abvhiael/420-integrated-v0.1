# BNB-1.2 — Product Scope and User Journeys

**Status:** Product requirements baseline; implementation is deferred to later BNB phases.  
**Authority:** BNB-1.1 source reconciliation, frozen Genesis application decision, GEN-SVC-0 shared consumer conventions, GEN-SVC-3 Travel compatibility.  
**Scope:** Product specification only. This document is **not** authorization to deploy booking, payment, cancellation settlement or escrow features at Genesis.  
**Qualification:** App-scoped Level 1 product-contract validation. Milestone M1 Level 2 follows BNB-1.3; BNB-1.10 owns phase Level 3.

## 1. Purpose and positioning

420BnB is an intended standalone accommodation marketplace integrated with 420Travel for destination discovery. Hosts and authorized property managers publish and operate short-stay listings; guests discover, evaluate, reserve and manage stays. Cannabis-friendly information is optional, jurisdiction-aware descriptive metadata and **never** permission to consume, purchase, transport or distribute cannabis.

420Travel remains responsible for broad destination/place/event discovery; 420BnB owns accommodation-specific inventory and reservation lifecycle when independently authorized. Existing `travel-compat/v1` objects are untrusted compatibility references, not a live BnB provider.

## 2. Actors, authority and separation

| Actor | Intended capabilities | Mandatory limitations |
| --- | --- | --- |
| Anonymous visitor | Search public listings, inspect public amenities/policies and approximate location; view publicly authorized ratings | Cannot read private addresses, identities, guest records, unpublished listings, quotes requiring identity or personal itineraries; cannot reserve |
| Guest | Maintain account/profile, save properties, request or instant-book eligible stays, view/pay/manage own bookings, message hosts, cancel under policy, raise disputes, review eligible stays | Cannot edit property, override inventory, change host payout, access other guests' reservations or publish verified-interaction evidence |
| Host | Create/verify controlled properties, edit own draft listings, publish only with authorization, manage own calendars/prices/policies, accept requests when allowed, view own reservations and payouts | Cannot self-verify identity/licensing, fabricate reviews, modify settled amounts, disclose guest data outside authorized service, or alter another host's inventory |
| Property manager | Manage delegated properties/calendars/reservations as scoped by verified owner | Revocable per-property delegation; no automatic ownership, custody, global host authority or unilateral financial adjustment |
| Moderator | Review reports/listing content, enforce app-scoped publication restrictions, record appeals | Cannot alter canonical Pay ledger, seize funds, grant Registry identity, rewrite reviews or impersonate hosts |
| Customer support | Assist parties via audited, least-privilege case workflow | No unrestricted booking edit, private-data export or payment authority |
| Administrator/operator | Configure independently approved app policy, monitor incidents, manage operational queues and records | No unrestricted wallet custody, protocol governance, Identity, Registry, Verify, Reputation or Pay authority |
| Protocol service adapter | Resolve identities, verified claims, payment finality, ratings, notifications and disputes | Must use approved typed interfaces and fail closed on stale/unavailable authority |

Ownership and management are distinct. Delegation must bind property IDs, capabilities, expiry/revocation and audit provenance. Roles alone never grant financial authority.

## 3. Complete intended product scope

### Guest experience
- Search by destination, date window, guest count, property class, price range, accessibility features, amenities and policy filters.
- Results present verified origin, transparent price basis, fees, availability freshness, approximate location and honest unavailable/loading/empty states.
- Inspect listing gallery, host/public verification claims, occupancy limits, check-in/out windows, cancellation terms, house rules, accessibility details and reputation.
- Save a property, compare possibilities and open a booking journey from 420Travel without creating an invisible reservation.
- Obtain a binding, expiring quote from authorized BnB pricing service; see asset/currency, chain, conversion terms if supported, fees, taxes and total before consent.
- Request booking or instant-book only according to verified listing policy; lock inventory atomically; show explicit pending/confirmed/failed/expired states.
- Pay through approved 420Pay authority; supported Swap route only when qualified and quoted; never represent a pending transaction as finalized.
- Receive explicit booking confirmation, stay instructions at the authorized time, notifications, cancellation/refund progress, receipts and dispute access.
- Submit a reputation review only on eligible interaction evidence; subject response and moderation follow 420Reputation.

### Host and property-manager experience
- Authenticate, establish controllable property, verify necessary identity/property/business claims through respective authorities, and invite scoped delegates.
- Draft, preview, publish/unpublish listings with property type, capacity, amenities, photos, availability, rate plans, minimum nights, deposits if separately authorized, legal house rules and local compliance claims.
- Manage calendars with blocked dates, maintenance closures, overlapping booking protections, multi-unit quantities and timezone/DST behavior.
- Receive inquiries/request-to-book actions; accept or decline only under permitted state transitions; prevent stale acceptance after hold expiry.
- View own reservations, cancellations, authorized payment status, independently finalized payouts and issues without raw guest credentials.
- Manage cancellation policies within governance-approved limits, handle disputes via separate Arbitration/Pay authority, respond to eligible reviews.
- Receive operational notifications; monitor verified listing performance without exposing guests' private records.

### Platform experience
- Review publication, property-claim, safety and regulatory reports with recorded decision and appeal.
- Keep moderation distinct from funds movement, ownership, protocol registry truth and reputation verification.
- Audit reservation holds, double-booking prevention, identity attribution, settlement events, disputes, data access and recovery procedures.
- Provide accessibility, translations/localization, support and discoverable policy explanations.

## 4. Canonical user journeys and acceptance boundaries

| Journey ID | Actor | Required journey | Negative / failure criterion |
| --- | --- | --- | --- |
| BNB-J01 | Visitor | Destination/date/guest search → permitted public listings → listing details | No private coordinates, personal addresses or unlisted inventory leaked via Search/Travel |
| BNB-J02 | Guest | Sign in → save listing → resume via 420Travel | Unauthorized cross-account read/write denied; stale withdrawn listings fail closed |
| BNB-J03 | Host | Verify authority → create listing draft → publish | Unverified or unlicensed claims never become verified publication |
| BNB-J04 | Manager | Property-scoped delegated invite → calendar edit | Revoked/expired/wrong-property delegation denied |
| BNB-J05 | Host | Configure dates, capacities and rules → guest searches availability | Contradictory block/reservation updates and concurrent double bookings rejected |
| BNB-J06 | Guest | Select dates → exact quote → agree policy → reservation hold | Stale price, unauthorized policy, expired hold, zero/overcapacity rejected |
| BNB-J07 | Guest | Approve eligible payment → Pay finality → booking confirmed | Unfinalized/replayed/wrong-asset/wrong-amount/wrong-booking Pay proof cannot confirm stay |
| BNB-J08 | Host | Receive request → accept or decline according to reservation state | Declined, cancelled, expired or superseded request cannot revive inventory |
| BNB-J09 | Guest | Cancel under bound policy → payout/refund accounting → completed state | Refund cannot exceed captured funds or move to substituted beneficiary |
| BNB-J10 | Host | View earned payout after authorized settlement | Host cannot self-award earnings or transfer funds from guest escrow |
| BNB-J11 | Guest/host | Submit support issue → Arbitration outcome → authorized settlement | Moderator/support decision alone cannot mutate payment custody |
| BNB-J12 | Guest | Stay completed → eligible verified review → host response | Fake interaction, unauthorized reviewer, edited reputation provenance rejected |
| BNB-J13 | Host | Mark cannabis-friendly features and onsite rules → guest views qualified descriptors | Descriptor cannot imply legal permission, product delivery or host regulatory certification |
| BNB-J14 | Operator | Reporting, takedown, appeal and restore | Moderator cannot change booked funds, identity authority or other property ownership |
| BNB-J15 | Guest/host | Outage, failed dependency or chain reorg → truthful recoverable status | No phantom booking, double payment, disclosed address or fabricated refund |
| BNB-J16 | Guest | Completed/confirmed booking → appropriate prearrival private details | Anonymous/public/unbooked viewers never receive exact private location or access instructions |

These are **future acceptance contracts**, not journeys certified as currently executable. Implementations must retain explicit test references and negative-path checks.

## 5. Booking policies requiring explicit decisions

The product must specify: property and multi-unit inventory identity; timezone/calendar handling; availability holds and expiration; price quote authority, totals and tax rounding; request-to-book versus instant booking; check-in/out and occupancy; listing/policy revision snapshots at booking; host cancellations/no-show/force-majeure; guest cancellations and refunds; damage deposits/insurance if authorized; dispute deadlines and authority; host payout timing and clawback; chargebacks/payment reversals; chain-finality/reorg consequences; privacy/data retention and erasure; fees, taxes, supported jurisdictions and supported asset routes.

BNB-1.2 defines these as mandatory product obligations. Precise states, invariants and authoritative models belong to BNB-1.3–1.6; unresolved choices must not be silently defaulted.

## 6. Cannabis-aware accommodation rules

A host may describe a property as cannabis-friendly and state independently reviewed policy detail (indoor/outdoor smoking, vaping, odor policies, age restrictions, accessible amenities, local regulations). Claims must distinguish host rules from applicable law and platform policy. No service may infer legal permission, guarantee compliance, promote unlawful transactions, or authorize delivery merely from listing tags. Legal/licensing/insurance suitability must be independently reviewed by jurisdiction before transaction enablement. Public searches do not expose exact private home locations.

## 7. Release-stage matrix

| Capability | Travel Genesis baseline | BnB testnet candidate | BnB production objective |
| --- | --- | --- | --- |
| BnB compatibility `Property/Host/Guest/Availability/NightlyPrice/Reservation` | Schema-only; non-binding | Replaceable, versioned adapter after approval | Production interface under qualified authority |
| Discovery/listing UI | Travel discovery only; no verified booking storefront | Test properties and qualified public search | Real host-controlled public listings |
| Identity/property publication | No BnB authority | Scoped staging integration, negative tests | Verified owners and property claims |
| Real inventory/booking | **DISABLED** | Simulated or approved testnet ledger, atomic holds, full negative tests | Enabled only after independent release decision |
| Native $420 settlement / Swap | **DISABLED** | Test asset and approved adapters only | Qualified Pay authority, supported routes, full receipts |
| Host escrow, cancellation settlement, deposits | **DISABLED** | Explicitly approved test flows only | Separately approved custody, refunds, payouts and recovery |
| Reviews / notifications | Generic Travel and shared service boundaries | App-specific verified adapters | Authenticated and provenance-preserving integrations |
| Cannabis-aware descriptors | Informational only | Policy enforcement rehearsed | Jurisdiction-approved operations and disclosures |

**Release gates:** code complete != build qualified != testnet ready != Genesis authorized != production ready. A Genesis/catalog promotion or financial feature authorization needs an explicit applicable governance decision; this document is not one.

## 8. Requirement traceability and downstream owners

| Requirement ID | Priority | Owner step | Required coverage |
| --- | --- | --- | --- |
| BNB-P01 Guest discovery/listings | Core | BNB-1.3, 1.6–1.7 | J01–J02 |
| BNB-P02 Host property onboarding/publishing | Core | BNB-1.3–1.4, 1.7–1.8 | J03 |
| BNB-P03 Property manager delegation | Core | BNB-1.3–1.4, 1.8 | J04 |
| BNB-P04 Availability and overlap prevention | Core | BNB-1.3, 1.6 | J05–J06 |
| BNB-P05 Binding quotes and guest consent | Core | BNB-1.3, 1.5–1.6 | J06 |
| BNB-P06 Request/instant booking lifecycle | Core | BNB-1.3, 1.6 | J06–J08 |
| BNB-P07 Pay and route finality | Core | BNB-1.4–1.5 | J07, J15 |
| BNB-P08 Cancellations, refunds, payouts | Core | BNB-1.3, 1.5–1.6 | J09–J10 |
| BNB-P09 Verified reviews, disputes, support | Core | BNB-1.4, 1.8 | J11–J12 |
| BNB-P10 Cannabis-sensitive metadata and legal gates | Core | BNB-1.8 | J13 |
| BNB-P11 Moderation and audit boundaries | Core | BNB-1.4, 1.8 | J14 |
| BNB-P12 Private location and stay details | Core | BNB-1.6, 1.8 | J01, J16 |
| BNB-P13 Operational recovery, concurrency, monitoring | Core | BNB-1.6, 1.9 | J05, J15 |
| BNB-P14 Accessible responsive guest/host flows | Core | BNB-1.7 | J01–J16 |
| BNB-P15 Signed, versioned typed integrations | Core | BNB-1.4, 1.6 | J01–J16 |
| BNB-P16 Exact-SHA qualification, release docs | Core | BNB-1.9–1.10 | All journeys |

All P requirements are the intended full-product definition. None is falsely claimed implemented by this specification.

## 9. Explicit deferred and non-goals

- Genesis booking, host escrow, cancellation settlement, damage deposits, insurance and dynamic pricing remain disabled under `config/420travel-genesis.json`.
- 420BnB will not become a payments protocol, canonical Identity/Registry/Verify owner, Reputation truth oracle, general Travel destination authority, or DOOBR cannabis-delivery execution service.
- No booking, refund, verified host status, reservation hold, chain confirmation, user account or compliant accommodation is invented from illustrative data.
- Off-chain listing images, addresses, personal information and guest instructions do not become public chain data.
- Cross-chain, fiat and advanced dynamic pricing are not presumed available; each route requires separate explicit approval/qualification.

## 10. BNB-1.2 exit criteria

1. Intended users and distinct trust boundaries are enumerated.
2. Full guest/host/manager/moderator/admin workflows and failure paths are specified.
3. Product obligations trace to stable requirement IDs and 16 user journeys.
4. Genesis vs testnet vs production capabilities are separated without changing actual authority.
5. Cannabis-aware information remains descriptive, consent-based, legally bounded and privacy-preserving.
6. All unresolved booking/payment/review/compliance decisions are assigned to existing BNB steps, without renumbering.
7. App-specific validator passes at exact source SHA; no unrelated global CI is substituted.
8. BNB-1.1 remains preserved; BNB-1.3 — Domain Model and State Machines is next.

**Pending independent approvals:** frozen catalog promotion, live payment/settlement/custody authority, regional rental licensing and cannabis-related platform compliance. These do not block documenting this product contract, but block applicable runtime enablement.
