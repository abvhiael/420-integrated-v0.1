# High Country — Expansion-ready deployments and atomic utility settlement V1

## New deployment standard
- Do **not** change founding Genesis or its original 1–3-only RegionRegistry.
- Fresh LandRegistry and GrowerProfileRegistry constructors accept the existing `exists(uint16)` interface; for new deployments inject `CompositeRegionMembership(founding,expansion)` as their region registry argument. This is a deployment-level adapter, not a rewrite of the founding contracts.
- Existing immutable registries **cannot** be replaced without explicitly migrating parcel/profile state, permissions, plant and rights references; no claim of automatic in-place migration is made.
- For a new region stage/qualify its independent immutable release content and scoped grants before `open`; region slots in `expansion-region-catalogue.v1.json` are only conceptual suggestions.

## Resource issuance limits
`RegionalUtilities` now enforces immutable **per region, per asset lifetime issuance** ceilings: 1,000,000,000 mL water and 100,000,000 Wh power, with per-operation issuance ceilings of 1,000,000 mL water and 100,000 Wh energy. All values are *technical containment caps*, not claims about balanced gameplay or physically backed water/energy sources. Issued-minus-spent equals outstanding supply; issued values never decrease, so consumption cannot reset the lifetime cap. Issuance still requires region-scoped authorization. Source provenance and separate independent provisioning approvals are deployment conditions.

## Atomic environmental effect path
`RegionalEnvironmentSettlement` provides a single Solidity transaction coupling water/energy burns with `CultivationEngine.updateEnvironment`. A failure in the environment update or a utility debit reverts the whole transaction and its replay marker. Its coordinator requires an independently secured backend plus precise utility consume/cultivation update capabilities. The settlement contract **does not independently** verify weather provenance, plant location, equipment eligibility, rate quote, protected ownership, or environmental delta. The trusted coordinator must enforce these before calling; this is not yet sufficient for direct untrusted-player submission.

The policy examples specify one 100-point water adjustment per 1,000 mL and one 100-point environmental control adjustment per 250 Wh, but per-equipment attribution, device efficiency and real-time weather are additional approved content. Never equate arbitrary client snapshots with a paid device effect.

## Expansion content registry
`expansion-region-catalogue.v1.json` contains nine named fictional candidates, principal and supporting settlements, four districts each, three landmarks each, geography, local identity, seasonal climate baseline and proposed version names. All nine remain **CONCEPT_ONLY_LOCKED** with land creation prohibited and no Genesis contents or release authority inferred.

## Deployment acceptance
Require scoped contract integration tests, immutable migration rehearsal, founding-vs-expanded consumer equivalence, atomic debit/update rollback, issuance-cap and replay adversarial tests, canonical content hashes, permission approvals, and testnet chain/receipts. The roadmap's Level 3 global suites are *not* part of this ordinary step.
