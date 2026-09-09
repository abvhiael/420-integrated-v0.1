# BUD-2 Specification — Customer System

Status: in progress

## Objective

Add a deterministic customer lifecycle on top of the BUD-1 store simulation without moving authority into the UI or introducing account/wallet dependencies.

## Customer lifecycle

enter -> queue -> waiting -> served | abandoned -> exit

## Initial customer state

Each customer has:
- immutable id
- requested starter product
- patience budget measured in deterministic ticks
- queue position derived from arrival order
- lifecycle state
- optional archetype

Initial archetypes:
- regular
- impatient
- enthusiast
- bargainHunter

## Deterministic timing

BUD-2 uses explicit integer ticks. The game client decides when to advance ticks; tests can reproduce the same state from the same inputs.

## Rush hooks

The customer system exposes a demand multiplier / spawn-profile concept for later live-event integration. BUD-2 includes the canonical `normal` and `fourTwentyRush` profiles but does not implement wall-clock scheduling.

## BUD-2 invariants

- `BUD-CUST-001`: customer ids are unique.
- `BUD-CUST-002`: queue ordering is stable by arrival sequence.
- `BUD-CUST-003`: patience never becomes negative.
- `BUD-CUST-004`: a customer may transition to served or abandoned at most once.
- `BUD-CUST-005`: abandoned customers cannot later settle an order.
- `BUD-CUST-006`: serving a customer settles exactly one matching BUD-1 order.
- `BUD-CUST-007`: rush profiles may affect arrivals/patience defaults but cannot mutate store cash or inventory directly.
- `BUD-CUST-008`: customer logic remains wallet-, account-, and chain-independent.

## Out of scope

- navigation/pathfinding
- rendered NPC animation
- tips
- reputation
- staff automation
- live wall-clock event scheduling
- wallet or identity
