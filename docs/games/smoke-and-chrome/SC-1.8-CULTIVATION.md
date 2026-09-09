# Smoke & Chrome — SC-1.8 Cultivation Rules

Status: frozen for V1 ruleset

## Purpose
Cultivation is Smoke & Chrome's second strategic engine alongside District combat. It creates a persistent economic-development axis that generates Flower, enables genetics-driven synergies, creates sabotage/exposure targets, and rewards long-term board planning.

Cultivation must remain deterministic, visible where strategically necessary, and entirely inside the match engine. Blockchain ownership, wallet state, edition rarity, and collectible provenance can never modify growth rate, yield, or cultivation outcomes.

## Cultivation topology
Each player has exactly 3 cultivation slots in V1, as frozen by SC-1.2.

Each slot may contain at most one active Plant object.

A Plant is created by legally playing a Genetic card into an empty cultivation slot or by another rule-explicit effect that creates a Plant.

The canonical growth sequence is:

PLANTED -> VEGETATIVE -> FLOWERING -> HARVEST_READY -> HARVESTED

HARVESTED is terminal for that Plant instance unless a card effect explicitly says otherwise.

## Growth timing
Baseline V1 growth advances during the active player's RESOLUTION phase after combat and before END-phase pressure checks.

Each eligible Plant advances exactly one stage per controller turn by default.

A Plant is eligible to advance only if:
- it is still present in a legal cultivation slot;
- it is not marked stalled;
- no replacement effect prevents advancement;
- no terminal match state has already been reached.

Growth is deterministic and does not use hidden RNG.

## Plant state
Each Plant instance records at minimum:
- plantInstanceId
- sourceCardDefinitionId
- controller
- cultivationSlot
- growthStage
- turnsInStage
- baseYield
- modifiers
- statuses
- provenance of all state changes

The engine, not the UI, is authoritative for stage and yield.

## Planting
Baseline V1 planting occurs during DEVELOPMENT unless a card explicitly permits another timing window.

Planting requires:
- a legal Genetic card or explicit plant-creating effect;
- an empty cultivation slot;
- payment of all required costs atomically;
- legal controller and zone state.

Newly planted Plants enter at PLANTED and do not advance again during the same turn unless an explicit effect grants accelerated growth.

## Harvest readiness
A Plant entering HARVEST_READY remains there until harvested, destroyed, stolen, contaminated, stalled, or otherwise modified by a legal effect.

HARVEST_READY Plants do not auto-harvest.

## Harvest action
Baseline V1 Harvest is an explicit DEVELOPMENT action by the Plant's controller.

A legal Harvest:
1. validates the Plant is HARVEST_READY;
2. locks the Plant instance for the action;
3. calculates final deterministic yield;
4. applies Flower gain and all harvest-triggered effects;
5. resolves any resulting triggers through the SC-1.6 Stack rules;
6. moves the Plant to HARVESTED and clears the slot unless a rule explicitly replaces that movement.

Default baseline yield is 3 Flower before modifiers.

Card definitions may alter baseYield, but collectible edition/printing metadata may not.

## Yield modifiers
Yield modifiers can come from:
- the Genetic definition;
- Infrastructure;
- Leader abilities;
- District effects;
- Gear or Operative abilities where explicitly legal;
- temporary Operations;
- statuses such as contaminated, boosted, stressed, or protected.

All modifiers are applied in deterministic rules order.

No source may generate undefined fractional Flower in baseline V1. If a future effect produces fractional intermediate math, the rules definition must specify deterministic rounding.

## Cultivation interaction with resources
Cultivation primarily produces Flower.

It may also interact with:
- FLOW through tempo or accelerated-growth costs;
- DATA through diagnostics, surveillance, sabotage, or protection;
- HEAT through risky cultivation, contraband methods, visible grow operations, raids, or exposed Infrastructure.

There is no automatic Heat generation from merely controlling a Plant in baseline V1. Heat must come from explicit rules or effects.

## Sabotage and hostile interaction
Opponents may interact with cultivation only through legal card text or rule-defined actions.

Possible hostile outcomes include:
- stall growth;
- reduce yield;
- increase Heat;
- apply contamination;
- destroy a Plant;
- steal or redirect a harvest;
- expose related Infrastructure;
- force a Plant backward a growth stage where explicitly allowed.

Hostile effects use SC-1.6 targeting, priority, Stack, revalidation, and fizzle rules.

There is no generic free sabotage action in baseline V1.

## Protection
Protection may come from Infrastructure, Operatives, Leader abilities, Gear, or Operations.

Protection must be rule-explicit. A Plant is not inherently untargetable simply because it is in Cultivation.

## Genetics
A Genetic card defines the gameplay identity of a Plant, including eligible traits, base yield, cultivation text, and interaction tags.

