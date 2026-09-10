# Smoke & Chrome — SC-3.2 Match Initialization, Opening Setup & Mulligan

Status: **FROZEN — SC-3.2**  
Branch: `feature/420-gaming-smoke-chrome`  
Depends on: SC-1.1 through SC-1.12, SC-2.1 through SC-2.7, SC-3.1

## 1. Purpose

SC-3.2 defines the canonical deterministic pre-game sequence that transforms two admitted deck manifests plus the pinned match seed into the first live `START` phase.

The initialization pipeline MUST be fully replayable, MUST consume only canonical engine randomness, MUST never consult mutable wallet/collection/marketplace state after admission, and MUST produce the same opening state for the same admission package, engine version, ruleset version, seed, and ordered player inputs.

## 2. Initialization state machine

Canonical setup states:

`ADMITTED -> SEED_READY -> PLAYER_ORDER_SET -> DECKS_INSTANTIATED -> DECKS_SHUFFLED -> OPENING_HANDS_DRAWN -> MULLIGAN_OPEN -> MULLIGAN_LOCKED -> FINAL_HANDS_READY -> START_READY -> LIVE`

No state may be skipped unless an explicitly versioned ruleset path permits it.

## 3. Preconditions

Initialization MUST fail closed unless all of the following are present and valid:

- immutable `MatchAdmissionPackage`
- exactly two admitted players for V1
- one accepted `DeckManifest` per player
- pinned ruleset, release manifest, card registry, ability registry, effect registry, and RNG version
- canonical match seed material or verified seed commitment/derivation result
- deterministic player seat identifiers
- no unresolved admission rejection

Once initialization begins, mutable external systems are out of scope.

## 4. Match seed binding

The canonical match seed MUST be bound to:

- match ID
- admission-package hash
- ruleset version
- engine version
- RNG version
- ordered player seat IDs
- any approved external seed contribution / 420Randomness attestation metadata

Recommended conceptual derivation:

`matchSeed = H(domain || matchId || admissionHash || rulesetVersion || engineVersion || rngVersion || seatIds || approvedSeedMaterial)`

The exact hash algorithm and serialization are version-pinned.

The seed MUST NOT include:

- wallet balances
- NFT rarity
- edition scarcity
- marketplace prices
- local clock time
- client device entropy
- network latency
- UI state

## 5. First-player selection

V1 first-player selection is deterministic from the canonical match RNG.

Requirements:

1. consume exactly one domain-separated RNG decision under `SC:FIRST_PLAYER`
2. choose uniformly between the two seat IDs
3. emit an authoritative event recording the selected seat and RNG counter/reference
4. never reroll on reconnect, restart, retry, or client disagreement

A future ruleset MAY replace random first-player selection with tournament-assigned ordering, but such a mode MUST be explicit and version-pinned.

## 6. Runtime object instantiation

Each accepted deck is materialized into runtime card objects from its pinned `CardDefinition` entries.

For every card copy:

- create one deterministic runtime object ID
- preserve immutable owner seat
- initial controller = owner seat
- initial zone = `DECK`
- no damage, counters, attachments, temporary modifiers, or transient flags
- printing/edition metadata MUST NOT enter authoritative runtime state

Object IDs MUST be deterministic from canonical inputs such as:

`H(matchId || seatId || deckManifestHash || definitionId || ordinal)`

Generated IDs MUST be stable across replay.

## 7. Deck ordering before shuffle

Before shuffling, each deck MUST begin from a canonical pre-shuffle ordering derived from its normalized `DeckManifest`.

The ordering MUST NOT depend on:

- original client deck-list ordering
- filesystem ordering
- object insertion order
- wallet token enumeration
- edition serial numbers

This canonical baseline ensures the deterministic shuffle output is portable across implementations.

## 8. Initial shuffle

Each player's deck is shuffled exactly once before opening-hand draw using the SC-1.11 canonical shuffle algorithm.

Randomness domains:

- `SC:INITIAL_SHUFFLE:SEAT_A`
- `SC:INITIAL_SHUFFLE:SEAT_B`

Requirements:

- deterministic Fisher–Yates or other version-pinned unbiased shuffle
- independent domain separation per player
- no client-local randomness
- no reseed on reconnect
- retries MUST be idempotent
- emitted events MUST make replay reconstruct the same hidden deck order

Hidden deck order remains authoritative hidden state and MUST NOT be exposed to an unauthorized viewer.

## 9. Opening hand size

Baseline V1 opening hand size: **7 cards**.

Each player draws seven cards from the top of the post-shuffle deck into `HAND`.

