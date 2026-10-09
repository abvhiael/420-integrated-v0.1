# High Country — R01.3 canonical types, units and compatibility

Status: normative `highcountry-state-v1` schema specification. This defines transport and compatibility boundaries; it does not change contract ABI/storage or implement the missing production SDK/services. Source definitions remain immutable compatibility inputs. See [architecture](ARCHITECTURE-AND-AUTHORITY.md), [scope](RELEASE-SCOPE.md) and [roadmap](RECONCILIATION-AND-BUILDOUT-ROADMAP.md).

## Canonical transport schema

A state document uses schemaVersion `highcountry-state-v1`, authorityDomain (`LOCAL_GAME_STATE`, `REGISTERED_GAME_STATE`, `CANONICAL_ECOSYSTEM_STATE`), gameId, rulesetId and an object identity. Identity includes objectType, id, authorityDomain; canonical objects additionally include chainId and contractAddress. IDs in different domains/contracts are never interchangeable. Local/service objects cannot acquire canonical authority by changing an envelope field: promotion follows verified migration/issuance (R01.4).

JSON integers are base-10 strings without exponent, leading plus, whitespace or leading zeroes (except `0`); signed negative zero is rejected. This applies to IDs, time, chain ID, quantities and measurements, preventing JavaScript Number precision loss. Values must fit source signedness/width before ABI encoding; zero admissibility is contract/object-specific, not inferred from a type. bytes32 values are exactly 32 bytes as lowercase 0x-prefixed hex; addresses are exactly 20 bytes, normalized lowercase for transport and checksum-validated where checksummed input is used. No hash algorithm or ABI field order is changed by this schema.

Enum transport is `{ namespace, ordinal, name }`, with ordinal a decimal string. All three must match the source catalogue below. Missing/unknown namespace, ordinal or conflicting name fails closed. One schema supports separate source namespaces; names such as ACTIVE in different enums do not imply identical semantics. Never persist a UI label as a canonical capability state. Optional unavailable information is explicit null, never a fabricated enum default.

Timestamps are Unix UTC seconds and durations are seconds; uint64 bounds apply to existing HC timestamps. Wall clock display time and chain-finalized time are distinct. Never infer finality from timestamp. Genomes contain exactly 28 bytes32 loci in source order; zero-locus admissibility follows registry validation. Ruleset IDs, content IDs, hashes and commitments are opaque bytes32, not human names.

## Lifecycle reconciliation

PlantRegistry V1 is authoritative for actual cultivation stages. Frozen GrowthStage and PlantState are separate vocabularies, not ABI aliases. Preserve the exact PlantStage plus any future lifecycle record separately.

| PlantStage ordinal/name | GrowthStage semantic projection | PlantState projection | Reverse conversion |
|---|---|---|---|
| 0 NONE | 0 NONE | 0 NONE | Only if object existence is known; nonexistent is not an active plant |
| 1 GERMINATION | 1 PROPAGATION | 1 ACTIVE | PROPAGATION alone cannot choose germination vs seedling; reject ambiguous reverse |
| 2 SEEDLING | 1 PROPAGATION | 1 ACTIVE | Preserve original stage; same ambiguity |
| 3 VEGETATIVE | 2 VEGETATIVE | 1 ACTIVE | Stage name exact; ACTIVE alone insufficient |
| 4 FLOWERING | 3 FLOWERING | 1 ACTIVE | Stage name exact; ACTIVE alone insufficient |
| 5 READY | null | 2 HARVESTABLE | READY is readiness, not evidence of MATURATION or successful harvest |
| 6 TERMINATED | null | 4 TERMINATED | Termination does not prove HARVESTED; require actual future harvest receipt |

These are display/compatibility projections, not new legal transitions. GrowthStage MATURATION and PlantState HARVESTED have no exact HC-6 source stage. They must not be invented during conversion. PlantRegistry READY→TERMINATED currently has no harvest outcome. HC-7 must supply separate authoritative harvest status. Breeding/Randomness frozen enums similarly are not used as runtime stored states: retain actual booleans and request IDs. Random request exists/unfulfilled maps to REQUESTED, fulfilled/unconsumed to FINALIZED, consumed to CONSUMED; reject consumed without fulfilled or flags without exists. COMMITTED/INVALIDATED cannot be inferred. Existing breeding exists/not finalized indicates RANDOMNESS_PENDING, finalized indicates FINALIZED; FINALIZABLE needs actual request evidence, and CANCELLED has no current path.

## Temperature and measurement reconciliation

Canonical temperature transport uses signed integer `temperatureMilliC` (one thousandth °C). Existing HC-6 EnvironmentSnapshot.temperature is uint16 **centi-degree Celsius**, valid 1000..4000, ideal 2000..2800. Convert to milliC by multiplying by 10; convert back only when divisible by 10 and quotient is in 1000..4000. Reject fractional centi-degrees, negative/out-of-range values, overflow and implicit rounding. Examples: 2500→25000, 1000→10000, 4000→40000; 25001, -1000, 9990, 40010 reject. No clamping.

