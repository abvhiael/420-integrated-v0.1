# GEN-SVC-3 — 420Travel Genesis MVP

## Purpose

GEN-SVC-3 builds the first user-facing 420Travel application over the qualified 420Location, 420Events and 420Reputation layers.

Genesis 420Travel is deliberately a discovery and planning product, not yet a full Expedia/Airbnb transaction system.

## GEN-SVC-3.1 — Travel application shell

Provide:
- destination search;
- nearby discovery;
- saved places;
- saved events;
- saved trips;
- primary Travel navigation.

The Travel shell consumes shared services rather than creating new location, event or reputation authorities.

## GEN-SVC-3.2 — Map/list experience

The primary discovery view supports:
- map/list hybrid;
- pin clustering;
- distance-aware results;
- category filters;
- region and nearby search;
- event overlays;
- mobile-responsive switching between map and list.

Map/provider data remains non-canonical and provider-neutral through 420Location.

## GEN-SVC-3.3 — Place pages

Every place page should expose:
- canonical/stable `place_id`;
- name/category;
- location and precision;
- Registry provenance where available;
- Verify status where available;
- photos;
- hours/contact/services;
- review summary;
- nearby/upcoming events;
- cannabis-aware attributes where relevant.

Verification is provenance, not endorsement.

## GEN-SVC-3.4 — Travel review experience

Travel reviews consume 420Reputation in the `TRAVEL` domain.

Support:
- 1–5 ratings;
- review text and photos off-chain;
- verified-interaction marker;
- review replies from the subject/business;
- moderation/reporting;
- versioned edits where supported by 420Reputation.

Subjective ratings never become canonical 420Trust truth. Objective interaction evidence may reference exact 420Trust metrics.

## GEN-SVC-3.5 — Events integration

420Travel consumes 420Events for:
- destination events;
- nearby events;
- date filters;
- event-place linking;
- organizer provenance;
- saved-event/trip integration.

Travel does not own the authoritative event lifecycle.

## GEN-SVC-3.6 — Cannabis-aware travel attributes

Genesis supports descriptive attributes such as:
- cannabis-friendly;
- onsite consumption rules;
- nearby dispensary;
- cannabis event;
- grow-related attraction.

These are informational attributes and must not be presented as legal advice, guaranteed permission, or jurisdictional compliance.

## GEN-SVC-3.7 — Trip collections

Users may create `Trip` collections containing places and events.

Support:
- private;
- unlisted;
- public.

A trip collection is planning metadata only; it does not create reservations or payment obligations.

## GEN-SVC-3.8 — Business/place claims

A business or organization may claim a place page.

The claim flow may bind:
- 420 Identity;
- Registry record;
- Verify provenance.

Claiming a page:
- does not create a new Registry record automatically;
- does not grant protocol authority;
- does not manufacture reputation;
- does not allow rewriting user reviews.

## GEN-SVC-3.9 — 420BnB and DOOBR compatibility hooks

Genesis reserves compatibility schemas but keeps transaction flows disabled.

### 420BnB reserved objects
- Property
- Host
- Guest
- Availability
- NightlyPrice
- Reservation

### DOOBR reserved objects
- ServiceProvider
- ServiceArea
- DeliveryWindow
- ServiceRequest

At Genesis these are schema/interface hooks only. No accommodation booking, host escrow, delivery transaction, cancellation settlement or dynamic pricing authority is enabled.

## GEN-SVC-3.10 — Travel UI qualification

Required routes:
- `/travel`
- `/travel/map`
- `/travel/place/:place_id`
- `/travel/events`
- `/travel/trips`
- `/travel/business/claim`

Required qualification journeys:
1. destination search -> place page;
2. nearby discovery -> event;
3. place -> verified travel review;
4. business claim -> Registry/Verify provenance;
5. private trip -> absent from public indexing;
6. BnB booking path -> unavailable/fails closed;
7. DOOBR transaction path -> unavailable/fails closed.

## Exit criteria

GEN-SVC-3 passes when:
- Travel composes Location, Events and Reputation without duplicating their authority;
- the Genesis discovery/planning UI contract is defined;
- place/event/review provenance is explicit;
- private trip data cannot leak into public discovery;
- cannabis-aware attributes are descriptive only;
- 420BnB and DOOBR schemas are forward-compatible but transaction flows remain disabled.

## Next phase

After monolithic qualification and merge, proceed to **GEN-SVC-4 — 420Classifieds**.
