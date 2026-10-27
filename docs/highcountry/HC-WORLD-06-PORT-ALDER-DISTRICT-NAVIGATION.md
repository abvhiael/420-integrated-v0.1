# HC-WORLD-06 — Port Alder district navigation contracts (design layout)

## Scope
First town-navigation milestone under the locked world-map navigation hierarchy: region → town/rural overview → neighbourhood/road segment → property → interior.

Source: `deployments/highcountry/hc-world-06-port-alder-district-navigation.v1.json`.
Contains 13 immutable districts, canonical IDs, labelled map targets, local-tile polygon boundaries, entrances, reciprocal shared-edge adjacency, and five logical country exits. All destination links are served in the browser via `/port-alder` and `/port-alder/district/HC-EC-S01-DXX`. The user can click district labels and travel to adjacent district placeholders. The map-data JSON is copied into the public app build. Protected O16 site coordinates are not copied or exposed.

District names: Cliffside, North Ridge, Cedar Heights, Westwood, Eastward, Harbour Heights, Old Town, Civic District, Market District, Riverside, Port District, Industrial Yard, South Point.

## Qualification boundary
This is a **functional route-directory and provisional 1,200×780 local layout**, not final surveyed polygons traced from the approved painted overview. Rendering interactive clickable polygons *over that reference artwork* requires registration of an actual source image, image-to-tile control points, coast/terrain exclusions, raster overlay and final municipal polygon review. Until then public interaction is provided via accessible district labels. The neighbourhood scenes are placeholders; their own street layouts, parcels and entrances are future HC-WORLD-06/07 tasks.

Country exits are recorded but tagged `ROUTE_CONTRACT_PENDING_PHYSICAL_CONNECTION`; clicking them must not imply physical travel until connecting rural route maps pass verification. No titles issued, no land ownership changed, no 420Corp parcel size chosen. Civic properties remain subject to later town design.

Validation checks polygon bounds, absence of overlaps, distinct IDs/labels/scenes, entrances inside polygons, shared-edge reciprocal neighbours, total graph connectivity, exit integrity and non-disclosure flag. Owner-approved geographic certification is **not** implied by passing Level 1.
