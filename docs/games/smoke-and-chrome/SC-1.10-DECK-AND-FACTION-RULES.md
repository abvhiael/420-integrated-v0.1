# Smoke & Chrome — SC-1.10 Deck Construction & Faction Rules

Status: FROZEN FOR V1
Phase: SC-1.10

## Purpose

SC-1.10 freezes the canonical V1 deck-construction and faction-legality rules for Smoke & Chrome. These rules are engine-authoritative and must be validated before a deck can enter any rules-enforced match.

## 1. Canonical V1 deck structure

A legal V1 constructed deck consists of:

- exactly 1 Leader;
- exactly 50 cards in the Main Deck;
- no Leader cards in the Main Deck;
- no Sideboard in baseline V1 constructed play.

The Leader is a separate match object and does not count toward the 50-card Main Deck size.

## 2. Copy limits

Unless a CardDefinition explicitly overrides the normal limit:

- maximum 3 copies of any non-Unique CardDefinition in the Main Deck;
- maximum 1 copy of a Unique CardDefinition in the Main Deck;
- exactly 1 copy of the chosen Leader.

Copy limits are enforced by CardDefinition identity, not by Edition, Printing, cosmetic treatment, token ID, serial number, wallet ownership, or provenance.

Different printings of the same CardDefinition count toward the same copy limit.

## 3. Faction identity

Each Leader defines one canonical faction identity for baseline V1.

A legal Main Deck may contain:

- cards matching the Leader's faction;
- Neutral cards;
- cards explicitly granted cross-faction legality by deterministic rules text.

A card from another faction is illegal unless an explicit rules effect or deck-construction permission says otherwise.

Baseline V1 does not permit unrestricted multi-faction decks.

## 4. Neutral cards

Neutral cards may be included in any deck unless their own CardDefinition imposes a narrower legality restriction.

Neutral status grants access only; it does not bypass copy limits, format restrictions, banned/restricted lists, or other deck-validation rules.

## 5. Founders-set faction target

The V1 Founders Set is designed around 4 playable factions.

The exact faction names, identities, mechanical themes, and card pools are deferred to SC-8 / SC-9 content design, but the rules engine must treat faction IDs as canonical registry values rather than UI labels.

## 6. Genetic card inclusion

Genetic cards are normal Main Deck cards for deck-construction purposes.

They:

- count toward the 50-card deck size;
- obey normal copy limits unless explicitly overridden;
- obey faction legality where applicable;
- do not begin the match pre-planted merely because they are Genetics.

Any future pre-match Genetic loadout must be introduced as a separate rules module and cannot be inferred from this phase.

## 7. Contraband, Gear, Infrastructure, Operations and Operatives

All non-Leader primary card types from SC-1.5 are legal Main Deck candidates subject to faction, copy-limit, and format rules.

There is no mandatory minimum or maximum by card type in baseline V1 beyond the total deck size and any CardDefinition-specific restrictions.

## 8. Deck validation authority

Before matchmaking or match initialization, the engine must validate at minimum:

1. exactly one Leader is present;
2. Main Deck size is exactly 50;
3. every CardDefinition exists in the active canonical rules registry;
4. every CardDefinition is legal in the selected format/ruleset version;
5. faction legality is satisfied;
6. copy limits are satisfied;
7. banned/restricted status is satisfied;
8. all explicit deck-construction predicates on included cards are satisfied;
9. no collectible metadata modifies legality or competitive behavior.

Validation must be deterministic: the same Leader, ordered or unordered card multiset, registry version, and format version must always produce the same legality result and reason codes.

## 9. Canonical validation result

Deck validation must return a structured result rather than only a boolean.

Recommended shape:

```text
DeckValidationResult {
  legal: boolean
  rulesetVersion
  formatId
  leaderDefinitionId
  mainDeckCount
  violations[]
}
```

Each violation must expose a stable machine-readable reason code, with examples such as:

- SC_DECK_NO_LEADER
- SC_DECK_MULTIPLE_LEADERS
- SC_DECK_SIZE_INVALID
- SC_DECK_UNKNOWN_CARD
- SC_DECK_COPY_LIMIT
- SC_DECK_FACTION_ILLEGAL
- SC_DECK_BANNED_CARD
- SC_DECK_RESTRICTED_CARD
- SC_DECK_PREDICATE_FAILED

