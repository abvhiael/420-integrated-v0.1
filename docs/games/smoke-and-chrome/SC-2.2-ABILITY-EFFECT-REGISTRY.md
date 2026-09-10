# SC-2.2 — Canonical Ability / Effect Representation and Registry

Status: **frozen for V1**

This document defines the canonical representation of Smoke & Chrome card abilities and effects. It is subordinate to the SC-1 V1 ruleset freeze and the SC-2.1 CardDefinition identity model.

## 1. Purpose

Card rules MUST be represented as deterministic, versioned, inspectable gameplay data. Rules text shown to a player is presentation. The authoritative gameplay object is an `AbilityDefinition` that references one or more canonical `EffectDefinition` objects.

Ad-hoc per-card executable code is not authoritative in V1.

## 2. Identity model

Every ability has a stable `abilityId` and revision. Every reusable effect primitive has a stable `effectId` and revision.

Recommended logical shape:

```text
AbilityDefinition {
  abilityId,
  revision,
  kind,
  timing,
  trigger,
  activationCost,
  targetSpec,
  condition,
  effectRefs[],
  choiceSpec,
  visibility,
  tags[],
  rulesTextKey,
  contentHash
}
```

```text
EffectDefinition {
  effectId,
  revision,
  opcode,
  parameters,
  validation,
  resolutionPolicy,
  rngDomain?,
  visibility,
  contentHash
}
```

`abilityId` and `effectId` are gameplay identities. They are independent from CardDefinition editions, printings, ownership, serials, rarity, foil state, marketplace data and wallet metadata.

## 3. Ability kinds

The canonical V1 ability kinds are:

- `STATIC` — continuously modifies rules/state while its source is active and the condition holds.
- `TRIGGERED` — created by a defined event and placed on the Stack unless the ruleset explicitly marks it as a state-based or replacement process.
- `ACTIVATED` — initiated by a controller by paying a declared cost.
- `REPLACEMENT` — replaces a pending event before it occurs; it does not use the Stack unless a later rule explicitly says otherwise.
- `STATE_BASED` — deterministic mandatory evaluation tied to a rules engine boundary; never player-activated.

No additional primary ability kind may be introduced in V1 without a ruleset revision.

## 4. Timing and priority

Abilities MUST declare their legal timing window. Legal timing must be derived from SC-1.3 and SC-1.6, never inferred from UI state.

A timing declaration MUST identify one of:

- a phase/subphase window,
- an explicit event trigger,
- a priority window,
- a replacement window,
- a state-based evaluation boundary.

Triggered and activated abilities that use the Stack follow the SC-1.6 priority/pass rules. Static, replacement and state-based abilities do not create ordinary Stack objects unless a later versioned rule explicitly converts them into one.

## 5. Activation costs

Activation cost is a structured object, not free-form text. It may contain zero or more of:

- Flow payment,
- Flower payment,
- Data payment,
- Heat gain,
- exhaust/tap source,
- sacrifice/discard/exile a legal object,
- remove counters,
- pay Stability,
- other versioned cost opcodes approved by the registry.

All costs are validated before commitment. Unless a specific cost opcode says otherwise, payment is atomic: an activation either pays all mandatory costs and enters the Stack, or pays none.

Costs cannot reference collectible metadata or wallet state.

## 6. Target specification

Targeting MUST use a canonical `TargetSpec` containing:

- candidate zone(s),
- object/card type constraints,
- controller/owner constraints,
- faction/tag/subtype constraints where relevant,
- lane/District/cultivation-slot constraints,
- min/max target count,
- uniqueness constraints,
- visibility requirements,
- optional vs mandatory status.

The candidate set is built in canonical engine order. If random selection is required, SC-1.11 RNG rules apply after canonical candidate construction.

Target legality is checked at announcement and revalidated at resolution as required by SC-1.6. Invalidated targets follow the canonical partial-resolution/fizzle policy declared by the ability.

## 7. Conditions

Conditions are declarative predicates over canonical match state. V1 condition primitives may inspect only gameplay state visible to the authoritative engine.

