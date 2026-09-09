# Smoke & Chrome — SC-1.7 Combat Rules

Status: FROZEN FOR V1
Phase: SC-1.7
Depends on: SC-1.1, SC-1.2, SC-1.3, SC-1.4, SC-1.5, SC-1.6

## Purpose
Freeze the canonical V1 combat model so the deterministic engine can implement lane-based conflict without making direct Stability damage the only meaningful path to victory.

## 1. Combat topology
Combat occurs through the three Streets defined in SC-1.2. Each Street is paired 1:1 with one shared District.

Baseline topology:
- Street A -> District A
- Street B -> District B
- Street C -> District C

No cross-lane attack or support is implied by adjacency. Any effect that reaches another Street or District must say so explicitly.

## 2. Combat phase structure
The COMBAT phase contains these canonical substeps:

1. DECLARE_ATTACKS
2. ATTACK_RESPONSE
3. DECLARE_BLOCKS
4. BLOCK_RESPONSE
5. COMBAT_DAMAGE
6. DAMAGE_RESPONSE
7. CASUALTY_CHECK
8. CONTROL_UPDATE
9. COMBAT_END

The engine may represent substeps internally with enums, but their observable ordering is authoritative.

## 3. Legal attackers
Only ready Operatives occupying a Street may be declared as attackers unless an effect explicitly permits another object to attack.

Baseline restrictions:
- an Operative may attack at most once per combat phase;
- exhausted/stunned/otherwise ineligible Operatives cannot attack;
- an attacker normally attacks within its current Street;
- declaring an attack marks the Operative committed for that combat;
- commitment prevents redeclaration unless an effect explicitly resets or reopens eligibility.

## 4. Attack targets
A legal attacker may target one of the following in its Street, subject to card text and blockers:

1. an opposing Operative in that Street;
2. the paired District objective;
3. the opposing player’s Stability only when the lane is exposed under the rules below;
4. another permanent only when an effect explicitly makes that permanent attackable.

## 5. Exposed lane rule
Direct Stability attacks are allowed only when the attacker’s Street is exposed.

A Street is exposed when the defending player controls no ready Operative in that Street that is legally able to block the attacker, unless a card effect says otherwise.

This preserves Stability pressure as a real win path while keeping board control central.

## 6. Declaring attacks
During DECLARE_ATTACKS the active player declares all baseline attackers and their intended targets as one atomic declaration set.

The declaration must include:
- attacker object id;
- Street id;
- intended target id/type;
- any required attack mode or modal choice;
- any attack-generated cost or Heat payment.

Illegal declarations are rejected before the declaration set becomes authoritative.

## 7. Attack response window
After attackers are locked, ATTACK_RESPONSE opens priority using the SC-1.6 Stack rules.

Players may respond with legal Operations, activated abilities, traps, redirects, buffs, debuffs or other effects.

When both players pass on an empty Stack, combat proceeds to DECLARE_BLOCKS.

## 8. Declaring blocks
The defending player declares legal blockers simultaneously as one atomic block set.

Baseline blocking:
- only ready defending Operatives in the same Street may block;
- each blocker may block one attacker;
- each attacker may be blocked by one blocker;
- multi-block and multi-attack assignment require explicit card text;
- a blocker becomes committed once the declaration set is accepted.

## 9. Block response window
After blocks are locked, BLOCK_RESPONSE opens priority.

If a blocker leaves combat before damage, the attacker remains blocked unless an effect explicitly causes it to become unblocked.

If an attacker leaves combat before damage, its combat assignment ends.

## 10. Combat statistics
Baseline Operative combat uses:
- POWER: damage dealt in combat;
- ARMOR: damage prevention/mitigation layer;
- DURABILITY: remaining damage capacity before defeat.

If existing card implementation uses different field names, the engine must map them canonically to these semantics.

## 11. Damage calculation
At COMBAT_DAMAGE, each surviving combat assignment resolves deterministically.

### Attacker vs Operative
Attacker and blocker deal combat damage simultaneously unless an effect explicitly changes timing.

For each recipient:
1. start with source POWER;
2. apply modifiers/replacements;
3. reduce by effective ARMOR;
4. apply remaining damage to DURABILITY;
5. record any excess as OVERKILL where relevant.

### Attacker vs District
Unblocked damage assigned to a District does not directly reduce a generic District health pool in baseline V1.

Instead, successful District pressure produces Influence/control pressure as defined by SC-1.9. SC-1.7 only emits deterministic `district_pressure` events with source, amount and Street/District identifiers.

### Attacker vs Stability
An unblocked legal Stability attack deals its post-modifier combat damage to the defending player’s Stability.

## 12. Armor
ARMOR is mitigation, not a second life total.

Baseline rule:
`effective_damage = max(0, incoming_damage - effective_armor)`

Armor does not automatically degrade unless an effect explicitly says it does.