HC-6 humidity/light/water/nutrients/airflow are uint16 controls in 0..10000; keep explicit names humidityControl1e4, lightControl1e4, waterControl1e4, nutrientsControl1e4, airflowControl1e4 in transport. Humidity control is numerically relative humidity basis points, but light is not PPFD, nutrients not EC and airflow not physical velocity. No physical conversion exists without a versioned ruleset. stressBps/qualityBps are 0..10000 and sum to 10000; source score truncates each integer dimension calculation then divides the summed deviations by six. Preserve exact source arithmetic and environment field order when reproducing expression hashes.

BasisPoints/Normalized1e4 use scale 10000, probability PPM scale 1000000, Multiplier1e4 scale 10000 and Wad scale 10^18. Storage width alone does not prove semantic bounds. QualityScore range and EC physical scale are not defined by their type declaration; transports must carry ruleset/unit metadata and reject unspecified physical conversion. MassMg, VolumeMl, PowerW and EnergyWh mean mg, ml, W and Wh; PhMilli means pH×1000; humidity Bps means percent×100. R01.6 defines integer BUDS with zero decimals, FLOWER grade thresholds and floor-rounded harvest mass; BUDS is not Wad or convertible native $420. New operations specify rounding explicitly before accepting balances.

## Access reconciliation

| Solidity AccessState | Client projection | Meaning / reverse rule |
|---|---|---|
| 0 GUEST | guest | Core/local play; no wallet/account requirement |
| 1 REGISTERED | registered | Service-account features; no wallet requirement |
| 2 WALLET_CONNECTED | wallet-linked | Contract access class; client linkage is not present connectivity or verified permission |
| 3 ECOSYSTEM_PARTICIPANT | wallet-linked | Lossy UI projection; ecosystem authorization must remain separate |

Retain independent booleans registered, walletLinked, walletConnected and verified capability/entitlement evidence; default UI state remains current SDK behavior (linked first, then registered, then guest). A disconnected linked wallet retains `wallet-linked` display but wallet actions request reconnect. Neither walletLinked nor walletConnected can establish ECOSYSTEM_PARTICIPANT. Reverse conversion from wallet-linked is unresolved until verified identity/permission context supplies the exact contract access class. Existing SDK REGISTERED requirement accepts a linked state even if registered=false; this is UI policy only, never proof of an authenticated cloud-save session. Service endpoints must authenticate separately. R01.2 internal marketplace is registered-service authority; existing MARKETPLACE capability remains canonical ecosystem trading.

## Frozen source catalogue

All ordinals are zero-based and preserved. Planned enum vocabulary does not establish implemented lifecycle transitions. Width catalogues specify ABI representation, not all gameplay validation.

### `contracts/src/highcountry/types/HighCountryEnums.sol`

- GrowthStage: 0=NONE, 1=PROPAGATION, 2=VEGETATIVE, 3=FLOWERING, 4=MATURATION.
- PlantState: 0=NONE, 1=ACTIVE, 2=HARVESTABLE, 3=HARVESTED, 4=TERMINATED.
- BreedingState: 0=NONE, 1=COMMITTED, 2=RANDOMNESS_PENDING, 3=FINALIZABLE, 4=FINALIZED, 5=CANCELLED.
- EquipmentState: 0=NONE, 1=ACTIVE, 2=DEGRADED, 3=BROKEN, 4=RETIRED, 5=RECYCLED.
- ListingState: 0=NONE, 1=ACTIVE, 2=PARTIALLY_FILLED, 3=FILLED, 4=CANCELLED, 5=EXPIRED.
- LeaseState: 0=NONE, 1=OFFERED, 2=ACTIVE, 3=COMPLETED, 4=TERMINATED, 5=CANCELLED.
- LicenseState: 0=NONE, 1=ACTIVE, 2=EXPIRED, 3=REVOKED, 4=TRANSFERRED.
- ProposalState: 0=NONE, 1=PENDING, 2=ACTIVE, 3=DEFEATED, 4=SUCCEEDED, 5=EXECUTABLE, 6=EXECUTED, 7=EXPIRED, 8=CANCELLED.
- SeasonState: 0=NONE, 1=SCHEDULED, 2=ACTIVE, 3=CLOSED, 4=FINALIZED.
- CompetitionState: 0=NONE, 1=SCHEDULED, 2=OPEN, 3=CLOSED, 4=RANDOMNESS_PENDING, 5=FINALIZABLE, 6=FINALIZED, 7=CANCELLED.
- RandomnessState: 0=NONE, 1=REQUESTED, 2=COMMITTED, 3=FINALIZED, 4=CONSUMED, 5=INVALIDATED.
- UpgradeState: 0=NONE, 1=PROPOSED, 2=QUALIFIED, 3=SCHEDULED, 4=ACTIVE, 5=DRAINING, 6=RETIRED, 7=REJECTED.
- MissionState: 0=NONE, 1=ELIGIBLE, 2=ACTIVE, 3=COMPLETE, 4=CLAIMED, 5=FAILED, 6=EXPIRED.
- AuthorityClass: 0=OWNER, 1=SESSION, 2=DELEGATE, 3=ORGANIZATION, 4=COOPERATIVE, 5=MODULE, 6=SECURITY_COUNCIL, 7=UPGRADE_AUTHORITY, 8=GENESIS_AUTHORITY.
- RiskClass: 0=R0, 1=R1, 2=R2, 3=R3, 4=R4.

