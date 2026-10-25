# HC-NEXT-5.4 — Original Sixteen rewards and collection persistence
**Canonical rules:** 16 founder journeys and 64 fragment unlocks. Complete four distinct fragments via primary or equivalent accessible activities to earn four persistent founder awards: revelation, cosmetic Archive Edition, nontransferable Founder Seal, and museum entry. Completing all founders grants Keeper of the Original Sixteen, Master Founder Seal, and Museum Exhibition record.

## Durability and audit
All collection progression, source event replay markers, entitlement awards and append-only attribution records commit in the same PostgreSQL SERIALIZABLE state transaction. An immutable founder fragment is awarded once per registered account. A primary and accessible route target the same fragment; attempting the other route cannot award again. One-time founder and master records have stable IDs, with source event ID, operation ID and event timestamp retained per award. Account snapshots expose an auditable view. No wallet, BUDS, payment, genetic or competitive modifier is required.

## Visuals and museum world
Reward persistence never reads artwork availability. The 221-piece artwork specification remains in `deployments/highcountry/original-sixteen-art-inventory.v1.json`. The A06 manifest now checks all 64 previously deferred files at their canonical paths, publishes only valid assets with SHA-256 metadata, and includes verified pieces in the static gallery bundle. Missing media remains deferred and cannot block reward issuance. Assets uploaded under a different folder must be mapped to the canonical filenames before publication. **Do not gate achievements on unfinished museum-world renders**, or assume the named archive images have been verified at the documented canonical file paths. No artwork is minted by this step.

## Acceptance
- 64 fragment records, 64 founder collectible/revelation records, 3 master records = 131 independent audit entries and 67 discrete entitlement IDs per fully completed player.
- Signed issuer activity, single-consumption event ID, operation replay exclusion, revoked account session rejection and cross-player isolation.
- Level 1 `node --test test/discovery-integration.test.js` and affected economy Level 2 `npm test`, plus retained real-Postgres integration and browser qualification for regression.
- No Level 3 rerun unless phase closeout; no global documentation repair.
**Remaining production gates:** genuine trusted event issuer sources, restart/concurrent real PostgreSQL reward proof, and approved graphics in the actual game release tree.