Genetic gameplay data belongs to CardDefinition.

Edition, printing, foil status, art variant, serial number, provenance, wallet owner, or marketplace value never change:
- growth speed;
- base yield;
- legal targets;
- resource production;
- sabotage resistance;
- any other competitive property.

## Mothers, clones, and seeds
V1 allows future card definitions to model Mothers, Clones, Seeds, cuttings, or breeding-related effects, but SC-1.8 does not create separate universal zones or lifecycle systems for them.

Such mechanics must be expressed through explicit CardDefinition text until a later rules phase formalizes a dedicated subsystem.

## Growth acceleration and regression
Effects may accelerate or regress Plants only when explicitly defined.

Baseline limits:
- an effect must specify the number of stages changed;
- no stage transition may move outside the canonical stage graph;
- HARVESTED cannot be regressed by default;
- a Plant cannot advance through HARVEST_READY directly into HARVESTED without a legal harvest effect;
- every stage change is logged.

## Stalled Plants
A stalled Plant does not advance during its controller's normal growth check.

Stall is a status, not a separate growth stage.

If the source of Stall expires before the growth check, the Plant becomes eligible again.

## Contamination
Contamination is a status hook available to card design.

Baseline rules do not impose a universal penalty merely for being contaminated. The effect that applies contamination or another rule referencing it must define the consequence.

This preserves extensibility without introducing hidden universal assumptions.

## Destruction and slot cleanup
If a Plant leaves Cultivation before HARVESTED:
- the slot becomes empty after the move resolves;
- attached modifiers are cleaned up according to SC-1.5 attachment rules;
- leave-play and destruction triggers enter the Stack according to SC-1.6;
- no harvest yield is granted unless an explicit effect says otherwise.

## Control changes
If control of a Plant changes:
- the Plant remains in its physical cultivation slot unless the controlling effect specifies movement;
- the new controller becomes authoritative for future harvest decisions;
- ownership remains distinct from control under SC-1.5;
- hidden or private metadata must not leak through the control change.

## Visibility
Baseline V1 cultivation board state is public:
- occupied/empty slot state;
- Plant identity once planted;
- growth stage;
- visible statuses;
- controller;
- public yield modifiers.

Private hand/deck information remains hidden under SC-1.2.

## Terminal-state interaction
Cultivation never resolves through a terminal game state.

If a harvest or cultivation-triggered effect creates a Collapse or Dominance terminal condition, the current atomic action and mandatory triggered batch resolve according to SC-1.1/SC-1.6 terminal timing, then the terminal state is evaluated.

## Replay requirements
Every cultivation transition must be reconstructable from:
- prior authoritative state;
- ordered player actions;
- rule-explicit effects;
- deterministic modifier ordering.

Required log events include at minimum:
- PLANT_CREATED
- GROWTH_ADVANCED
- GROWTH_STALLED
- GROWTH_REGRESSED
- STATUS_APPLIED
- STATUS_REMOVED
- HARVEST_DECLARED
- HARVEST_RESOLVED
- PLANT_DESTROYED
- PLANT_CONTROL_CHANGED

## SC-1.8 invariants

SC-INV-CULT-001: No cultivation slot may contain more than one active Plant.

SC-INV-CULT-002: A normal growth check advances an eligible Plant by exactly one stage and never skips stages.

SC-INV-CULT-003: A Plant cannot become HARVESTED without a legal harvest or explicit harvest-replacement effect.

SC-INV-CULT-004: Harvest yield is deterministic from CardDefinition plus authoritative in-match modifiers.

SC-INV-CULT-005: Collectible edition, printing, wallet, provenance, rarity, or marketplace state can never modify cultivation outcomes.

SC-INV-CULT-006: A newly planted Plant does not receive the same turn's normal growth advancement unless an explicit effect allows it.

SC-INV-CULT-007: Destroyed or otherwise removed Plants grant no default harvest yield.

SC-INV-CULT-008: Every hostile cultivation interaction must pass normal targeting, Stack, and revalidation rules unless explicitly defined as a non-Stack state action.

SC-INV-CULT-009: Cultivation state transitions must be replay-deterministic and attributable to a specific action/effect.

SC-INV-CULT-010: Cultivation resolution cannot bypass SC-1.1 terminal evaluation ordering or SC-1.6 atomic resolution.

## SC-1.8 exit criteria
SC-1.8 is complete when:
- the V1 stage graph is frozen;
- planting timing and slot legality are frozen;
- normal advancement timing is frozen;
- Harvest timing, baseline yield, and cleanup are frozen;
- sabotage/protection interaction hooks are defined;
- Genetic/card-printing separation is explicit;
- cultivation visibility and replay semantics are defined;
- invariants are documented for later engine tests.

Next phase: SC-1.9 District / Influence control rules.
