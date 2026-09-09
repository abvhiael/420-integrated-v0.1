# Smoke & Chrome — SC-1.12 V1 Ruleset Closeout

Status: FROZEN FOR SC-2 IMPLEMENTATION

This document closes SC-1 by binding SC-1.1 through SC-1.11 into one authoritative V1 gameplay contract. Later phases may implement, optimize, serialize, render, test, or extend these rules, but they MUST NOT silently redefine them.

## 1. Authoritative V1 ruleset surface

SC-1 consists of the following frozen rule groups:

1. SC-1.1 — Match objectives and terminal outcomes
2. SC-1.2 — Battlefield topology and zones
3. SC-1.3 — Turn sequence and phase structure
4. SC-1.4 — Flow / Flower / Data / Heat economy
5. SC-1.5 — Canonical card taxonomy and CardDefinition model
6. SC-1.6 — Stack / priority / trigger ordering
7. SC-1.7 — Combat rules
8. SC-1.8 — Cultivation rules
9. SC-1.9 — District / Influence control
10. SC-1.10 — Deck construction and faction legality
11. SC-1.11 — Canonical deterministic RNG

SC-1.12 defines the cross-ruleset invariants that all implementations MUST satisfy.

## 2. Canonical match model

A V1 match is a deterministic, mostly off-chain state machine between two players.

The canonical battlefield contains:
- 3 shared Districts;
- 3 paired Streets, one Street per District;
- one Operation area per player;
- 3 Cultivation slots per player;
- one Leader zone per player;
- Deck, Hand, Discard and Exile zones per player;
- one shared LIFO Stack.

A legal competitive deck contains exactly:
- 1 Leader;
- 50 Main Deck cards.

The baseline V1 card classes are:
- Leader;
- Operative;
- Infrastructure;
- Genetic;
- Operation;
- Gear;
- Contraband.

Chrome is a Gear subtype, not a separate primary type.

## 3. Canonical turn state machine

Every normal turn follows this phase sequence:

START -> REFRESH -> DRAW -> DEVELOPMENT -> OPERATIONS -> COMBAT -> RESOLUTION -> END

No implementation may reorder or skip a phase except through an explicit rules effect authorized by the frozen ruleset.

Priority, Stack resolution, automatic state checks and terminal evaluation MUST occur at deterministic boundaries.

## 4. Match-objective hierarchy

The authoritative V1 terminal paths are:

### 4.1 Collapse
A player whose Stability reaches the Collapse threshold loses at the next valid terminal evaluation boundary.

### 4.2 Dominance
A player satisfies Dominance when that player controls all 3 Districts at a valid terminal evaluation boundary.

### 4.3 Precedence
If Collapse and Dominance would become true in the same terminal evaluation batch, Collapse is evaluated first and takes precedence.

### 4.4 Deck exhaustion
Deck exhaustion does not cause an immediate arbitrary loss. It creates deferred Burnout pressure under the SC-1.1 rules.

### 4.5 Concession / timeout / draw
Concession, authorized timeout termination and formal draw conditions are terminal outcomes with explicit reason codes and MUST be replay-visible.

## 5. Economy contract

The four V1 gameplay resources are:

- FLOW — renewable turn-tempo resource;
- FLOWER — persistent cultivation/material resource;
- DATA — persistent intelligence/technical resource;
- HEAT — persistent exposure/risk meter.

Baseline Flow begins at capacity 3 and can progress toward capacity 10 under the V1 progression rules.

Baseline Flower and Data caps are 20 unless a rules effect explicitly changes a cap.

Heat bands are:
- LOW: 0-2;
- WATCHED: 3-5;
- HOT: 6-8;
- BURNING: 9+.

Baseline end-phase Heat pressure is:
- HOT -> 1 Stability loss;
- BURNING -> 2 Stability loss.

Heat has no implicit automatic decay in baseline V1.

All costs MUST be paid atomically. Resource conversion MUST be explicit. Wallet balances, token holdings, collectible ownership and economic wealth MUST NOT modify in-match resource generation, cost, cap, probability or combat efficiency.

## 6. Stack and interaction contract

Smoke & Chrome V1 uses one shared LIFO Stack.

- Both players must pass consecutively before the top Stack object resolves.
- Priority reopens after each Stack object resolves.
- Players do not receive normal priority in the middle of an object's resolution.
- Targets are revalidated on resolution.
- Invalid targets cause the affected portion or entire object to fail according to the explicit effect contract.
- Trigger ordering MUST be deterministic.
- Replacement effects MUST be applied before the replaced event is committed.
- Any rule that bypasses the Stack MUST be explicitly tagged as such.

## 7. Combat / Street / District coupling

Each Street is permanently paired with exactly one District.

Combat occurs on Streets. District control does not occur directly through combat assignment.