Draw order is authoritative and replayable.

If a future ruleset changes opening hand size, that change MUST be versioned and pinned in the admission package.

## 10. Mulligan model

Baseline V1 uses a deterministic one-round partial mulligan.

Each player may independently select zero or more cards from their opening hand to replace.

Rules:

- mulligan is optional
- exactly one mulligan decision round baseline V1
- a player may replace between 0 and 7 opening cards
- mulligan choices are submitted as authoritative commands referencing runtime object IDs in that player's current opening hand
- both players' choices remain hidden from the opponent until the mulligan window locks, except for any explicitly public count if the ruleset later chooses to reveal it
- no player receives fewer cards solely because they mulligan

## 11. Mulligan replacement procedure

For each player after both mulligan choices lock or timeout-generated choices are accepted:

1. selected cards leave `HAND`
2. those cards enter a temporary internal `MULLIGAN_RETURN` collection
3. draw the same number of replacement cards from the top of the current deck
4. after replacement draws complete, return the selected cards to the deck
5. reshuffle the deck using a dedicated domain-separated mulligan shuffle

This procedure prevents immediate redraw of the exact returned cards while keeping hand size constant.

Randomness domain:

`SC:MULLIGAN_RESHUFFLE:<seatId>`

The exact order of operations MUST be identical across all engine implementations.

## 12. Mulligan command envelope

Canonical command shape conceptually:

```text
MulliganSelection {
  matchId,
  commandId,
  actorSeatId,
  expectedStateHash,
  selectedRuntimeObjectIds[],
  rulesetVersion
}
```

Validation requirements:

- actor owns the current hidden hand
- every selected object exists
- every selected object is currently in that actor's `HAND`
- no duplicate object IDs
- selected count <= opening hand size
- mulligan window is open
- command is idempotent by `commandId`
- stale state hash is rejected

## 13. Simultaneous mulligan locking

V1 mulligan decisions are logically simultaneous.

The engine MUST NOT allow one player's decision contents to influence the other's still-pending choice.

Canonical handling:

- each seat submits independently
- choices are stored in hidden pending decision state
- resolution occurs only after both seats are locked or timeout policy supplies a deterministic default
- default timeout mulligan = keep hand (`selectedRuntimeObjectIds = []`) unless tournament policy explicitly pins another rule

## 14. Opening-hand information security

Authoritative MatchState contains the actual runtime object IDs and CardDefinitions in each hand.

Viewer projections MUST expose:

- full own-hand contents to the owning player
- only permitted public information to the opponent/spectator
- never hidden deck order
- never opponent mulligan identities before permitted reveal

Reconnect and snapshot restoration MUST preserve hidden-state boundaries.

## 15. Starting player draw rule

Baseline V1: **both players perform the normal DRAW phase on their turns, including the first player on turn 1.**

There is no first-turn draw suppression in V1 unless a future ruleset version explicitly changes this.

## 16. Initial resources and board state

At transition to live play:

- each player Stability = canonical SC-1.1 starting value from pinned ruleset configuration
- Flow capacity/current value = SC-1.4 starting configuration
- Flower = 0 unless ruleset explicitly says otherwise
- Data = 0 unless ruleset explicitly says otherwise
- Heat = 0 unless ruleset explicitly says otherwise
- all three Districts = neutral
- District Influence = canonical zero baseline for both players
- all Streets empty
- all Cultivation slots empty
- all Operation zones empty except ruleset-mandated setup objects
- each Leader is instantiated in the canonical Leader zone/state defined by the pinned card model
- Stack empty
- no pending combat
- no pending effect resolution
- no temporary modifiers

Any starting exception MUST originate from pinned CardDefinition/ruleset setup semantics and resolve deterministically before `LIVE`.

## 17. Setup triggers

Cards or Leaders MAY define explicit pre-game/setup abilities only if supported by the pinned ruleset and ability registry.

Setup triggers:

- resolve through the canonical deterministic engine
- MUST NOT execute arbitrary code
- MUST use the normal effect registry
- MUST use canonical RNG if random
- MUST finish before `START_READY`
- MUST not create an unresolved Stack unless the ruleset explicitly permits a setup response window

Baseline V1 should minimize pre-game interactive triggers.

## 18. Transition to first live turn

After final hands and all deterministic setup effects are complete:

- active player = first-player seat
- turn number = 1
- phase = `START`
- priority state initialized according to SC-1.3
- RNG counter preserved from initialization
- command/event sequence continues monotonically
- canonical state hash is emitted
- match lifecycle becomes `LIVE`

The transition MUST occur exactly once.

