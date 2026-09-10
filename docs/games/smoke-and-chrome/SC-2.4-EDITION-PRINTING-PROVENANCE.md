# SC-2.4 — Edition / Printing collectible model and provenance boundary

Status: frozen for V1 asset model

## Purpose

SC-2.4 defines the collectible layer that sits strictly outside authoritative competitive gameplay.

The canonical relationship is:

`CardDefinition -> Edition -> Printing`

`CardDefinition` is the sole source of gameplay identity and rules. `Edition` and `Printing` describe collectible presentation, supply and provenance only.

## 1. Edition model

An `Edition` is an immutable collectible release definition that references exactly one canonical `CardDefinition` revision.

Required fields:

- `editionId`: stable globally unique identifier
- `cardDefinitionId`: referenced gameplay identity
- `cardDefinitionRevision`: pinned gameplay revision
- `editionCode`: human-readable release/set code
- `editionNumber`: deterministic ordinal within the release
- `rarity`: collectible rarity label only
- `artVariantId`: presentation/art identity
- `frameVariantId`: optional frame treatment
- `finishPolicy`: permitted physical/digital finishes (standard, foil, chrome, etc.)
- `maxSupply`: optional immutable supply ceiling
- `mintPolicyId`: reference to an approved mint policy
- `metadataHash`: canonical hash of edition metadata
- `createdAt`: provenance metadata only; never gameplay input

An Edition MUST NOT contain gameplay fields such as POWER, ARMOR, DURABILITY, costs, abilities, faction legality, deck limits, RNG modifiers, resource modifiers, matchmaking weight or progression rate.

## 2. Printing model

A `Printing` is one minted collectible instance of an Edition.

Required fields:

- `printingId`: stable globally unique collectible identifier
- `editionId`: parent Edition
- `serialNumber`: deterministic serial within Edition, when serialized
- `finish`: one value permitted by the Edition finish policy
- `mintSequence`: monotonic mint-order value
- `mintTxRef`: chain/mint provenance reference where applicable
- `mintedTo`: original recipient reference where permitted
- `currentOwnerRef`: ownership reference resolved outside the match engine
- `provenanceHash`: canonical provenance commitment
- `status`: `ACTIVE`, `BURNED`, `LOCKED`, or equivalent registry-approved state

A Printing MUST NOT override or extend the referenced CardDefinition's gameplay behavior.

## 3. Collectible rarity

Rarity is collectible metadata only.

Baseline labels may include:

- COMMON
- UNCOMMON
- RARE
- EPIC
- LEGENDARY
- PROMO

Rarity MAY affect:

- pack collation
- visual treatment
- marketplace discovery
- collection milestones
- cosmetic prestige
- mint supply

Rarity MUST NOT affect:

- deck legality unless CardDefinition legality itself says so
- card statistics
- costs
- abilities
- draw odds inside a match
- RNG outcomes
- turn priority
- match speed
- ranking weight
- matchmaking priority
- tournament seeding
- progression rate

## 4. Finish and variant semantics

Foil, chrome, holo, alternate-frame, signed, numbered, animated or other presentation variants are collectible-only traits.

Two Printings that reference the same CardDefinition revision are competitively identical, regardless of:

- rarity
- art
- frame
- finish
- serial
- provenance
- wallet owner
- purchase price
- marketplace history
- mint date
- supply scarcity

## 5. Provenance boundary

Provenance is authoritative for ownership and collectible history, but non-authoritative for gameplay.

Permitted provenance inputs include:

- mint transaction reference
- registry/contract identity
- edition supply
- serial
- current owner
- transfer history commitment
- burn/lock state
- authenticity attestation

The match engine MUST NOT consult provenance to determine competitive behavior.

## 6. Ownership resolution

Ownership MAY be required for collection, marketplace, tournament-prize or scarce-cosmetic features.

Ownership MUST NOT be required for baseline guest play.

Where a game mode permits a player to present owned Printings, the pre-match deck resolver MUST reduce every submitted Printing to its referenced `CardDefinitionId + revision` before gameplay state is created.

The runtime object model from SC-2.3 MUST NOT carry wallet addresses, token IDs, marketplace value, provenance history, serials or rarity in authoritative match state.

## 7. Deck equivalence

For competitive validation:

`Printing A -> Edition X -> CardDefinition D@r`

and

`Printing B -> Edition Y -> CardDefinition D@r`

are the same card for:

- copy limits
- deck legality
- Unique enforcement
- faction validation
- gameplay hashing
- replay identity

Collectible duplication never increases the legal copy limit beyond SC-1.10.

## 8. Mint policy

A `MintPolicy` MAY define:

