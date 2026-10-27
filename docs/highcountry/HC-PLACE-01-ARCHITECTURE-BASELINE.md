# HC-PLACE-01 — placement architecture baseline and authority contract

Status: **FOUNDATION DOCUMENTED; LEVEL 1 NOT YET QUALIFIED**. Read against main `d135b6954684b4ac29dc597510fdb9c2d4724a81` on 2026-10-27. Do not treat client catalogue guards as placement authority.

## Existing implementation and classification

| Surface | Observed source | Assessment |
| --- | --- | --- |
| High Country browser marketplace | `apps/highcountry-web/src/marketplace.js` | Client renders existing inventories/catalogues and authenticated market requests; no established durable world placement route. |
| Asset placement metadata | HC-ART-03 and HC-ART-04 catalogue source/tests, several still in open PRs | Catalogue/preview only; guards fail closed pending geometry, ownership and authoritative server validation. |
| Ordinary BUDS / market serializable storage | `services/highcountry-economy/src/postgres-store.js`, `src/market.js` | Existing SERIALIZABLE, row-locked economy transaction authority. Reuse or integrate; do not duplicate balances/inventory. Existing schema does not demonstrate placed-object state. |
| Terrain and parcel access | `scripts/highcountry/hc-world-02-parcel-access.mjs`; `docs/highcountry/HC-WORLD-02-PARCEL-TERRAIN-ACCESS-VALIDATION.md` | Bounded fail-closed road, frontage/easement and parcel admission merged via #876. Real owner-approved terrain and full 31,260 parcel admission remain outstanding. |
| Exhaustive survey evidence | PR #878, reconciliation PR #882 | Pending; do not claim complete physical survey or merge/modify its files here. |
| Movement, collision, wall/tabletop slots | Existing client catalogue claims only observed | Authoritative durability and integrated enforcement **unverified/absent in audited paths**; require source-backed confirmation before promotion. |

## Contract: `highcountry-placement-v1` (proposed; no runtime enabled)

The 64px tile is the **logical** gameplay coordinate basis. Sprite dimensions, transparent bounds and render anchor MUST NOT determine physical occupancy. Store world-space versioned integer coordinates scoped by region, parcel, building and room. All identifiers are immutable or explicitly revisioned. A placement record shall include `instanceId`, `assetId`, `ownerPrincipal`, `parcelId`, optional `buildingId`/`roomId`, `regionId`, `surface`, `layer`, integer `gridX`/`gridY`, `orientation`, `renderAnchor`, `maskId`, `maskVersion`, optional `parentInstanceId`/`slotId`, `revision`, `createdAt`, `updatedAt`, `state` and `validationVersion`. Audit history references canonical operation IDs rather than rewriting history.

Surfaces are typed: `floor`, `outdoor_ground`, `wall_slot`, `tabletop_slot`, `shelf_slot`. Only floors and approved outdoor ground reserve floor navigation geometry. Wall and tabletop instances hold exclusive slots and zero standalone floor footprint; child transforms derive from authoritative parent/slot and orientation. Geometry versions separately define visual bounds, floor collision polygons or tile masks, interaction envelopes, fire envelopes and traversable-path classification. Unsupported geometry/orientation/asset/slot fails closed.

Commands: `place`, `move`, `rotate`, `remove`, `attach`, `detach`, `snapshot`, and a read-only `validatePreview`. Mutations require authenticated registered principal, stable scoped idempotency key, expected scene revision and affected instance revisions. The server looks up ownership, marketplace/issuance provenance, legal parcel permission, terrain, collision masks and parent-slot occupancy itself. A retry with the same command ID and same canonical payload returns its recorded result; mismatched payload is rejected. Competing placement claims serialize and cannot both succeed.

Placement state, inventory reservations, occupancy/slots, revisions and operation receipts must commit or roll back together on a durable authoritative backend. If economy and world state cannot share a trusted atomic unit, placement **must remain disabled** pending a reconciliation/escrow protocol; never claim cross-database atomicity. On restart, rebuild occupancy from durable instance records, verify mask/contract versions and reject corrupt or mismatched state. Server-calculated collision, route continuity, environmental clearance and movement are the only decisions capable of mutating gameplay; browser previews have no authority.

## Dependency map and work ownership

1. **HC-PLACE-02** specifies and tests versioned records, surfaces and masks; imports approved catalogue identifiers without modifying them.
2. **HC-PLACE-03** owns the single durable transaction/operation boundary and inventory coordination; no client inventory authority.
3. **HC-PLACE-04** owns qualified footprints, rotation and occupancy claims; a prerequisite for placement enablement.
4. **HC-PLACE-05/06** build parallel wall and tabletop attachment lanes on 02–04, sharing exclusive-slot and parent policy.
5. **HC-PLACE-07/10** validate fire and recreation envelopes using 04, independently of cosmetic inventory.
6. **HC-PLACE-08** consumes HC-WORLD-02 evidence; must not promote synthetic cadastral layouts to legal access.
7. **HC-PLACE-09** uses exactly the occupancy and parcel rules from 04/08 for authenticated movement.
8. **HC-PLACE-11** integrates backend APIs; previews are advisory only.
9. **HC-PLACE-12** reconciles exact-SHA bounded L1/L2/L3 evidence, asset manifests, deferred work and merge history.

## Active-PR isolation

At this baseline, open PRs include #859 (04-A), #872 (04-B), #877 (04-D), #879 (04-E), #881 (04-F), #853/#855/#856 (wall/tabletop catalogue), and #878/#882 (terrain survey). Several touch shared `marketplace.js` and asset source. **No shared application or CI file should be changed from this branch** without first checking each PR diff and latest main. No marketplace ID, price, owner, or inventory semantics are changed here.

## Level 1 exit gate (NOT MET)

- Verify current main and all applicable PR SHAs at qualification time.
- Inventory all placement, terrain, economy, browser, persistence, movement and spatial policy implementations from current source.
- Add executable bounded contract tests confirming 64px semantics, no client authority, no unqualified placement, and explicit ownership/transaction boundaries.
- Obtain successful scoped Level 1 workflow at exact resulting SHA; preserve passing unrelated CI without manual reruns.
- Record workflow/run/job IDs and hashes in follow-up evidence, and reconcile any pending catalogue/terrain conflicts before authorizing HC-PLACE-02.

No production placement endpoint or client behavior is enabled by this architecture document.
