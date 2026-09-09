# SC-2.1 — CardDefinition schema and identity model

Status: FROZEN
Ruleset dependency: SC-1 V1 ruleset freeze
Branch: feature/420-gaming-smoke-chrome

## 1. Purpose

SC-2.1 defines the canonical gameplay identity and schema for Smoke & Chrome card definitions. A `CardDefinition` is the authoritative rules object used by deck validation, match setup, deterministic simulation, replay, AI, tooling, and later collection/printing layers.

A CardDefinition is not a collectible printing, token, NFT, wallet asset, serial, foil, cosmetic skin, marketplace item, or ownership record.

The canonical separation is:

`CardDefinition -> Edition -> Printing`

Only the CardDefinition may define competitive gameplay semantics.

## 2. Canonical identity

Every CardDefinition MUST have a stable immutable `definitionId`.

Recommended canonical shape:

```text
sc:<rulesetMajor>:<namespace>:<slug>
```

V1 examples:

```text
sc:1:founders:chrome-jackal
sc:1:founders:black-market-clinic
sc:1:founders:northern-lights-genome
```

Identity rules:

1. `definitionId` is immutable once released into a ruleset manifest.
2. Display name changes do not change `definitionId`.
3. Alternate art, rarity, foil, frame, serial, provenance, language and ownership never change `definitionId`.
4. A materially different gameplay object receives a new `definitionId`.
5. A balance revision that changes competitive semantics MUST be represented by ruleset-version pinning and a new content revision or definition identity according to the release policy; live matches never silently reinterpret an already pinned definition.
6. `definitionId` comparison is byte-for-byte exact after canonical normalization.

## 3. Required top-level schema

A V1 CardDefinition MUST expose the following canonical fields.

```ts
interface CardDefinitionV1 {
  schemaVersion: "sc-card-definition-v1";
  definitionId: string;
  revision: number;
  contentHash: string;

  name: string;
  rulesText?: string;

  cardType: CardTypeV1;
  subtypes: string[];
  faction: FactionIdV1 | "NEUTRAL";
  unique: boolean;

  deck: DeckLegalityV1;
  cost: ResourceCostV1;
  stats?: CombatStatsV1;
  leader?: LeaderProfileV1;
  cultivation?: CultivationProfileV1;
  attachment?: AttachmentProfileV1;

  abilities: AbilityRefV1[];
  tags: string[];
}
```

The schema is declarative. Arbitrary executable code is not part of the CardDefinition format.

## 4. Canonical card types

`cardType` MUST be exactly one SC-1.5 primary type:

- `LEADER`
- `OPERATIVE`
- `INFRASTRUCTURE`
- `GENETIC`
- `OPERATION`
- `GEAR`
- `CONTRABAND`

`CHROME` is not a primary type. It is represented as a `GEAR` subtype.

Example:

```json
{
  "cardType": "GEAR",
  "subtypes": ["CHROME", "CYBERNETIC"]
}
```

## 5. Faction identity

`faction` MUST be either:

- one canonical faction identifier, or
- `NEUTRAL`.

A baseline V1 CardDefinition does not carry multiple native factions.

Cross-faction deck access is expressed by deterministic legality permissions outside the card's native faction identity rather than mutating `faction` at runtime.

## 6. Deck legality object

```ts
interface DeckLegalityV1 {
  allowedInMainDeck: boolean;
  allowedAsLeader: boolean;
  defaultCopyLimit: number;
  restricted?: boolean;
  banned?: boolean;
  legalityTags?: string[];
}
```

Baseline rules:

- ordinary non-Unique Main Deck cards default to copy limit `3`;
- Unique cards default to copy limit `1`;
- Leader definitions MUST have `allowedAsLeader=true`;
- Leader definitions MUST NOT enter the 50-card Main Deck unless a later explicit ruleset allows it;
- legality remains ruleset/version scoped.

A collectible printing cannot alter legality.

## 7. Resource cost object

```ts
interface ResourceCostV1 {
  flow?: number;
  flower?: number;
  data?: number;
  heat?: number;
}
```

Rules:

1. Omitted fields equal zero.
2. Values are non-negative integers.
3. `heat` represents Heat added/incurred as a play/activation cost where explicitly defined; Heat is not interchangeable mana.
4. Costs are paid atomically under SC-1.4.
5. No cost field may reference wallet balances, NFT rarity, serial numbers, account age, marketplace price or chain wealth.

## 8. Combat stats

```ts
interface CombatStatsV1 {
  power: number;
  armor: number;
  durability: number;
}
```

Only card classes permitted by the ruleset may expose combat stats.

Rules:

- all values are integers;
- baseline printed values are non-negative;
- runtime modifiers are match-state effects and do not mutate the CardDefinition;
- collectible metadata cannot modify POWER, ARMOR or DURABILITY.

## 9. Leader profile

Leader-only data belongs in a typed `leader` profile.

```ts
interface LeaderProfileV1 {
  startingStability?: number;
  factionLock?: FactionIdV1 | "NEUTRAL";
  passiveAbilityRefs?: string[];
}
```

Any omitted starting Stability uses the ruleset default.

Leader-specific deck permissions must remain deterministic and inspectable by the validator.

## 10. Cultivation profile

Genetics and other explicitly cultivation-aware cards may define:

```ts
interface CultivationProfileV1 {
  baseYieldFlower?: number;
  growthModifier?: number;
  harvestAbilityRefs?: string[];
  cultivationTags?: string[];
}
```

Rules:

- lifecycle remains SC-1.8 authoritative;
- CardDefinitions may modify allowed parameters only through declared abilities/profile fields;
- they cannot create hidden alternate growth clocks or ambient nondeterminism.

## 11. Attachment profile

Cards that attach to another object MUST declare attachment legality.

