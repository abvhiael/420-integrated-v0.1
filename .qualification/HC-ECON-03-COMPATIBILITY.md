# HC-ECON-03 — Building Functions and Exact Equipment Compatibility

Scope: canonical HC-ECON-00 requirement E15 (T-BLD-01), following HC-ECON-01 taxonomy and HC-ECON-02 durable issuance. No new manufacturing or resource-processing rules are added (those belong to HC-ECON-08).

## Implemented contract
- `services/highcountry-economy/src/building-compatibility.js` exports a versioned, SHA-256-bound, deterministic reviewed registry of building-type functions, revision-pinned equipment slots and **exact permitted equipment type IDs**. Only existing qualified HC-ECON-01 types may appear in a qualified slot.
- An equipment slot has a function, surface, layer, exact qualified type-ID list and maximum occupancy. A qualified building revision cannot be inferred from a display name, client-provided class, or an unreviewed equipment tag. Every slot is checked against both the building's allowed functions and HC-PLACE layers/surfaces.
- The server-side equipment check requires exact HC-PLACE-02 placement and geometry validation, live item ownership/state, catalog/revision integrity, qualified HC-ECON-01 modifier outcome, slot assignment and occupancy caps. Missing or incompatible records fail closed.
- Functional results cap ordinary modifiers by HC-ECON-01 role caps; developer modifiers that duplicate an existing functional effect are rejected, while separately authorized quest modifiers retain their distinct budget. The adapter does not invent unapproved gameplay effects or modify immutable item modifiers.
- `BuildingCompatibilityService` requires a registered authoritative placement/equipment reader and refuses to return a compatibility result when authenticated building access or server-owned item/placement verification fails. Caller-provided flags alone cannot authorize this reader. The actual privileged reader must independently authenticate revocations, custody and canonical receipts.

## Boundaries
- HC-PLACE-03/04 retain exclusive geometry placement, transactional inventory custody, ownership transfer and durable placement mutations. This package is a read-only compatibility policy and adapter, not a second placement authority.
- HC-ECON-02 owns issuance, verified randomness and burn; HC-ECON-03 consumes its immutable item outcomes and never rerolls them.
- Equipment registry contract `contracts/src/highcountry/equipment/EquipmentRegistry.sol` remains unchanged; no fake deployment or new on-chain equipment role was added.
- The proposed `GET /econ/buildings/:id/compatibility` is served by the authenticated adapter once the authoritative HC-PLACE runtime provides the real readers; no public endpoint is activated or represented as deployed from this standalone policy.
- Actual asset-by-asset building function registration and authorization for live HC-WORLD rooms is dependent on reviewed building IDs and authoritative placement integration; unqualified buildings and unknown types always reject.

## Qualified minimum tests
T-BLD-01: exact qualified compatible slots, caps, existing item policy, active placement geometry, absence of duplicate instances, owner/parcel/building binding, tampered registry, wrong revisions, unqualified assets, quest/origin mismatch, revoked reader and nonstacking. Run `node --test services/highcountry-economy/test/building-compatibility.test.js`, plus HC-ECON-01 taxonomy and HC-PLACE-02 geometry regressions only if integration changes require them.

Historical passing HC-ECON-01/02 evidence remains attached to its original implementation SHA; no global or Level 3 requalification.
