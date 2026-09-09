# Smoke & Chrome — SC-1.9 District / Influence Control Rules

Status: Frozen for V1 ruleset

## Purpose

SC-1.9 defines the authoritative control model for the three shared Districts established in SC-1.2 and connects Street combat pressure from SC-1.7 to the Dominance victory condition frozen in SC-1.1.

The design goal is to make territorial control the primary strategic axis without allowing combat resolution, rendering, wallet state, or collectible metadata to redefine ownership.

## Canonical District state

Each of the three Districts stores:

- districtId
- controller: playerA | playerB | neutral
- influenceA: non-negative integer
- influenceB: non-negative integer
- pressureA: non-negative integer
- pressureB: non-negative integer
- contested: boolean derived from influence values
- controlMargin: absolute difference between influence totals

Only the rules engine may mutate this state.

## Influence

Influence is the authoritative measure used to determine District control.

Influence may be created or removed only by explicit game effects, including:

- Operative or Infrastructure abilities
- Operations
- combat-pressure conversion during Resolution
- District-specific effects
- Leader abilities

Influence is public game state.

Influence cannot be negative.

## Baseline control rule

At each control evaluation boundary:

- if influenceA > influenceB, player A controls the District
- if influenceB > influenceA, player B controls the District
- if influenceA == influenceB, the District is neutral

A District is contested whenever both players have at least 1 Influence there, regardless of who currently controls it.

Control is derived from authoritative Influence totals; it is never a separate player-owned token that can drift out of sync.

## Control evaluation boundaries

District control is recalculated atomically at these boundaries:

1. after an effect finishes resolving if it changes Influence
2. after a combat batch converts Street pressure into Influence
3. during RESOLUTION after all mandatory District effects complete
4. before terminal Dominance evaluation

Control is not recalculated in the middle of resolving a single effect.

## Street pressure

SC-1.7 combat produces pressure in the Street paired 1:1 with its District.

Pressure is temporary combat output and is not itself Influence.

Baseline conversion rule during RESOLUTION:

- each net 2 points of pressure converts to 1 Influence for that player in the paired District
- remainder pressure below 2 is discarded at the end of the conversion step
- opposing pressure is netted before conversion

Example:

- player A: 5 pressure
- player B: 1 pressure
- net pressure: 4 for A
- A gains 2 Influence
- no pressure carries into the next turn

Card effects may modify the conversion rate only explicitly.

## Pressure generation

Baseline pressure sources include:

- successful unblocked lane attacks
- removal of opposing lane defenders
- explicit card text

Pressure amounts are defined by the combat effect or card definition that created them.

There is no implicit pressure generation from merely having a unit in a Street.

## Neutral Districts

A District becomes neutral whenever Influence totals are tied.

Neutral status:

- satisfies neither player's Dominance count
- may still contain Influence from both players
- may still be contested
- may have active District effects

## Influence removal and transfer

Influence removal and transfer are explicit effects.

Transfer is atomic:

1. validate source has enough Influence
2. reduce source
3. increase destination
4. recalculate affected District control

An effect cannot partially transfer Influence.

## District lock / protection

Effects may protect Influence or prevent control changes, but such effects must state exactly what they prevent.

Protection against Influence loss does not automatically prevent:

- new opposing Influence
- pressure generation
- control tie formation
- unrelated District effects

No implied protection exists.

## Dominance victory

Dominance uses District control as defined here.

Baseline V1 Dominance condition:

> A player wins by Dominance if they control all 3 Districts at a terminal evaluation boundary.

The engine evaluates Dominance only after all pending mandatory state changes for the current atomic batch are complete.

If both players would satisfy incompatible terminal conditions in the same terminal evaluation, SC-1.1 precedence rules apply.

Collapse remains higher priority than Dominance when both occur in the same terminal evaluation.

## Simultaneous Influence changes

If multiple Influence changes occur simultaneously:

1. apply all reductions
2. apply all additions
3. apply replacements/preventions
4. recalculate control
5. enqueue resulting triggers
6. perform terminal evaluation when the current atomic batch allows it

The engine must not expose transient intermediate control states as authoritative outcomes.

## District effects and controller changes

A District card/effect may define bonuses for its controller.

When control changes:

- old-controller continuous bonuses end immediately after control recalculation
- new-controller continuous bonuses begin immediately after control recalculation
- enter/lose-control triggers are enqueued deterministically

No effect receives priority in the middle of control recalculation itself.

## Public visibility

For all players and spectators, public projection includes:

- Influence totals
- controller
- contested status
- pressure totals before conversion when the rules expose that timing window

Private information may never alter the public control result.

## Replay requirements

The deterministic event log must record:

- source of every Influence change
- source of every pressure change
- pre/post Influence totals
- pre/post controller
- conversion results
- prevention/replacement effects
- terminal Dominance evaluation result

Replaying the ordered event stream must reproduce identical District state.

## SC-1.9 invariants

### SC-INV-DISTRICT-001 — Control derived from Influence
A District controller must always equal the result of comparing authoritative Influence totals.

### SC-INV-DISTRICT-002 — No negative Influence
Influence totals must never be less than zero.

### SC-INV-DISTRICT-003 — Neutral on tie
Equal Influence totals must always yield neutral control.

### SC-INV-DISTRICT-004 — Pressure is non-authoritative
Street pressure alone must never directly set District controller.

### SC-INV-DISTRICT-005 — Atomic control evaluation
The engine must not publish transient control states from partial resolution of one atomic effect batch.

### SC-INV-DISTRICT-006 — Deterministic conversion
Given identical pressure state and modifiers, pressure-to-Influence conversion must produce identical results.

### SC-INV-DISTRICT-007 — Dominance requires three controls
Baseline V1 Dominance cannot resolve unless one player controls all three Districts at the terminal evaluation boundary.

### SC-INV-DISTRICT-008 — Collapse precedence preserved
A simultaneous Collapse and Dominance outcome must resolve according to SC-1.1 precedence, with Collapse taking priority.

### SC-INV-DISTRICT-009 — Wallet neutrality
Wallet linkage, collectible edition, printing rarity, ownership provenance, or marketplace state must not alter Influence, pressure, District control, or Dominance evaluation.

### SC-INV-DISTRICT-010 — Replay equivalence
Replaying the authoritative event stream must reproduce identical Influence totals, pressure conversion, controllers, and terminal outcome.

## SC-1.9 acceptance criteria

SC-1.9 is complete when:

- the three-District control model is explicit
- Influence is the sole authoritative control input
- pressure conversion is deterministic
- control recalculation boundaries are defined
- ties and contested state are unambiguous
- Dominance is connected to the SC-1.1 terminal engine
- simultaneous changes are atomic
- replay requirements are defined
- invariants SC-INV-DISTRICT-001 through 010 are accepted

## Downstream dependencies

SC-1.10 deck construction and faction rules may reference District playstyles but must not change these control semantics.

SC-3 match engine must implement District state as deterministic engine state, not client/UI state.

SC-5 combat must emit pressure only through the canonical pressure interface.