## 13. Overkill
OVERKILL is the portion of post-mitigation combat damage exceeding the target’s remaining DURABILITY.

Overkill has no universal baseline spillover effect.

Cards may reference overkill for:
- extra District pressure;
- Heat generation;
- resource gains;
- triggered abilities;
- Stability spillover only when explicitly stated.

This prevents overkill from becoming an implicit direct-damage shortcut.

## 14. Casualties
At CASUALTY_CHECK, any Operative with remaining DURABILITY <= 0 is defeated simultaneously.

Defeated Operatives move to their owner’s Discard unless a replacement effect changes the destination.

Attachments are cleaned up according to SC-1.5 after the defeated object’s move is established.

Casualty processing is atomic before control calculations occur.

## 15. Combat damage persistence
Baseline V1 damage on Operatives persists until the end of the current turn, then clears during END cleanup unless an effect says otherwise.

Permanent wound mechanics require explicit card text and are not baseline rules.

## 16. Combat and District control
Combat influences the victory system through District pressure and board occupancy.

SC-1.7 does not itself decide District ownership. Instead it emits deterministic combat results that SC-1.9 consumes:
- surviving friendly Operatives per Street;
- defeated enemy Operatives;
- District pressure amount;
- attacker identity;
- overkill amount if relevant;
- control-relevant triggers.

## 17. Direct Stability damage is secondary
The design target is that lane control, District pressure, cultivation/economy and tactical removal matter at least as much as direct Stability aggression.

No baseline combat rule grants automatic Stability damage merely because a player controls a District.

## 18. Combat withdrawal and removal
If an attacker or blocker is removed from its Street or otherwise made illegal before COMBAT_DAMAGE:
- it deals no normal combat damage;
- it receives no normal combat damage;
- its assignment remains in the combat log for replay/audit;
- any independent already-created Stack objects remain unless their own legality fails.

## 19. Simultaneous combat events
All simultaneous combat damage and casualty results use deterministic ordering for logging while preserving simultaneous game semantics.

Recommended canonical log ordering:
1. by Street id;
2. by attacker object id;
3. by blocker/target object id;
4. by event type ordinal.

The ordering is for replay determinism only and must not create unintended timing advantages.

## 20. Combat terminal checks
Collapse/Stability and Dominance checks do not interrupt a partially resolved combat assignment.

Terminal evaluation occurs only at SC-1.3 legal evaluation boundaries after:
- the current Stack object fully resolves;
- the current simultaneous damage batch is applied;
- casualty cleanup completes;
- control updates complete where applicable.

SC-1.1 precedence rules remain authoritative.

## 21. Combat Heat interactions
Combat does not generate Heat by default.

Specific attack modes, Contraband, sabotage, illegal weapons, assassinations or card effects may create Heat. Any Heat modification must be explicit and deterministic under SC-1.4.

## 22. Replay state
A combat replay record must be sufficient to reconstruct:
- initial combat state;
- declarations;
- response windows;
- blockers;
- Stack resolutions;
- damage calculation inputs;
- armor values/modifiers;
- casualties;
- District pressure;
- Stability damage;
- resulting zone/control state.

## 23. SC-1.7 invariants

### SC-INV-COMBAT-001 — same-lane default
Without explicit card text, attacks and blocks cannot cross Streets.

### SC-INV-COMBAT-002 — atomic declarations
Attack and block declaration sets are validated atomically before becoming authoritative.

### SC-INV-COMBAT-003 — no mid-batch terminal
A match cannot terminate in the middle of simultaneous combat damage/casualty processing.

### SC-INV-COMBAT-004 — armor floor
Armor can never cause negative damage or healing through baseline mitigation.

### SC-INV-COMBAT-005 — overkill isolation
Overkill never spills to Stability or another target without explicit rule text.

### SC-INV-COMBAT-006 — defeated object cleanup
Every defeated Operative resolves exactly one authoritative destination transition before control calculation.

### SC-INV-COMBAT-007 — blocked-state persistence
Removing a blocker before damage does not automatically make the attacker unblocked unless an effect explicitly says so.

### SC-INV-COMBAT-008 — wallet neutrality
Wallet/edition/printing state can never change combat stats, legal targets, priority, damage, blocking or initiative.

### SC-INV-COMBAT-009 — deterministic replay
Identical starting state + RNG seed + ordered combat actions must produce identical combat results.

### SC-INV-COMBAT-010 — control separation
SC-1.7 emits District pressure and occupancy outcomes but cannot directly redefine SC-1.9 District ownership rules.

## 24. SC-1.7 closeout criteria
SC-1.7 is complete when:
- lane-based attackers/targets are frozen;
- declaration and response windows are frozen;
- block legality is frozen;
- damage, armor and overkill are frozen;
- casualty timing is frozen;
- direct Stability attack exposure is frozen;
- combat-to-District-pressure handoff is frozen;
- deterministic combat invariants are documented.

All criteria above are satisfied by this document.