Examples include:

- controller has at least N resource,
- a District is controlled/neutral/contested,
- source or target occupies Street N,
- cultivation object is at a given growth stage,
- Heat lies in a defined band,
- a card/object has a type, subtype or tag,
- an event payload has a defined property.

Conditions cannot inspect UI-only state, local clock time, network latency, wallet balances, edition rarity, token price, ownership wealth, marketplace state, or external web/API data.

## 8. Effect primitives

V1 effects MUST resolve through registry-approved opcodes. The initial canonical opcode families are:

- `RESOURCE_MODIFY`
- `STABILITY_MODIFY`
- `HEAT_MODIFY`
- `DRAW`
- `DISCARD`
- `MILL`
- `MOVE_ZONE`
- `CREATE_TOKEN`
- `DESTROY`
- `EXILE`
- `DAMAGE`
- `HEAL`
- `MODIFY_STAT`
- `ADD_COUNTER`
- `REMOVE_COUNTER`
- `GAIN_INFLUENCE`
- `REMOVE_INFLUENCE`
- `ADD_PRESSURE`
- `CULTIVATION_ADVANCE`
- `CULTIVATION_REGRESS`
- `HARVEST`
- `ATTACH`
- `DETACH`
- `GRANT_ABILITY`
- `REMOVE_ABILITY`
- `REVEAL`
- `LOOK`
- `SHUFFLE`
- `RANDOM_SELECT`
- `COPY_OBJECT`
- `TRANSFORM_OBJECT`
- `COUNTER_STACK_OBJECT`
- `PREVENT`
- `REPLACE_EVENT`

New opcodes require registry revisioning and compatibility review.

## 9. Effect sequencing

An ability resolves its `effectRefs` in explicit array order. No engine implementation may reorder effects for optimization.

If an effect creates a mandatory immediate engine process, that process is completed at the boundary defined by SC-1 before the next effect continues.

If an effect requires a player choice during resolution, the engine enters a deterministic pending-decision state. The Stack object remains resolving; ordinary priority does not reopen until the resolving object completes.

## 10. Partial resolution and fizzles

Each AbilityDefinition MUST declare a resolution policy:

- `ALL_TARGETS_REQUIRED`
- `RESOLVE_LEGAL_TARGETS`
- `NO_TARGET_DEPENDENCY`

`ALL_TARGETS_REQUIRED`: if any required target is illegal at resolution, the Stack object resolves with no effect.

`RESOLVE_LEGAL_TARGETS`: illegal targets are dropped and legal targets continue. If no legal targets remain, the ability resolves with no effect.

`NO_TARGET_DEPENDENCY`: effect execution is governed only by its conditions and effect semantics.

An implementation may not invent card-specific fizzle behavior outside these canonical policies.

## 11. Trigger representation

Triggered abilities MUST name a canonical event type and optional declarative filter.

Example event families include:

- phase/turn boundaries,
- card/object entering or leaving a zone,
- attack/block declaration,
- damage dealt/prevented,
- object destroyed/exiled,
- resource modified,
- Heat band changed,
- cultivation stage changed,
- harvest completed,
- District control changed,
- Influence/pressure changed,
- Stack object cast/activated/resolved/countered.

Simultaneous triggers use SC-1.6 canonical ordering.

## 12. Replacement effects

Replacement abilities MUST:

1. identify the event class they can replace,
2. declare a legal applicability predicate,
3. declare the replacement result,
4. participate in the canonical replacement-order procedure when more than one applies.

Replacement effects cannot recurse indefinitely. The engine MUST track replacement lineage for the current event and reject a replacement that would re-apply the same replacement identity to the same event instance unless its opcode explicitly permits iteration.

## 13. Static effects and layers

Static effects are evaluated using a canonical layer order to prevent implementation-dependent results. V1 freezes the following broad order:

1. identity/type/subtype changes,
2. controller/ownership-derived gameplay-control changes,
3. rule permission/prohibition changes,
4. base stat setting,
5. additive/subtractive stat modification,
6. multiplicative/divisive stat modification,
7. keyword/ability grants and removals,
8. final clamps/minimums/maximums.

