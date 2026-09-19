# GEN-SVC-4 — 420Classifieds Genesis MVP

## Purpose

GEN-SVC-4 builds the Genesis-facing person-to-person marketplace for users who want to sell without creating a formal storefront.

The global nature of $420 does not make local classifieds difficult: the payment/network layer can be global while listing discovery, pickup, delivery and jurisdiction remain local application concerns.

## GEN-SVC-4.1 — Listing schema

Each listing supports:
- title;
- description;
- category;
- condition;
- price;
- supported asset/reference;
- seller;
- location mode;
- delivery modes;
- photos;
- status.

Listing lifecycle:
`DRAFT -> ACTIVE -> RESERVED -> SOLD`, with `CANCELLED` and moderation-driven `REMOVED` states.

A listing is application content, not canonical protocol state.

## GEN-SVC-4.2 — Local/remote fulfillment modes

Genesis supports:
- local pickup;
- local delivery;
- shipping;
- digital delivery.

Location is resolved through 420Location. Exact private residential coordinates are not required for public listing discovery.

## GEN-SVC-4.3 — Search and regional discovery

Filters:
- text;
- category;
- condition;
- price;
- region;
- radius;
- delivery mode;
- seller.

Sorting:
- relevance;
- newest;
- price;
- distance.

Public Search indexes only public/eligible listings and must respect visibility and jurisdiction restrictions.

## GEN-SVC-4.4 — Messenger integration

Buyer/seller contact uses 420 Messenger.

A listing conversation may carry:
- listing reference;
- buyer/seller identity;
- offer/counteroffer events;
- delivery discussion;
- transaction completion evidence.

Messenger does not gain payment or listing ownership authority.

## GEN-SVC-4.5 — Seller reputation

Seller profiles consume 420Reputation in the `CLASSIFIEDS` domain.

Support:
- review summary;
- verified interaction markers;
- seller history;
- subject responses where appropriate.

Subjective star ratings remain off-chain. Objective completion/payment evidence may reference exact 420Trust metrics.

## GEN-SVC-4.6 — Favorites and saved discovery

Users may:
- favorite listings;
- save searches;
- subscribe to search alerts.

Saved/private state stays outside public indexing.

## GEN-SVC-4.7 — Search alerts

420 Notifications may notify users of:
- new listing matches;
- price changes;
- accepted/countered offers;
- reserved/sold status;
- seller/buyer message events.

Notifications never execute offers, payments or escrow actions.

## GEN-SVC-4.8 — Offers and counteroffers

Offer lifecycle:
`OPEN -> COUNTERED -> ACCEPTED | DECLINED | WITHDRAWN | EXPIRED`.

Acceptance creates transaction intent only. It does not move funds or authorize wallet operations.

Offer writes must be idempotent/replay-resistant.

## GEN-SVC-4.9 — Optional 420Pay escrow

Genesis supports optional escrow for remote shipping/digital transactions.

Rules:
- local cash/in-person transactions may remain off-chain;
- Classifieds never custodies wallet keys;
- escrow release/refund follows authoritative payment/escrow rules;
- Arbitration is used only where a supported dispute flow exists;
- UI status must be derived from authoritative settlement state.

## GEN-SVC-4.10 — Sold/reserved lifecycle

Listings can be:
- active;
- reserved;
- sold;
- cancelled;
- removed.

`SOLD` is a listing state, not independent proof that a payment settled.

## GEN-SVC-4.11 — Jurisdiction/category restrictions

The application must support:
- category-level restrictions;
- region-level restrictions;
- age-restriction metadata;
- fail-closed handling of prohibited/high-risk categories.

Availability logic is an application control and does not replace legal/compliance review.

## GEN-SVC-4.12 — Fraud/reporting controls

Support:
- report listing;
- report seller;
- block seller;
- duplicate/fingerprint detection;
- suspicious listing flags;
- moderation review;
- evidence handoff to Arbitration only when an authoritative dispute exists.

Moderation cannot seize funds or rewrite canonical payment/identity state.

## GEN-SVC-4.13 — Search indexing

420 Search indexes public listing projections with:
- listing ID;
- seller reference;
- category;
- price;
- delivery modes;
- approximate region/distance metadata;
- status;
- provenance.

Private message/offer details are not search-indexed.

## GEN-SVC-4.14 — Genesis UI

Required routes:
- `/classifieds`
- `/classifieds/search`
- `/classifieds/listing/:listing_id`
- `/classifieds/create`
- `/classifieds/edit/:listing_id`
- `/classifieds/seller/:seller_id`
- `/classifieds/messages`
- `/classifieds/offers`

## GEN-SVC-4.15 — End-to-end qualification

Required journeys:
1. seller posts -> public search;
2. buyer discovers -> messages seller;
3. buyer makes offer -> seller counters/accepts;
4. accepted in-person deal -> completion without required on-chain payment;
5. accepted remote deal -> optional escrow settlement;
6. completed transaction -> verified review eligibility;
7. private location remains hidden;
8. prohibited category fails closed;
9. duplicate settlement action is rejected;
10. Search/index rebuild does not mutate listing ownership/payment/reputation state.

## Exit criteria

GEN-SVC-4 passes when local discovery, messaging, offers, optional escrow, seller reputation, moderation and jurisdiction controls compose without creating new wallet, payment, Registry, Arbitration, Identity or Trust authority.

## Next phase

After monolithic qualification and merge, proceed to **GEN-SVC-5 — 420Media expansion**.
