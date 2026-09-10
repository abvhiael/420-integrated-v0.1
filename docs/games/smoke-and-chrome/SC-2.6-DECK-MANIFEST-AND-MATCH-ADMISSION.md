# SC-2.6 — Canonical Deck Manifest / Loadout Serialization and Match Admission Package

Status: frozen for V1

## Purpose

SC-2.6 defines the canonical pre-match payload used to prove deck legality and admit a Smoke & Chrome match without consulting mutable wallet, collection, marketplace, or "latest" registry state.

This layer binds SC-1.10 deck construction, SC-2.1 CardDefinition identity, SC-2.2 ability/effect registries, SC-2.5 set/release manifests, and the SC-1.11 deterministic RNG boundary into one hash-pinned admission package.

## Core objects

### DeckManifest

A `DeckManifest` is the canonical serialized competitive loadout.

Required fields:

- `schemaVersion`
- `deckId`
- `deckRevision`
- `formatId`
- `rulesetVersion`
- `releaseManifestHash`
- `legalitySnapshotHash`
- `leader`
- `mainDeck`
- `declaredFaction`
- `cardRegistryVersion`
- `abilityRegistryVersion`
- `effectRegistryVersion`
- `deckHash`

Optional non-authoritative metadata may include a local display name or notes, but such metadata MUST be excluded from `deckHash`.

### Leader entry

The Leader entry MUST contain:

- `cardDefinitionId`
- `cardRevision`
- `cardDefinitionHash`

Exactly one Leader is required.

### Main deck entries

Main deck entries are normalized tuples:

- `cardDefinitionId`
- `cardRevision`
- `cardDefinitionHash`
- `quantity`

Entries MUST be sorted by canonical CardDefinition identity before serialization.

Identical definitions MUST be aggregated into one quantity-bearing entry rather than repeated physical-printing records.

No Edition ID, Printing ID, serial number, wallet address, token ID, provenance value, market value, or collectible finish may appear in the authoritative deck payload.

## Canonical V1 deck constraints

A legal V1 `DeckManifest` MUST satisfy SC-1.10:

- exactly 1 Leader
- exactly 50 Main Deck cards
- normal copy limit: 3 per CardDefinition
- Unique copy limit: 1 per CardDefinition
- single declared faction plus Neutral by default
- explicit deterministic permission required for cross-faction inclusion
- no baseline V1 sideboard

The legality snapshot MAY additionally apply format bans, restrictions, release windows, or tournament-specific overrides that were fixed before match admission.

## Deck hash

`deckHash` MUST be computed from canonical serialization of the competitive fields only.

Conceptually:

`deckHash = H(schemaVersion || formatId || rulesetVersion || releaseManifestHash || legalitySnapshotHash || leader || canonicalMainDeck || declaredFaction || registryVersions)`

The hash function and canonical serialization version MUST be pinned by the ruleset or release manifest.

Two decks that differ only by collectible printing, edition, foil treatment, serial, ownership, local display name, or marketplace metadata MUST produce the same competitive `deckHash`.

## MatchAdmissionPackage

The canonical `MatchAdmissionPackage` MUST contain enough data to admit and later replay a match without mutable lookups.

Required fields:

- `schemaVersion`
- `matchRequestId`
- `formatId`
- `rulesetVersion`
- `releaseManifestHash`
- `legalitySnapshotHash`
- `cardRegistryVersion`
- `abilityRegistryVersion`
- `effectRegistryVersion`
- `rngAlgorithmVersion`
- `playerADeckHash`
- `playerBDeckHash`
- `playerADeckManifest`
- `playerBDeckManifest`
- `admissionPolicyVersion`
- `admissionTimestampClass`
- `admissionHash`

Where identity/session information is needed by the hosting layer, it MUST be referenced outside the competitive deck objects and MUST NOT alter deck legality or gameplay statistics.

## Admission validation pipeline

Admission MUST be fail-closed and deterministic.

Canonical order:

1. validate package schema and canonical serialization
2. resolve the exact hash-pinned release manifest
3. verify ruleset and registry versions
4. verify the legality snapshot
5. validate Leader definition and faction identity
6. validate Main Deck cardinality
7. validate copy limits and Unique rules
8. validate faction rules
9. verify all CardDefinition IDs, revisions, and hashes
10. verify referenced ability/effect registries
11. recompute each `deckHash`
12. recompute `admissionHash`
13. freeze the admitted competitive snapshot
14. only then permit match-seed finalization and match start

If any required dependency is unavailable, unknown, mismatched, malformed, or hash-inconsistent, admission MUST fail.

## Stable rejection categories

Implementations SHOULD expose stable machine-readable rejection categories including at least:

