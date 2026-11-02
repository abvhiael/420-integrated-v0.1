# HC-ART-02 — Comfort, Furniture Lifecycle and Resale (design v1)

Status: design metadata and non-authoritative pure validation logic added to PR #839; no live inventory, pricing, provenance, artwork, wear timer, transaction, or entitlement implementation.

## Scope
All 78 HC-ART-02 proposed base designs remain in scope: A seating (12), B greenhouse lounge (10), C outdoor patio (12), D tables/desks (10), E rugs/textiles (10), F entertainment/recreation (12), G premium/regional (12). A's 12 design records are in `src/seating-design-catalog.js`.

## Classification and lifecycle
Five descriptive quality labels: secondhand, used, good, restored, heirloom. Underlying numeric wear is 0–100; the restored label requires verified restoration with low wear. Heirloom requires server-attested provenance or achievement and cannot be acquired merely by repeatedly repairing an item. Wear accrual, repair resource cost, upgrade eligibility, material quality, and artwork overlays remain future server design work.

## Workspace arrangements and caps
`src/furniture-rules.js` models six arrangements: break corner, grower lounge, botanical sanctuary, patio retreat, heritage lounge, restored collection. Four capped preview modifiers: comfort<=20, morale<=12, workspace<=15, value<=30. Duplicate design tags contribute base comfort once; placed, unreserved, undamaged items alone can count. Bonuses must be bounded and non-authoritative, must not create cultivation rights or economic balances, and need authoritative evaluation and persistence before release. Arrangement tags need authenticated room grouping, spatial validity, environment compatibility, and actual item ownership in a later milestone.

## Resale contract
A furniture instance must have a trusted unique ID, confirmed owner, canonical SKU, condition/wear state, upgrade history, and region-neutral history. Before listing, remove from active placement and suspend bonuses; reject duplicate listings, reserved goods, nontransferables, and forged instance IDs. Server atomically reserves, transfers and settles with BUDS, with independent receipts, expiry/cancellation return, disputes, and no minting via client code. Asking prices are player-defined; suggested estimates are not guaranteed valuations. The existing authenticated ordinary marketplace must be extended by backend service changes before live sale or retail issuance.

## Art requirements
Export source design art at approved visual perspective, transparent backgrounds, condition overlays and regional variants as selected; 64×64 is a **logical ground tile** and is independent of 1024×1024 art exports. All floor furniture uses bottom-center image anchors and per-instance 64px logical footprint. No image is claimed uploaded for HC-ART-02 yet. The image file path for each item must be verified before publication into runtime browse UI.

## HC-ART-02-A design-stage canonical folder
`apps/highcountry-web/public/assets/cultivation/props/comfort-furniture/sofas-seating/` (create only when approved PNGs are available).