- maximum supply
- mint windows
- pack allocation
- promotional allocation
- prize allocation
- founder/reserved allocation
- burnability
- transferability
- reveal timing

Mint policy MUST NOT modify the associated CardDefinition.

Changes to mint policy after issuance MUST be versioned and provenance-auditable. They MUST NOT retroactively mutate existing gameplay identity.

## 9. Pack and reveal boundary

Future pack systems may select Editions/Printings using collectible RNG.

Pack RNG is not match RNG.

Pack opening, reveal order, rarity selection and mint allocation MUST use a separate domain and MUST NOT consume, reseed or influence SC-1.11 match RNG state.

## 10. Marketplace boundary

Marketplace state MAY include price, listing status, seller, buyer, royalties and settlement references.

Marketplace state MUST remain outside CardDefinition, authoritative runtime objects, match manifests and replay hashes.

A card's market value can never alter its competitive value.

## 11. Burn, lock and escrow semantics

A Printing may be burned, locked, escrowed or otherwise unavailable at the collectible layer.

These states MAY affect whether the collectible can be transferred, sold, claimed or presented as an owned collectible.

They MUST NOT retroactively invalidate a match already initialized from a valid pinned CardDefinition manifest.

Competitive ownership checks, if a future mode requires them, occur before match initialization and are then frozen for that match.

## 12. Canonical serialization

Edition and Printing records MUST use deterministic canonical serialization for hashing and provenance commitments.

Rules:

- stable field names
- stable field ordering
- normalized identifiers
- normalized enum casing
- no locale-dependent values
- no floating-point values in authoritative supply/serial fields
- hashes computed over canonical bytes only

## 13. Fail-closed validation

Malformed collectible records MUST fail closed for ownership/provenance operations.

Stable error categories SHOULD include:

- `UNKNOWN_CARD_DEFINITION`
- `UNKNOWN_CARD_REVISION`
- `INVALID_EDITION_ID`
- `INVALID_PRINTING_ID`
- `INVALID_RARITY`
- `INVALID_FINISH`
- `SUPPLY_LIMIT_EXCEEDED`
- `SERIAL_COLLISION`
- `PROVENANCE_HASH_MISMATCH`
- `MINT_POLICY_VIOLATION`
- `INVALID_PRINTING_STATUS`

A collectible-layer failure MUST NOT silently mutate gameplay state.

## 14. SC-2.4 invariants

### SC-INV-2.4-001 — gameplay neutrality
Edition or Printing metadata MUST NOT change competitive gameplay behavior.

### SC-INV-2.4-002 — definition pinning
Every Edition references exactly one CardDefinition identity and revision.

### SC-INV-2.4-003 — printing ancestry
Every Printing references exactly one Edition.

### SC-INV-2.4-004 — no collectible fields in runtime authority
Authoritative match objects MUST NOT contain rarity, serial, wallet, market or provenance data.

### SC-INV-2.4-005 — printing equivalence
Printings resolving to the same CardDefinition revision are competitively identical.

### SC-INV-2.4-006 — copy-limit neutrality
Owning more Printings cannot increase SC-1.10 deck copy limits.

### SC-INV-2.4-007 — rarity neutrality
Rarity cannot affect legal gameplay statistics, abilities, RNG or ranking.

### SC-INV-2.4-008 — pack RNG separation
Collectible RNG MUST NOT influence SC-1.11 match RNG.

### SC-INV-2.4-009 — marketplace isolation
Marketplace state MUST NOT enter gameplay manifests or hashes.

### SC-INV-2.4-010 — immutable initialized matches
Post-start ownership, transfer, burn or market events cannot alter an initialized match.

### SC-INV-2.4-011 — provenance auditability
Mint and ownership provenance commitments MUST be canonically hashable and auditable.

### SC-INV-2.4-012 — supply enforcement
An Edition with a max supply MUST never mint beyond that ceiling.

### SC-INV-2.4-013 — serial uniqueness
Serialized Printings within an Edition MUST have unique serial numbers.

### SC-INV-2.4-014 — guest-play independence
Baseline guest play MUST remain available without wallet ownership of Printings.

### SC-INV-2.4-015 — anti-pay-to-win
No collectible property may increase combat stats, resource generation, draw odds, deck size, matchmaking priority, ranking weight or progression rate.

## 15. SC-2.4 closeout

SC-2.4 freezes the collectible provenance boundary for V1.

The architecture is now explicit:

- `CardDefinition` = competitive identity
- `Edition` = collectible release metadata
- `Printing` = individually minted collectible instance
- provenance/ownership = external collectible authority
- runtime gameplay = CardDefinition-derived only

Future pack, marketplace, collection and minting implementations MUST conform to this boundary.