### `contracts/src/highcountry/cultivation/PlantRegistry.sol`

- PlantStage: 0=NONE, 1=GERMINATION, 2=SEEDLING, 3=VEGETATIVE, 4=FLOWERING, 5=READY, 6=TERMINATED.

### `contracts/src/gaming/access/ProgressiveGamingTypes.sol`

- AccessState: 0=GUEST, 1=REGISTERED, 2=WALLET_CONNECTED, 3=ECOSYSTEM_PARTICIPANT.
- StateAuthority: 0=LOCAL_GAME_STATE, 1=REGISTERED_GAME_STATE, 2=CANONICAL_ECOSYSTEM_STATE.
- Capability: 0=CORE_GAMEPLAY, 1=LOCAL_SAVE, 2=CLOUD_SAVE, 3=CROSS_DEVICE_RECOVERY, 4=STANDARD_LEADERBOARD, 5=WALLET_EXCLUSIVE_CONTENT, 6=ECOSYSTEM_REWARDS, 7=VERIFIED_OWNERSHIP, 8=CROSS_GAME_INTEROPERABILITY, 9=MAJOR_TOURNAMENTS, 10=MARKETPLACE, 11=GENETICS_LICENSING, 12=TRANSFERABLE_ASSETS.

### `contracts/src/highcountry/types/HighCountryTypes.sol`

| Type | ABI representation |
|---|---|
| GrowerProfileId | uint64 |
| ModuleId | bytes32 |
| RegionId | uint16 |
| LandParcelId | uint64 |
| PublicPlotId | uint64 |
| GenomeId | bytes32 |
| BreedingEventId | uint64 |
| SeedLotId | uint64 |
| CloneId | uint64 |
| MotherId | uint64 |
| PhenotypeId | bytes32 |
| PlantId | uint64 |
| HarvestId | uint64 |
| EquipmentId | uint64 |
| EquipmentTypeId | uint32 |
| RecipeId | uint32 |
| ManufacturingJobId | uint64 |
| OrganizationId | uint64 |
| CooperativeId | uint16 |
| ProposalId | uint64 |
| ListingId | uint64 |
| LicenseId | uint64 |
| LeaseId | uint64 |
| RightId | uint64 |
| SeasonId | uint32 |
| CompetitionTemplateId | bytes32 |
| CompetitionId | uint64 |
| CompetitionScore | uint128 |
| RulesetId | bytes32 |
| RandomRequestId | bytes32 |
| MissionId | bytes32 |
| ResearchNodeId | uint32 |
| ResearchProgress | uint32 |
| DiscoveryId | uint64 |
| SkillTrackId | uint8 |
| AchievementId | uint32 |
| BasisPoints | uint16 |
| PPM | uint32 |
| Wad | uint256 |
| Normalized1e4 | uint16 |
| ProbabilityPpm | uint32 |
| Multiplier1e4 | uint32 |
| QualityScore | uint16 |
| MassMg | uint64 |
| VolumeMl | uint64 |
| PowerW | uint32 |
| EnergyWh | uint64 |
| TemperatureMilliC | int32 |
| RelativeHumidityBps | uint16 |
| LightPpfd | uint32 |
| Co2Ppm | uint32 |
| PhMilli | uint16 |
| EC | uint32 |

## Compatibility, migration and validation

Existing Solidity enum ordinals, tuple field order, signedness, widths, event encoding, source hash domains and storage remain unchanged. Legacy snapshots must identify their source schema/unit; untagged temperature or lifecycle integers are quarantined for explicit source identification, never guessed. Decode using the original source ABI, preserve the raw source value, then normalize to this schema. Lossy projections cannot be written back or used as migration evidence. Unknown schema versions fail closed on writes; display may show an unsupported-version error and offer export/recovery.

Migration stages are decode → validate source schema/ranges → normalize exact units/IDs → attach source evidence → validate destination rules → commit idempotently. Failed/ambiguous conversion leaves the original save intact; no partial resource/asset creation. Semantic schema changes require a new version plus explicit forward/backward compatibility and rollback policy. R01.4 defines authorization/manifest/claim state machines; R05 implements real transport adapters and schema validation. This specification does not rewrite historic saves or claim deployed compatibility testing.

Level 1 acceptance: catalogue agrees with all named source enums/types; exact temperature vectors and rejection boundaries verified; lifecycle projections preserve lossiness; access tests verify linked/disconnected behavior without promotion; references and inventory hashes valid; patch scope is docs-only. R01.7 reviews accumulated specification consistency. Next: R01.4 — Migration boundaries.

- PlantSourceKind: 0=NONE, 1=SEED, 2=CLONE.
