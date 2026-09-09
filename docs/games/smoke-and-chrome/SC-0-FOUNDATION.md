# Smoke & Chrome — SC-0 Project Foundation

Status: **FROZEN / COMPLETE**

Smoke & Chrome is the 420 Integrated ecosystem's adult cannabis-fantasy / cyberpunk trading-card game. SC-0 freezes the project's identity, architectural boundaries, competitive-integrity rules, ownership model, platform assumptions, and implementation constraints before the V1 ruleset is designed in SC-1.

## 1. Product identity

Smoke & Chrome is a collectible competitive card game built around:

- faction warfare;
- district and territory pressure;
- cannabis genetics and cultivation;
- criminal/corporate/counterculture economies;
- cybernetic and information warfare;
- collectible editions and cosmetic prestige;
- tournaments, seasons and organized competitive play.

The game may use blockchain-backed ownership, but blockchain is not the match engine.

## 2. V1 product principles

1. **Fun before financialization.** A complete core game must exist without purchasing, owning or connecting blockchain assets.
2. **Wallet optional for core play.** Core matches and deck building are wallet-free.
3. **No pay-to-win.** Wallet linkage, collectible ownership, edition rarity or marketplace activity must never increase card combat statistics, draw odds, match speed, ranking weight, progression rate, matchmaking priority, deck size, resource generation or other competitive power.
4. **Deterministic competition.** Match results must be reproducible from canonical initial state, RNG seed and ordered player actions.
5. **Chain outside the hot loop.** No normal turn, card play, combat action, trigger or priority window may depend on blockchain confirmation.
6. **Shared ecosystem authority.** Smoke & Chrome reuses the 420 Gaming Protocol and `@420/gaming-sdk`; it must not create parallel wallet, identity, entitlement, session, claim or attestation authority.
7. **Privacy by scope.** The game may request only Smoke & Chrome-scoped identity/entitlement data required for the feature in use and must not enumerate wallet-wide or cross-game activity.
8. **Collectible scarcity is presentation/provenance scarcity, not rules power.** Different printings of the same canonical card definition have the same gameplay semantics unless a future ruleset explicitly defines a separate card definition.

## 3. Architecture boundary

### Off-chain / game-authoritative

The competitive runtime owns:

- game state;
- turn sequencing;
- card legality;
- deck legality;
- resource accounting during matches;
- priority and response windows;
- stack/effect resolution;
- combat resolution;
- cultivation progression during matches;
- district/influence resolution;
- match RNG consumption;
- timeout/reconnect sequencing;
- replay generation;
- bot simulation;
- matchmaking and ranked-rating calculations.

### Blockchain / ecosystem-authoritative

The 420 ecosystem may own or attest:

- player wallet linkage;
- persistent 420 Game Identity linkage;
- collectible editions/printings;
- provenance and ownership;
- marketplace settlement;
- eligible tournament prize settlement;
- blockchain-backed achievements/attestations where explicitly enabled;
- cross-game prestige/entitlements where explicitly enabled.

### Forbidden authority duplication

Smoke & Chrome must not implement an independent canonical:

- wallet authority;
- identity authority;
- entitlement authority;
- claim authority;
- cross-game attestation authority.

Game-local sessions and local runtime caches may exist, but they cannot supersede shared protocol authority for ecosystem-backed features.

## 4. Canonical asset layering

The project separates gameplay identity from collectible identity:

```text
CardDefinition
  -> Edition
    -> Printing / Collectible
      -> Ownership
```

### CardDefinition

Canonical gameplay semantics: name, type, faction, costs, stats, rules text and rules identifiers.

### Edition

A publishing/collecting namespace such as Founders, Season One, alternate-art or tournament edition.

### Printing / Collectible

A specific collectible representation, potentially including serial/provenance metadata.

### Ownership

The current owner or entitled account/wallet.

**Invariant:** ownership, edition, foil treatment, serial number or cosmetic rarity cannot silently alter the associated CardDefinition's competitive semantics.

## 5. Player access tiers

### Guest

Must be able to:

- launch the game;
- learn rules;
- play supported core modes;
- build/use permitted non-wallet decks;
- receive a local/ephemeral starter experience.

### Registered game identity

May add:

- cloud save;
- persistent non-chain progression;
- account recovery/sync as supported;
- ranked identity where permitted.