## 19. Reconnect / retry behavior during setup

Reconnect MUST resume the existing setup state.

It MUST NOT:

- recreate runtime objects
- reshuffle decks
- redraw opening hands
- reroll first player
- clear already-locked mulligan choices
- consume additional RNG

Retries of previously accepted commands return the already-associated authoritative result.

## 20. Abort and integrity failure

Initialization MUST fail closed if any of the following occur:

- missing pinned dependency
- malformed DeckManifest
- runtime object ID collision
- unsupported RNG version
- shuffle/replay mismatch
- impossible hand/deck count
- invalid mulligan object reference
- hidden-state integrity violation
- state-hash mismatch that cannot be reconciled

Competitive mode MUST not silently repair a divergent setup state.

## 21. Canonical initialization events

Recommended event families:

- `MATCH_INITIALIZATION_STARTED`
- `MATCH_SEED_BOUND`
- `FIRST_PLAYER_SELECTED`
- `RUNTIME_DECK_INSTANTIATED`
- `DECK_SHUFFLED`
- `OPENING_HAND_DRAWN`
- `MULLIGAN_WINDOW_OPENED`
- `MULLIGAN_SELECTION_LOCKED`
- `MULLIGAN_REPLACEMENTS_DRAWN`
- `MULLIGAN_DECK_RESHUFFLED`
- `FINAL_OPENING_HAND_CONFIRMED`
- `INITIAL_SETUP_RESOLVED`
- `FIRST_TURN_STARTED`

Event payload visibility MUST respect hidden-state projection rules.

## 22. SC-3.2 invariants

### SC-INV-INIT-001 — Deterministic initialization
Identical admission package, versions, seed, and ordered player commands MUST yield the same first live MatchState and state hash.

### SC-INV-INIT-002 — Single first-player decision
First-player selection consumes exactly one canonical decision and cannot reroll after acceptance.

### SC-INV-INIT-003 — Canonical runtime identity
Every initial card runtime object ID is deterministic and replay-stable.

### SC-INV-INIT-004 — Canonical shuffle
Initial deck order after shuffle is determined only by canonical pre-shuffle order, pinned shuffle algorithm, and canonical RNG stream.

### SC-INV-INIT-005 — Opening hand cardinality
Each player has exactly seven cards after baseline opening draw and exactly seven after mulligan resolution, absent an explicit pinned rules effect.

### SC-INV-INIT-006 — Mulligan simultaneity
One player's unresolved mulligan choice cannot be revealed or used to alter the other's decision path.

### SC-INV-INIT-007 — Mulligan no immediate return
Selected mulligan cards cannot be replacement draws from the same replacement draw step.

### SC-INV-INIT-008 — Mulligan RNG isolation
Mulligan reshuffles use dedicated domain-separated RNG and do not reseed the match.

### SC-INV-INIT-009 — Reconnect neutrality
Reconnect/retry cannot consume additional RNG or change any accepted setup decision.

### SC-INV-INIT-010 — External-state isolation
Wallet ownership, balances, marketplace state, printing metadata, and chain changes cannot alter initialization after admission.

### SC-INV-INIT-011 — Hidden-state containment
Opponent opening-hand identities and hidden deck order remain inaccessible outside authorized projections.

### SC-INV-INIT-012 — Setup idempotency
Every accepted initialization command/event batch is idempotent under retry.

### SC-INV-INIT-013 — No ambient randomness
No initialization step may use wall-clock, client, platform, network, or unpinned entropy.

### SC-INV-INIT-014 — Exact live transition
The setup state machine transitions to `LIVE` exactly once, with turn 1 in `START` under the selected first player.

### SC-INV-INIT-015 — Replay sufficiency
The authoritative event log plus pinned admission/version material MUST be sufficient to reconstruct the exact first live state.

### SC-INV-INIT-016 — Fail-closed setup
Any irreconcilable initialization divergence or integrity failure prevents competitive match start.

## 23. Exit criteria

SC-3.2 is complete when:

- deterministic setup state machine is frozen
- first-player selection is pinned
- runtime deck instantiation is deterministic
- opening shuffle is deterministic
- baseline opening hand = 7
- one-round partial mulligan behavior is pinned
- mulligan simultaneity and timeout default are pinned
- starting board/resources are defined
- first live turn transition is exact
- reconnect/retry behavior cannot reroll or redraw
- hidden information boundaries are explicit
- initialization events and invariants are defined

SC-3.3 may now define the **canonical turn/phase advancement reducer, automatic phase actions, priority handoff, and phase-boundary event processing** on top of the initialized live MatchState.