Within the same layer, order is deterministic using canonical timestamps, then stable source identity as the tie-breaker.

## 14. Registry and version pinning

A competitive match manifest MUST pin:

- ruleset version,
- Ability Registry version/hash,
- Effect Registry version/hash,
- CardDefinition manifest/hash,
- RNG algorithm/version.

The match cannot hot-load a changed registry after start. A server/client unable to resolve every referenced ability/effect revision MUST fail closed before competitive match start.

## 15. Serialization and hashing

AbilityDefinition and EffectDefinition objects MUST have canonical serialization. Field ordering, enum spelling, normalized arrays/sets and integer representation MUST be deterministic.

`contentHash` is derived from canonical gameplay content and MUST change when gameplay semantics change.

Localization keys, flavor text and purely presentational formatting are excluded from gameplay hashing unless they somehow alter a canonical gameplay field, which V1 does not permit.

## 16. Rules text

Human-readable rules text is generated from or mapped to canonical definitions. It is not authoritative.

If displayed text and canonical AbilityDefinition semantics disagree, the canonical definition controls the engine and the mismatch is a content defect that must be corrected.

## 17. Security / sandbox boundary

V1 abilities and effects are data interpreted by the match engine. They cannot execute arbitrary JavaScript, Solidity, shell code, HTTP requests, wallet RPCs, filesystem access, dynamic imports or external service calls.

All state mutation must occur through registry-approved engine opcodes.

## 18. Failure behavior

Unknown ability kind, unknown effect opcode, malformed parameter, missing revision, hash mismatch, invalid target schema, unsupported timing declaration or unresolved registry reference is a hard validation failure.

Competitive mode MUST fail closed rather than silently skipping or approximating an effect.

## 19. Invariants

- **SC-INV-ABILITY-001 — Stable identity:** every gameplay ability resolves through a stable `abilityId` + revision.
- **SC-INV-ABILITY-002 — Registry-only effects:** gameplay state may be mutated only through approved effect opcodes.
- **SC-INV-ABILITY-003 — No arbitrary code:** card content cannot execute arbitrary host code or external calls.
- **SC-INV-ABILITY-004 — Explicit ordering:** multi-effect abilities resolve in declared canonical order.
- **SC-INV-ABILITY-005 — Target determinism:** identical state yields identical legal target candidate sets before RNG/choice.
- **SC-INV-ABILITY-006 — Stack conformance:** triggered/activated Stack abilities obey SC-1.6 priority and resolution rules.
- **SC-INV-ABILITY-007 — Replacement single-application:** a replacement identity cannot re-apply to the same event instance unless explicitly versioned to allow it.
- **SC-INV-ABILITY-008 — Layer determinism:** static continuous effects produce implementation-independent results.
- **SC-INV-ABILITY-009 — Wallet neutrality:** ability/effect behavior cannot inspect or depend on wallet wealth, edition, printing, rarity or marketplace state.
- **SC-INV-ABILITY-010 — RNG confinement:** all random behavior routes exclusively through SC-1.11 RNG domains.
- **SC-INV-ABILITY-011 — Version pinning:** a match uses one pinned registry revision set from start to finish.
- **SC-INV-ABILITY-012 — Replay equivalence:** the same initial state, manifests, RNG seed and ordered actions/choices produce identical effect resolution and final state.
- **SC-INV-ABILITY-013 — Fail closed:** unknown or malformed canonical content cannot be silently ignored in competitive mode.
- **SC-INV-ABILITY-014 — Presentation separation:** localized/display rules text cannot override canonical gameplay semantics.

## 20. SC-2.2 closeout

SC-2.2 is complete when CardDefinitions can reference stable AbilityDefinitions, every AbilityDefinition resolves only through versioned EffectDefinitions, and the match manifest can pin the complete rules/content registry needed for deterministic execution and replay.

The next SC-2 step should define the canonical runtime card/object instance model that binds immutable CardDefinition data to mutable match state without mixing in collectible printing metadata.
