# High Country — future region expansion and water/energy policy V1

Adopted: Founding RegionRegistry remains exactly three-region Genesis-only; later releases MUST NOT mutate its roots. RegionExpansionRegistry provides a **non-integrated staging/opening primitive** for IDs >=4, immutable release commitments of metadata, climate, ruleset and land policy, exact region-scoped authorization and a finalized-Genesis prerequisite.

**Not yet end-to-end implemented:** LandRegistry, PlantRegistry, profile, world/readiness, SDK and other consumers only recognize the founding registry. A future integration must explicitly update them to honor expansion-open status and prevent land creation while staged/closed, respecting previously held property. Until then no expansion region is playable.

The companion `region-resource-policy.v1.json` records three proposed summer six-control profiles and version names. It establishes water accounting in integer millilitres and electricity in integer watt-hours, with conserved nonnegative balances as the accepted design. Per-device consumption, weather transitions, rate conversions, server-side atomic ledgers and official content hashes remain UNAPPROVED and are explicitly null; those systems are not simulated or deployed. No harvest, yield, genetics or wallet-based bonuses are introduced. Actual on-chain ruleset IDs require `RulesetRegistry.deriveRulesetId(contentHash)`, not hashing names. This is design implementation and an isolated future-registry primitive, not completed operational irrigation/energy integration.

R07.2 founding data approval and prefinalization release readiness remain OPEN. No global qualification requested.