Baseline combat characteristics include:
- POWER;
- ARMOR;
- DURABILITY.

Attacker and blocker declarations are atomic. Baseline blocks and attacks are same-lane unless an explicit rule grants cross-lane behavior.

Combat damage resolves deterministically and simultaneously within its damage batch. Casualties and cleanup occur at defined state-check boundaries.

Overkill does not automatically spill to another target or player.

An exposed Street can permit direct Stability attacks under SC-1.7.

Combat generates District pressure as an input to SC-1.9; combat MUST NOT assign District ownership directly.

## 8. District / Influence contract

Influence is the sole authoritative baseline input to District ownership.

- higher Influence controls the District;
- equal Influence produces a neutral/contested result;
- ties never grant hidden incumbent advantage;
- control is recalculated atomically at valid evaluation boundaries.

Baseline pressure conversion is:

2 net pressure -> 1 Influence in the paired District during the appropriate Resolution processing.

A player must control all 3 Districts to satisfy Dominance.

## 9. Cultivation contract

Each player has exactly 3 baseline Cultivation slots.

The canonical lifecycle is:

PLANTED -> VEGETATIVE -> FLOWERING -> HARVEST_READY -> HARVESTED

Normal growth occurs during the controller's RESOLUTION phase unless modified by an explicit effect.

Planting and baseline harvesting occur during DEVELOPMENT.

Baseline harvest yield is 3 Flower.

Growth acceleration, regression, sabotage and protection MUST be represented as deterministic state transitions or explicit effects. Hidden timers, client-local growth and wall-clock progression are forbidden.

## 10. CardDefinition / Edition / Printing separation

Competitive gameplay authority lives in CardDefinition data.

The collectible hierarchy is:

CardDefinition -> Edition -> Printing

Edition and Printing metadata MAY define matters such as art, frame treatment, foil treatment, serial number, provenance, scarcity or ownership.

Edition and Printing metadata MUST NOT modify:
- cost;
- POWER;
- ARMOR;
- DURABILITY;
- resource production;
- card text;
- RNG odds;
- draw odds;
- matchmaking weight;
- rank gain;
- deck size;
- action speed;
- any other competitive statistic or rule.

## 11. Ownership and control

Owner and controller are distinct concepts.

Blockchain or wallet ownership never automatically establishes in-match control.

Temporary control changes MUST be represented explicitly in match state and MUST be replayable.

Attachments, generated objects, copied objects and transformed objects MUST retain deterministic source and controller provenance.

## 12. Deck legality contract

Baseline competitive V1 deck construction is:
- exactly 1 Leader;
- exactly 50 Main Deck cards;
- maximum 3 copies of a normal CardDefinition;
- maximum 1 copy of a Unique CardDefinition;
- single-faction identity plus Neutral cards by default;
- cross-faction inclusion only through explicit deterministic permission;
- no baseline V1 sideboard.

Deck legality is based on CardDefinition identity, never Edition or Printing identity.

A competitive deck MUST have a canonical manifest/hash before match start. The match-time deck is immutable after match initialization.

## 13. RNG contract

Every source of gameplay randomness MUST pass through the canonical deterministic match RNG context.

The RNG context MUST include:
- algorithm identifier;
- algorithm version;
- match seed;
- monotonically increasing RNG counter;
- domain-separated call context.

The following are forbidden as direct gameplay entropy:
- Math.random();
- wall-clock time;
- client render timing;
- frame timing;
- network timing;
- wallet state;
- token balance;
- collectible serials;
- platform-specific entropy.

Canonical candidate ordering MUST be established before random selection.

Shuffles MUST use a deterministic unbiased Fisher-Yates-compatible procedure.

Competitive replays MUST reproduce the same RNG outcomes from the same seed and ordered action stream.

420Randomness MAY later attest or supply pre-match seed material, but it MUST NOT become a synchronous dependency in the hot gameplay loop.

## 14. Cross-ruleset invariants

The following invariants are authoritative across all SC-1 modules.

### SC-INV-1 — Deterministic replay
Given the same ruleset version, initial state, canonical deck manifests, RNG seed and ordered player action stream, every conforming engine MUST produce the same authoritative final state and terminal result.

### SC-INV-2 — Single authority
There MUST be exactly one authoritative gameplay state machine. UI components, blockchain state, wallet state, collection services and marketplace services MUST NOT independently decide gameplay outcomes.

### SC-INV-3 — Hot-loop chain isolation
Normal turn progression, card resolution, combat, cultivation, District control and RNG MUST NOT require blockchain confirmation.

### SC-INV-4 — Wallet neutrality
Connecting a wallet MUST NOT alter competitive power, resource rates, card statistics, deck limits, draw odds, RNG outcomes, matchmaking priority, ranking weight or progression rate.

