# GEN-SVC-2 — 420Location, Maps & 420Events Foundation

## Purpose

GEN-SVC-2 establishes the reusable geographic and event layer consumed by 420Travel, 420Classifieds, 420Grow, 420Commerce, 420Jobs and other applications. It does not create a new geographic authority or put map/search data on-chain.

420Location is a replaceable application service. 420Events is a replaceable event/discovery service. Canonical protocol ownership remains with the owning Registry, Identity, payment, booking, rights or governance subsystem.

## GEN-SVC-2.1 — Geospatial schema

Define country, region/province/state, city, postal region, latitude/longitude, service radius and precision classification.

Rules:
- exact coordinates are appropriate for public businesses, venues and attractions;
- private users/residences may use approximate regions;
- private coordinates never become public by default;
- public discovery cannot increase source precision.

## GEN-SVC-2.2 — Place registry

Define a stable `Place` object independent of any single map provider.

Required object classes include business, venue, attraction, dispensary, hotel, rental, restaurant, farm, event location and service provider.

Where a place corresponds to a canonical 420 Registry record, preserve that linkage and provenance. An application-created place does not become a protocol Registry record merely by appearing on a map.

## GEN-SVC-2.3 — Geospatial search

The shared query contract supports:
- near point;
- within radius;
- within region;
- bounding box;
- near route;
- category filters;
- event date ranges;
- nearby events.

Indexes are rebuildable projections and are not canonical location state.

## GEN-SVC-2.4 — Mapping provider abstraction

Expose provider-neutral capabilities for:
- geocoding;
- reverse geocoding;
- map tiles;
- routing;
- place lookup.

Provider IDs are aliases/provenance only. Canonical `place_id` values cannot depend on one vendor.

## GEN-SVC-2.5 — 420Events schema

Every event defines:
- organizer;
- title;
- start/end;
- timezone;
- visibility;
- status;
- optional place/location;
- optional capacity;
- optional ticket reference;
- optional tags/age restrictions;
- optional media;
- optional 420Calendar reference.

Supported lifecycle:
`DRAFT -> SCHEDULED -> LIVE -> ENDED`, with `CANCELLED` available from pre-terminal states.

Cancellation is append/history preserving; it does not erase the event.

## GEN-SVC-2.6 — Event discovery

Support:
- nearby;
- today;
- date range;
- category/tag;
- destination/region;
- followed organizer/community;
- public venue/place.

Discovery is non-authoritative. Ownership and event lifecycle remain with the event service/organizer.

## GEN-SVC-2.7 — Location privacy

The service must:
- support coarse search;
- permit approximate public locations;
- apply visibility before indexing;
- avoid precise-location logging by default;
- avoid publishing private residential coordinates;
- never infer public location from private Calendar/Mail/Messenger state.

## GEN-SVC-2.8 — Registry/Verify integration

A place or organizer may expose:
- Registry record reference;
- verification status;
- organization identity;
- service/app provenance.

Verified provenance is not an endorsement or quality score. Reputation belongs to 420Reputation/420Trust.

## GEN-SVC-2.9 — Shared map/event UI contract

Reusable UI surfaces should support:
- map/list hybrid;
- pin clustering;
- place cards;
- distance display;
- event cards;
- date filters;
- save/follow actions;
- external route handoff;
- verified/provenance badges.

The frontend must distinguish exact public locations from approximate areas.

## GEN-SVC-2.10 — Shared API + qualification

The first stable service APIs use the GEN-SVC-0 conventions:
- `/v1`;
- cursor pagination;
- RFC3339 UTC timestamps;
- opaque IDs;
- explicit provenance;
- signed/replay-protected write callbacks where used.

### Required qualification scenarios

1. public verified business appears in regional and radius search;
2. approximate/private location never exposes exact coordinates;
3. provider swap leaves canonical `place_id` stable;
4. public event appears in date/nearby discovery;
5. cancelled event remains addressable but is removed from active discovery;
6. event timezone survives normalization correctly;
7. Search/index destruction and rebuild does not mutate Registry or organizer state;
8. unauthorized user cannot edit another organizer's event;
9. private event is absent from public Search/geospatial indexes;
10. Registry/Verify provenance is displayed without being treated as a reputation score.

## Exit criteria

GEN-SVC-2 passes when the shared place/event schemas, privacy rules, query semantics, provider abstraction and integration boundaries validate cleanly and can be consumed by GEN-SVC-3 420Travel and GEN-SVC-4 420Classifieds without defining their own incompatible location systems.

## Next phase

After monolithic qualification and merge, proceed to **GEN-SVC-3 — 420Travel Genesis MVP**.