- `ADMISSION_SCHEMA_INVALID`
- `RULESET_MISMATCH`
- `RELEASE_MANIFEST_MISMATCH`
- `LEGALITY_SNAPSHOT_MISMATCH`
- `REGISTRY_VERSION_MISMATCH`
- `LEADER_INVALID`
- `DECK_SIZE_INVALID`
- `COPY_LIMIT_EXCEEDED`
- `UNIQUE_LIMIT_EXCEEDED`
- `FACTION_ILLEGAL`
- `CARD_DEFINITION_UNKNOWN`
- `CARD_DEFINITION_HASH_MISMATCH`
- `DECK_HASH_MISMATCH`
- `ADMISSION_HASH_MISMATCH`
- `DEPENDENCY_UNAVAILABLE`

Human-readable details may accompany these codes but MUST NOT alter deterministic admission outcome.

## Frozen-match semantics

Once admission succeeds:

- the deck manifests are immutable for that match
- the legality snapshot is immutable for that match
- the release manifest is immutable for that match
- registry versions are immutable for that match
- subsequent bans, patches, ownership transfers, marketplace changes, or new releases cannot alter the admitted state

A reconnect resumes the already-admitted package and never revalidates against mutable current state.

## Guest and wallet neutrality

Guest play remains valid.

Admission MUST NOT require:

- a wallet
- ownership of a Printing
- an NFT/token balance
- marketplace history
- a collectible edition
- a specific serial or rarity

A wallet-linked player and a guest using the same legal `CardDefinition` loadout MUST receive the same competitive `deckHash`, legality result, and gameplay parameters.

## Collection entitlement boundary

Collection systems MAY govern whether a user can save, display, trade, or present a particular collectible Printing outside the match.

They MUST NOT be consulted by the deterministic V1 match engine to change:

- card stats
- card costs
- abilities
- deck size
- copy limits
- faction rules
- RNG odds
- matchmaking priority
- turn speed
- rank weighting
- progression rate

Tournament products MAY impose an externally declared ownership/entry policy, but that policy is an admission entitlement gate and MUST NOT mutate gameplay once the deck is admitted.

## Replay package

For historical replay, the system MUST retain or resolve by immutable hash:

- both DeckManifests
- release manifest
- legality snapshot
- CardDefinition hashes/revisions
- ability/effect registry versions
- ruleset version
- RNG algorithm version
- admission policy version
- admission hash

This permits deterministic replay without querying present-day registries.

## SC-2.6 invariants

1. **SC-INV-DECK-001 — canonical deck identity:** equivalent competitive loadouts produce the same `deckHash`.
2. **SC-INV-DECK-002 — printing neutrality:** Edition/Printing metadata never enters authoritative deck serialization.
3. **SC-INV-DECK-003 — exact cardinality:** V1 Main Deck cardinality is exactly 50 with exactly one Leader.
4. **SC-INV-DECK-004 — copy-limit enforcement:** copy and Unique limits are validated by CardDefinition identity.
5. **SC-INV-DECK-005 — faction enforcement:** faction legality is deterministic and snapshot-pinned.
6. **SC-INV-DECK-006 — revision pinning:** every admitted CardDefinition is bound to an exact revision and hash.
7. **SC-INV-DECK-007 — registry pinning:** ruleset and registries cannot float to `latest` after admission.
8. **SC-INV-DECK-008 — fail closed:** missing or mismatched dependencies reject admission.
9. **SC-INV-DECK-009 — admission immutability:** admitted competitive state cannot mutate after match start.
10. **SC-INV-DECK-010 — reconnect stability:** reconnect never re-resolves against mutable current state.
11. **SC-INV-DECK-011 — wallet neutrality:** wallet status cannot change legality or competitive deck identity.
12. **SC-INV-DECK-012 — ownership neutrality:** collectible ownership cannot change card behavior or match parameters.
13. **SC-INV-DECK-013 — replay sufficiency:** immutable hashes and manifests are sufficient to reconstruct admitted loadouts historically.
14. **SC-INV-DECK-014 — canonical ordering:** entry ordering is deterministic and independent of client/UI ordering.
15. **SC-INV-DECK-015 — stable rejection:** equal invalid inputs produce equal machine-readable rejection categories.
16. **SC-INV-DECK-016 — tournament separation:** any external entitlement/ownership gate cannot mutate gameplay after admission.

## SC-2.6 closeout

SC-2.6 is complete when clients and validators can represent a legal competitive loadout as a canonical hash-pinned `DeckManifest` and create a deterministic `MatchAdmissionPackage` that can be validated without mutable wallet, collection, marketplace, or latest-registry lookups.
