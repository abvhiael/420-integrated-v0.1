# HC-NEXT-7.2 — Ordinary exhibitions

## Account-only authority
Ordinary exhibitions are deliberately separated from R04.12's address-based on-chain events. They use independently authenticated **registered issuer accounts**, not client-submitted account IDs, browser guest IDs, wallet addresses or optional wallet entitlements. Guest play remains available outside authoritative exhibition submission. Optional wallet competitions retain their existing distinct R04.12 scope.

The service module `services/420-gaming-player-profile/src/highcountry-ordinary-exhibitions.js` accepts an issuer identity verifier, a canonical finalized FLOWER harvest verifier and a durable **serializable transactional repository**. No mock harvest or local preview is sufficient for live results.

Season organizers must own the season; immutable versioned categories must explicitly be wallet-free and match their rules hash. Registration is once per registered account, within the event window, capped at 128. One independently finalized FLOWER harvest per entrant, no pre-event evidence, no duplicate harvest per event, and no wallet/stat multiplier. Independent adjudicators may reject within the seven-day maximum challenge period. Finalization re-verifies the exact provenance hash, account, quality, harvest and finality time, tolerating revoked/reorged candidates by exclusion. Ranking is highest quality, then earliest finalization, then lexical canonical harvest ID; no valid result produces null winner. Finalization is single-use.

## Implemented adapters

- `highcountry-ordinary-postgres.js` supplies PostgreSQL transactions with SERIALIZABLE isolation, database uniqueness constraints, immutable harvest evidence rows, account/event/game scoped queries and database-controlled adjudication.
- `migrations/010_highcountry_ordinary_exhibitions.up.sql` provides additive schema, uniqueness, foreign keys, score constraints and limited runtime DML privileges. `migrateOrdinaryExhibitions420` checks migrator-role membership and a recorded migration hash; `scripts/migrate-ordinary-exhibitions.mjs` requires `GAMING_DATASTORE_MIGRATION_URL`.
- `highcountry-cloud-http.js` exposes POST `/highcountry/exhibitions/{create,enter,submit,reject,finalize,status}` through existing issuer-token/origin/game authorization. Exact allowed body fields are checked; player account IDs are never accepted for entry/submission.
- Browser cloud client and account panel permit authenticated profile registration and verified harvest submission without wallet connection. No local guest preview is canonical proof.

## Integration and deployment preconditions

Provision immutable versioned seasons/categories using an authorized operator and review their published rules hashes. Instantiate `createOrdinaryExhibitions420` with `createPostgresOrdinaryExhibitionRepository420`, an approved issuer-backed `identity.verify(token)` that confirms the registered game profile and revocation, and an independently qualified canonical `harvest.verifyFinalizedFlower({accountId,harvestId})` verifier. Supply this instance as the optional `ordinaryExhibitions` argument to the cloud HTTP service. Live production credentials, official canonical harvest verifier/address binding, operational issuer authorization and deployment have **not** been verified by this PR. Do not enable endpoints without those bindings.

Level 1 covers versioned-policy, entry, timing, replay, forged evidence, adversarial finality, HTTP spoofing and a real PostgreSQL transaction/migration journey; Level 2 requires independent production-equivalent issuer/harvest finality integration at the deployed API and recovery testing. Do not describe unit fixtures as proof of actual blockchain or game-server finality.

No prize, token transfer, wallet proof, unverified local harvest or paid scoring advantage is implied. Scope is ordinary exhibition admission/results only.