```ts
interface AttachmentProfileV1 {
  attachToTypes: CardTypeV1[];
  attachToSubtypes?: string[];
  maxPerHost?: number;
  detachPolicy?: "DISCARD" | "EXILE" | "RETURN_TO_HAND";
}
```

If `attachment` is absent, the card cannot attach unless another authoritative effect explicitly creates a temporary attachment relationship.

Attachment legality is revalidated under SC-1.5 and SC-1.6.

## 12. Abilities

Abilities are referenced, not embedded as arbitrary script text.

```ts
interface AbilityRefV1 {
  abilityId: string;
  mode: "STATIC" | "TRIGGERED" | "ACTIVATED" | "RESOLUTION" | "REPLACEMENT";
  timing?: string;
}
```

`abilityId` MUST resolve through a versioned canonical ability registry in later SC-2 work.

A CardDefinition may contain human-readable `rulesText`, but engine behavior is determined by the canonical ability representation, not by parsing prose.

## 13. Subtypes and tags

`subtypes` are rules-addressable classifications such as:

- `CHROME`
- `CYBERNETIC`
- `GROWER`
- `ENFORCER`
- `LAB`
- `VEHICLE`
- `STRAIN`

`tags` are canonical machine-readable labels for filtering, content tooling and rules references.

Both arrays MUST be canonicalized:

- no duplicates;
- stable lexical ordering when serialized;
- normalized case according to registry rules;
- unknown values fail validation in strict competitive manifests.

## 14. Revision and content hash

Each definition carries:

- `revision`: monotonically increasing integer for authored content revisions under the same permitted identity policy;
- `contentHash`: cryptographic digest of canonical serialized gameplay content.

The digest MUST exclude collectible-only metadata.

Competitive match manifests pin exact definition revisions and hashes.

A mismatch between expected and loaded `contentHash` MUST fail closed before match start.

## 15. Canonical serialization

Canonical serialization MUST produce identical bytes for semantically identical definitions.

Requirements:

1. UTF-8.
2. Stable field ordering.
3. Stable array ordering where order is not semantically meaningful.
4. No insignificant numeric representation differences.
5. No timestamps in the canonical gameplay object.
6. No platform-specific paths or UI state.
7. Unknown competitive fields fail validation unless explicitly namespaced as non-authoritative metadata and excluded from the gameplay digest.

## 16. Explicitly forbidden CardDefinition fields

The gameplay CardDefinition MUST NOT contain competitive dependencies on:

- wallet address;
- owner identity;
- NFT token ID;
- serial number;
- mint number;
- rarity tier;
- foil status;
- frame/skin;
- provenance;
- marketplace price;
- chain balance;
- account age;
- staking amount;
- edition supply;
- printing scarcity;
- off-chain purchaser status;
- random seed material;
- wall-clock timestamps.

These belong elsewhere or are forbidden inputs to gameplay.

## 17. Validation reason codes

SC-2.1 establishes stable validation categories for malformed definitions. Exact implementation codes may be extended, but baseline categories include:

- `SC_CARD_SCHEMA_UNSUPPORTED`
- `SC_CARD_ID_INVALID`
- `SC_CARD_REVISION_INVALID`
- `SC_CARD_HASH_MISMATCH`
- `SC_CARD_TYPE_INVALID`
- `SC_CARD_FACTION_INVALID`
- `SC_CARD_SUBTYPE_INVALID`
- `SC_CARD_COST_INVALID`
- `SC_CARD_STATS_INVALID`
- `SC_CARD_DECK_LEGALITY_INVALID`
- `SC_CARD_ABILITY_REF_INVALID`
- `SC_CARD_FORBIDDEN_GAMEPLAY_METADATA`

Competitive validation fails closed.

## 18. SC-2.1 invariants

### SC-INV-CD-001 — Stable identity
A released CardDefinition has one stable canonical `definitionId`.

### SC-INV-CD-002 — Definition/printing separation
No Edition or Printing property can alter CardDefinition gameplay semantics.

### SC-INV-CD-003 — Ruleset pinning
A match resolves cards only against its pinned ruleset manifest and pinned definition hashes.

### SC-INV-CD-004 — Deterministic serialization
The same canonical CardDefinition serializes to identical bytes on all conforming implementations.

### SC-INV-CD-005 — Hash integrity
A competitive match cannot start with a definition whose loaded content hash differs from its manifest.

### SC-INV-CD-006 — Declarative authority
Human-readable rules text is non-authoritative where it conflicts with canonical structured ability data.

### SC-INV-CD-007 — Wallet neutrality
Wallet, ownership and collectible metadata cannot influence CardDefinition stats, costs, abilities, legality or probability.

### SC-INV-CD-008 — Type closure
Every V1 CardDefinition belongs to exactly one canonical primary card type.

### SC-INV-CD-009 — Explicit attachment legality
Persistent attachment behavior must be declared or created by an explicit authoritative effect.

### SC-INV-CD-010 — No ambient entropy
CardDefinitions cannot embed or request ambient randomness outside SC-1.11 RNG calls.

### SC-INV-CD-011 — Immutable match semantics
Once a match starts, its pinned CardDefinitions cannot change for the lifetime of the match.

### SC-INV-CD-012 — Competitive fail closed
Malformed, unknown or integrity-failing competitive definitions are rejected rather than guessed, repaired or silently downgraded.

## 19. SC-2.1 closeout

SC-2.1 is complete when the project has a single authoritative CardDefinition identity and schema contract suitable for:

- deck validation;
- deterministic match loading;
- replay;
- AI simulation;
- Founders Set authoring;
- later Edition/Printing ownership layers;
- content hashing and manifest pinning.

This document freezes that contract for V1.

## 20. Next step

SC-2.2 — canonical ability/effect representation and registry.