UI prose is non-authoritative and may map these codes to localized messages.

## 10. Banned and restricted lists

The rules architecture must support format-scoped banned and restricted lists even if the initial Founders environment launches with an empty list.

Baseline semantics:

- Banned: 0 copies allowed in the format;
- Restricted: maximum 1 copy allowed regardless of the ordinary copy limit.

A ban/restriction applies to CardDefinition identity, never to a specific collectible printing.

## 11. Ownership and wallet neutrality

Core deck legality must be separable from collectible ownership.

A wallet connection, rare printing, NFT edition, marketplace purchase, or premium cosmetic must never:

- raise copy limits;
- unlock stronger statistics for the same CardDefinition;
- bypass faction rules;
- bypass a ban/restriction;
- increase deck size;
- increase starting resources;
- modify draw odds or shuffle behavior.

Modes that require ownership-backed collections may enforce entitlement separately, but entitlement checks must not alter the competitive CardDefinition rules.

## 12. Guest and registered play

Guest play may use system-provided starter decks or other permitted non-owned deck manifests.

Registered / wallet-linked play may reference persistent collections and collectible printings, but match initialization must reduce those selections to canonical CardDefinition identities before competitive rules resolution.

## 13. Deck manifest and hashing

For competitive and replayable modes, a validated deck should produce a canonical deck manifest and deterministic hash containing at minimum:

- ruleset version;
- format ID;
- Leader CardDefinition ID;
- normalized CardDefinition quantities;
- relevant deck-construction permissions.

Cosmetic printing metadata should be committed separately where needed for presentation/provenance and must not change the competitive deck hash used for gameplay legality.

## 14. Match lock

Once a competitive match begins, the validated competitive deck manifest is locked for that match.

No marketplace transfer, wallet change, entitlement revocation, chain reorg, or external ownership event may mutate the in-progress match deck.

The match uses its accepted deterministic manifest through terminal resolution.

## 15. Sideboards

Baseline V1 has no Sideboard.

Sideboards, best-of-three match structures, between-game swaps, and tournament-specific sideboarding are explicitly deferred. Their later introduction must not silently alter the baseline V1 deck validator.

## 16. SC-1.10 invariants

### SC-INV-DECK-001 — Exact Main Deck Size
Every baseline V1 constructed Main Deck contains exactly 50 cards.

### SC-INV-DECK-002 — Single Leader
Every legal deck has exactly one Leader and that Leader is outside the 50-card Main Deck.

### SC-INV-DECK-003 — Definition-Based Copy Limit
Copy limits are computed solely by CardDefinition identity, irrespective of Edition or Printing.

### SC-INV-DECK-004 — Faction Legality
Every non-Neutral card in a legal deck must match the Leader's faction or possess an explicit deterministic cross-faction permission.

### SC-INV-DECK-005 — Neutral Is Not Exempt
Neutral cards remain subject to all ordinary copy, format, and ban/restriction rules.

### SC-INV-DECK-006 — Deterministic Validation
Identical deck manifests evaluated against identical registry and format versions must yield identical legality results and violation reason codes.

### SC-INV-DECK-007 — Wallet Neutrality
Wallet linkage, collectible rarity, Edition, Printing, provenance, or marketplace state cannot improve competitive deck legality or power.

### SC-INV-DECK-008 — Match Manifest Immutability
After match initialization, external ownership or entitlement changes cannot mutate the accepted competitive deck manifest.

### SC-INV-DECK-009 — No Baseline Sideboard
Baseline V1 deck validation contains no Sideboard zone or between-game substitution rules.

### SC-INV-DECK-010 — Registry-Scoped Legality
Every legal deck is validated against an explicit canonical ruleset/format registry version; UI labels or client-side metadata cannot override it.

## 17. Exit criteria

SC-1.10 is complete when:

- V1 deck size is frozen;
- copy limits are frozen;
- single-faction plus Neutral legality is frozen;
- Leader placement and identity rules are frozen;
- Genetic inclusion is defined;
- deterministic validation and reason codes are defined;
- ban/restriction support is defined;
- wallet/collectible neutrality is preserved;
- competitive deck manifests are immutable during matches;
- SC-1.10 invariants are documented.

With these conditions satisfied, SC-1.10 is CLOSED and SC-1.11 may define canonical RNG rules.