### SC-INV-5 — Collectible neutrality
Edition rarity, Printing rarity, foil treatment, serial number, provenance or market price MUST NOT affect competitive behavior.

### SC-INV-6 — Atomic action commitment
Each accepted player action MUST validate fully before its authoritative state mutation is committed, except where the explicit effect semantics define a staged decision object.

### SC-INV-7 — Canonical ordering
Whenever multiple legal objects, triggers, candidates, effects or state checks require ordering, the engine MUST use an explicit canonical order rather than implementation-dependent container iteration.

### SC-INV-8 — Terminal boundary integrity
A match MUST NOT declare a terminal result in the middle of an unresolved atomic batch unless the rules explicitly designate an immediate termination event. Normal Collapse and Dominance checks occur at valid terminal evaluation boundaries.

### SC-INV-9 — Collapse precedence
When Collapse and Dominance become true in the same terminal evaluation batch, Collapse MUST resolve first.

### SC-INV-10 — Zone legality
Every game object MUST occupy only a zone legal for its type and current state. Zone transitions MUST be explicit, attributable and replayable.

### SC-INV-11 — Hidden-information containment
A player or spectator projection MUST reveal only information authorized for that viewer scope. Hidden CardDefinition identity MUST never leak through IDs, logs, ordering artifacts, wallet data, collection metadata or debug serialization.

### SC-INV-12 — Stack integrity
No ordinary Stack object may resolve before the required consecutive-pass condition is satisfied. Resolution MUST be LIFO.

### SC-INV-13 — No mid-resolution priority
Normal player priority MUST NOT interrupt an effect currently resolving.

### SC-INV-14 — Resource conservation
Resource creation, destruction, conversion and payment MUST be explicitly attributable to rules-defined events. No client-local resource mutation is authoritative.

### SC-INV-15 — Heat semantics
Heat is risk/exposure, not interchangeable generic mana. Any effect that spends, removes, transfers or converts Heat MUST say so explicitly.

### SC-INV-16 — Street/District separation
Street combat state and District Influence state are distinct. Combat may generate pressure; only the District engine may derive ownership.

### SC-INV-17 — District tie neutrality
Equal opposing Influence MUST produce neutral/contested control unless an explicit future ruleset revision says otherwise.

### SC-INV-18 — Cultivation determinism
Plant growth MUST be driven by match events/phases, never real-world elapsed time.

### SC-INV-19 — Deck immutability
The canonical competitive deck manifest MUST remain immutable for the duration of a match.

### SC-INV-20 — RNG exclusivity
All gameplay randomness MUST consume the canonical RNG stream or an explicitly domain-separated deterministic substream derived from it.

### SC-INV-21 — Stable serialization
Authoritative state used for hashing, replay, validation or synchronization MUST use canonical serialization with stable field and collection ordering.

### SC-INV-22 — Version pinning
Every competitive match MUST pin the exact ruleset version, CardDefinition catalogue version and RNG algorithm version used to initialize it.

### SC-INV-23 — Fail closed
If a competitive engine cannot prove deck legality, state integrity, RNG integrity, ruleset version compatibility or authoritative replay continuity, it MUST fail closed rather than guess or continue under ambiguous state.

### SC-INV-24 — No external economic authority
Marketplace price, token ownership, wallet holdings, NFT ownership and external account status MUST NOT be consulted by the gameplay engine to resolve a competitive game rule unless the rule is a non-competitive entitlement boundary outside the match.

### SC-INV-25 — Replay completeness
The replay record MUST contain enough canonical information to reconstruct all authoritative decisions, random outcomes, priority passes, Stack transitions, phase transitions, combat declarations, cultivation transitions, resource mutations, Influence changes and terminal evaluation.

## 15. Explicitly deferred from SC-1

The following are intentionally outside the V1 rules freeze and belong to later phases:
- concrete CardDefinition schema implementation;
- Edition and Printing storage contracts;
- Founders Set content and balancing;
- faction names/theme content beyond structural legality;
- AI/bot behavior;
- network transport and authoritative multiplayer hosting;
- chain-backed collection, pack minting and marketplace settlement;
- tournament and seasonal services;
- client UX, animation and audiovisual treatment;
- production anti-cheat / telemetry implementation;
- balance patches and future ruleset versions.

No deferred system may redefine SC-1 behavior implicitly.

## 16. SC-1 exit criteria

SC-1 is considered CLOSED when:

- SC-1.1 through SC-1.11 have frozen their individual rule contracts;
- this cross-ruleset closeout is committed;
- future implementation work treats the V1 ruleset as a versioned input rather than mutable ad hoc behavior;
- SC-2 builds its canonical card/asset model against these rules instead of inventing a parallel model.

With this document committed, Smoke & Chrome may proceed to SC-2 — canonical card and asset model.
