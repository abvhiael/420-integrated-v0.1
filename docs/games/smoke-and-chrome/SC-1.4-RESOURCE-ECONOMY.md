# Smoke & Chrome — SC-1.4 Resource Economy

Status: FROZEN for V1 ruleset

## Purpose

SC-1.4 defines the canonical V1 resource economy for Smoke & Chrome. The four tracked resources are FLOW, FLOWER, DATA and HEAT. These values are authoritative match state and must be deterministic, replayable and independent from blockchain ownership or wallet state.

## Core principles

1. FLOW, FLOWER and DATA are spendable player resources.
2. HEAT is an exposure/risk meter, not ordinary mana.
3. Resource mutations must be explicit state transitions with source, amount and reason.
4. No resource may go negative.
5. Wallet linkage, collectible edition, cosmetic rarity or marketplace ownership must never alter V1 resource generation, caps, costs or conversion rates.
6. All resource changes are resolved inside the deterministic off-chain match engine.

## FLOW

FLOW represents tempo, coordination and immediate operational capacity.

Primary uses include:
- deploying operatives;
- activating tactical abilities;
- paying action/response costs;
- movement and combat manipulation where a card or rule specifies a Flow cost;
- executing some Operations.

### Baseline behavior

- FLOW is the principal renewable turn resource.
- A player's available FLOW refreshes during REFRESH according to their current Flow capacity.
- Unspent temporary FLOW does not carry across turns unless an effect explicitly converts or banks it.
- Flow capacity changes are persistent until modified by rules or effects.
- V1 base Flow capacity starts at 3.
- V1 baseline capacity progression increases by 1 on each of that player's turns, to a normal maximum of 10.
- Card effects may modify current or maximum FLOW within their own legal bounds.

## FLOWER

FLOWER represents harvested cannabis product and the material economy surrounding cultivation.

Primary sources include:
- Harvest actions;
- cultivation effects;
- controlled District effects;
- Infrastructure or card text.

Primary uses include:
- cultivation-related costs;
- selected Infrastructure or Genetics costs;
- black-market/economic effects;
- card abilities that explicitly require Flower.

### Baseline behavior

- FLOWER is persistent across turns.
- FLOWER does not automatically refresh.
- FLOWER is normally generated through gameplay rather than granted as a universal turn stipend.
- A player may hold at most 20 FLOWER in V1 unless a rules effect explicitly changes that cap.
- Excess FLOWER above the cap is lost during the same atomic resolution that would create the overflow, after replacement effects have resolved.

## DATA

DATA represents intelligence, network access, surveillance, cryptographic leverage and technical capability.

Primary sources include:
- Data-producing Infrastructure;
- District control effects;
- Operative/Leader abilities;
- Operations and other card effects.

Primary uses include:
- hacking;
- surveillance;
- information manipulation;
- Stack interaction/countermeasures;
- deck/hand intelligence effects;
- technical abilities and Chrome-oriented effects.

### Baseline behavior

- DATA is persistent across turns.
- DATA does not automatically refresh.
- A player may hold at most 20 DATA in V1 unless a rules effect explicitly changes that cap.
- Overflow handling mirrors FLOWER.

## HEAT

HEAT represents accumulated attention, exposure and institutional pressure created by dangerous or conspicuous actions.

HEAT is intentionally asymmetric with the other resources:

- it is usually gained rather than spent;
- higher HEAT is normally harmful;
- it persists across turns;
- specific effects may reduce or manipulate it;
- an effect must explicitly say that HEAT is paid/spent if it is used as a cost.

### Heat bands

V1 defines four authoritative Heat bands:

- 0–2: LOW
- 3–5: WATCHED
- 6–8: HOT
- 9+: BURNING

Crossing into a higher band creates a deterministic Heat-band transition event. Effects may trigger from these transitions.

### Baseline Heat pressure

At the END phase, after ordinary end-phase triggers resolve and before the next player's START phase, apply Heat pressure to the active player:

- LOW: no baseline penalty;
- WATCHED: no automatic Stability loss, but the player is considered exposed for rules/effects that reference exposure;
- HOT: lose 1 Stability;
- BURNING: lose 2 Stability.

This loss is a rule event, not damage, unless a future effect explicitly treats it as damage.

Heat pressure can therefore contribute to COLLAPSE but is evaluated through the normal SC-1.1 terminal evaluation boundary.

### Heat gain

Actions may add HEAT through explicit costs or effects. Typical examples include sabotage, contraband, aggressive illegal Operations, raids, assassinations and other high-risk actions.

HEAT never increases merely because a player owns blockchain collectibles, holds $420 or connects a wallet.

### Heat reduction

HEAT may be reduced by explicit rules or card effects such as lying low, security, influence, cleanup or other future mechanics.

- HEAT cannot be reduced below 0.
- Baseline V1 provides no universal automatic Heat decay.
- Any future decay mechanic must be explicit and deterministic.

## Paying costs

To pay a cost:

1. determine the complete cost after modifiers;
2. verify the player can legally pay every required component;
3. atomically deduct spendable resources and/or add HEAT as specified;
4. place the action/effect on the Stack or resolve it according to the governing rule.

If the complete cost cannot be paid, no partial payment occurs unless an effect explicitly permits partial payment.

## Resource conversions

There is no universal FLOW↔FLOWER↔DATA conversion in V1.

Any conversion requires an explicit card, Leader, Infrastructure, District or rules effect defining:
- source resource;
- destination resource;
- conversion ratio;
- limits;
- timing;
- whether the conversion adds HEAT.

## Resource visibility

Current FLOW, FLOWER, DATA and HEAT totals are public match information.

Derived hidden information may not be inferred by exposing private cost-resolution internals beyond what the public action log and card rules require.

## Terminal interaction

Resource changes can indirectly cause a terminal result only through rules that modify Stability, District control or another SC-1.1 terminal condition. Resource totals themselves are not independent victory conditions in V1.

## SC-1.4 invariants

SC-INV-RESOURCE-001 — No tracked resource may become negative.

SC-INV-RESOURCE-002 — FLOW refresh equals current authoritative Flow capacity after modifiers; temporary unbanked FLOW does not carry across turns.

SC-INV-RESOURCE-003 — FLOWER and DATA persist across turns and do not receive a universal refresh stipend.

SC-INV-RESOURCE-004 — HEAT is not ordinary mana and cannot be silently consumed as a generic payment resource.

SC-INV-RESOURCE-005 — Every resource mutation must be attributable to an explicit rule/effect and replay identically from the same initial state and action sequence.

SC-INV-RESOURCE-006 — FLOWER and DATA overflow is deterministic and capped at 20 unless a legal effect changes the cap.

SC-INV-RESOURCE-007 — Heat-band transitions occur exactly when crossing the defined thresholds and are emitted once per crossing event.

SC-INV-RESOURCE-008 — Baseline Heat pressure is applied only at the specified END-phase boundary and uses the authoritative band after ordinary end-phase effects resolve.

SC-INV-RESOURCE-009 — Failed cost payment is atomic: no partial resource mutation occurs unless explicitly allowed.

SC-INV-RESOURCE-010 — Wallet linkage, collectible ownership, edition rarity, marketplace activity and $420 holdings cannot modify competitive resource generation, costs, caps or Heat pressure.

## Acceptance criteria

SC-1.4 is complete when the V1 ruleset has a single canonical definition for:
- resource names and meanings;
- refresh/persistence semantics;
- base Flow progression;
- Flower/Data caps;
- Heat bands and baseline pressure;
- cost-payment atomicity;
- conversion boundaries;
- resource visibility;
- deterministic invariants.

SC-1.5 may now define card taxonomy against this resource model without changing these semantics except through an explicit ruleset revision.