### Wallet-linked

May deliberately unlock ecosystem-backed features such as:

- blockchain-backed editions/collectibles;
- ownership-aware collection surfaces;
- marketplace actions;
- tournament prize receipt/settlement;
- cross-game prestige/entitlements.

Wallet linkage alone grants **zero competitive-stat advantage**.

## 6. Match-engine requirements inherited by later phases

The implementation created in SC-3 and beyond must support:

- deterministic state transitions;
- canonical action ordering;
- canonical RNG consumption;
- immutable replay/event logs sufficient to reproduce a completed match;
- rejection of invalid/duplicate/out-of-order actions;
- bounded resolution so card interactions cannot create uncontrolled infinite loops;
- versioned ruleset identifiers;
- versioned card-definition identifiers;
- server-authoritative competitive play while preserving deterministic local simulation for testing and bots.

## 7. V1 thematic/mechanical pillars

SC-0 freezes these as design pillars, but does **not** freeze their numerical rules; SC-1 owns those details.

### District warfare

Players contest locations/districts using operatives, infrastructure, influence and tactical actions.

### Cultivation

Cannabis genetics/cultivation forms a strategic economic axis rather than background flavor. The expected conceptual lifecycle is Planted -> Vegetative -> Flowering -> Harvest Ready -> Harvest, subject to SC-1 rules freeze.

### Multi-resource pressure

The V1 design space includes Flow, Flower, Data and Heat. Exact generation, spending, caps and timing are SC-1 decisions.

### Interactive resolution

The design includes response/priority windows and a visible effect-resolution stack. Exact priority rules are SC-1 decisions.

### Faction identity

Factions must create materially different deckbuilding and play-pattern identities without making wallet ownership a competitive prerequisite.

## 8. Scope exclusions for SC-0

SC-0 deliberately does not freeze:

- final victory conditions;
- starting hand size;
- deck size;
- copy limits;
- turn phase names/timing;
- exact resource values;
- exact Heat penalties;
- combat formulas;
- cultivation timing/yields;
- district-control thresholds;
- final card taxonomy;
- exact Founders Set size;
- final faction roster;
- rarity distribution;
- ranked/MMR formula;
- tournament formats.

Those belong to SC-1 and later phases.

## 9. Security and integrity invariants

### SC-INV-0-001 — Wallet neutrality
For equivalent game-local state and legal deck definitions, wallet linkage alone cannot change competitive match outcomes or available competitive power.

### SC-INV-0-002 — Chain isolation
A temporary blockchain outage cannot invalidate an already-authorized ordinary core match or make routine match actions require chain confirmation.

### SC-INV-0-003 — Definition/printing separation
Collectible metadata cannot mutate canonical gameplay semantics of its CardDefinition.

### SC-INV-0-004 — Scoped authority
Smoke & Chrome cannot claim canonical authority over shared wallet, identity, entitlement or cross-game attestation state.

### SC-INV-0-005 — Deterministic replay
Given the same ruleset version, card-definition set, initial state, RNG seed and ordered accepted actions, replay must reach the same final game state.

### SC-INV-0-006 — Explicit wallet boundary
Any feature requiring wallet access must be deliberately invoked and must fail closed without silently degrading core competitive integrity.

### SC-INV-0-007 — Privacy scope
Smoke & Chrome adapters may access only game-scoped information required for the active feature and must not expose wallet-wide or unrelated cross-game activity enumeration.

## 10. SC-0 acceptance criteria

SC-0 is complete when all of the following are true:

- [x] Product identity and thematic pillars are documented.
- [x] Core-play vs blockchain responsibility boundary is frozen.
- [x] Wallet-optional onboarding is frozen.
- [x] Anti-pay-to-win principle is frozen.
- [x] Shared 420 Gaming Protocol authority is adopted.
- [x] Privacy/scoped-access boundary is frozen.
- [x] CardDefinition / Edition / Printing / Ownership layering is frozen.
- [x] Deterministic match-engine requirement is frozen.
- [x] Initial architecture/security invariants are enumerated.
- [x] SC-0 explicitly identifies unresolved numerical/mechanical decisions as SC-1 work.

## 11. Exit decision

**SC-0 is CLOSED.**

The next project phase is **SC-1 — V1 Ruleset Freeze**, beginning with victory conditions and board/zone topology before numerical balance work.
