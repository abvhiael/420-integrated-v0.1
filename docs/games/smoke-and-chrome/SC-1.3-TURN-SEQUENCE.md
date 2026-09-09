# Smoke & Chrome — SC-1.3 Turn Sequence & Phase Structure

Status: FROZEN for V1 ruleset

This document defines the canonical V1 turn/phase state machine for Smoke & Chrome. It is subordinate to SC-0 foundation, SC-1.1 victory conditions, and SC-1.2 board/zones.

## 1. Core turn model

A match proceeds in alternating player turns. At any time there is exactly one `activePlayerId` except during pre-game setup or after terminal match resolution.

Canonical V1 phase order:

1. START
2. REFRESH
3. DRAW
4. DEVELOPMENT
5. OPERATIONS
6. COMBAT
7. RESOLUTION
8. END

The phase order is deterministic and cannot be skipped, reordered, duplicated, or retroactively re-entered except where an explicit card/effect rule later creates a bounded extra-phase or phase-skip instruction. Such effects must be represented as authoritative state transitions, never UI-only behavior.

## 2. START phase

Purpose: establish the new turn boundary.

Authoritative actions:
- increment `turnNumber` when the active player changes into a new turn;
- set `activePlayerId`;
- clear prior-turn ephemeral flags that expire at turn start;
- process "at the start of your turn" triggers in deterministic ordering;
- evaluate terminal state after all mandatory start-of-turn effects resolve.

Players do not receive a normal action window before mandatory start-of-turn processing is complete.

## 3. REFRESH phase

Purpose: restore turn-scoped availability.

Authoritative actions may include:
- ready/refresh eligible Operatives, Infrastructure, Leaders, or other permanents;
- reset once-per-turn counters;
- clear turn-scoped exhaust/tap/used markers that explicitly refresh here;
- expire effects whose duration is "until your next Refresh" or equivalent.

Refresh operations are deterministic and happen before optional player actions.

## 4. DRAW phase

Purpose: perform the active player's normal draw procedure.

Rules:
- the active player performs the configured normal draw count for V1;
- if a draw is required from an empty Deck, SC-1.1 Burnout/deck-exhaustion rules apply;
- draw replacement effects are resolved before the draw changes zones;
- hidden-information projection from SC-1.2 applies at all times;
- terminal state is evaluated after mandatory draw/burnout processing resolves.

The initial first-player draw exception, if any, must be frozen separately in setup rules and represented explicitly rather than inferred from client UX.

## 5. DEVELOPMENT phase

Purpose: build long-term board/economic position.

This is the primary timing window for actions later classified as development-speed actions, expected to include categories such as:
- deploying Infrastructure;
- planting or developing Genetics/cultivation assets;
- attaching persistent non-combat development assets where legal;
- other board-building actions designated DEVELOPMENT speed.

The exact card taxonomy and resource costs are deferred to SC-1.4 and SC-1.5.

The active player receives priority first during this phase.

## 6. OPERATIONS phase

Purpose: tactical deployment and non-combat action play.

Expected action classes include:
- deploying Operatives;
- playing Operations;
- activating legal abilities;
- manipulating Districts, Streets, resources, or opposing board state;
- executing other MAIN/OPERATIONS-speed actions.

The active player receives priority first.

A player may pass priority. The phase advances only when all required players consecutively pass while the Stack is empty.

If the Stack is non-empty, consecutive passes resolve the top Stack object instead of advancing the phase.

## 7. COMBAT phase

Purpose: declare and resolve combat actions against legal Street/District-linked targets.

Combat is a structured sub-state machine. At minimum V1 reserves these internal steps:

1. COMBAT_BEGIN
2. DECLARE_ATTACKERS
3. DECLARE_TARGETS
4. DEFENDER_RESPONSE
5. COMBAT_DAMAGE
6. POST_COMBAT
7. COMBAT_END

The exact combat legality, blocking/countering model, damage calculation, armor, casualties, overkill, and Influence effects are frozen later in SC-1.7.

General guarantees:
- no combat damage is applied before declaration and response windows close;
- declarations are authoritative actions;
- combat decisions cannot be reconstructed from animation alone;
- all damage and casualty changes resolve deterministically;
- terminal state is evaluated after atomic combat resolution points.

## 8. RESOLUTION phase

Purpose: settle end-of-action-cycle board consequences that are not part of immediate Stack resolution.

Expected responsibilities include:
- District control recalculation where the rules designate end-of-turn settlement;
- Influence/control checks;
- cultivation progression/harvest-ready transitions designated for Resolution;
- Heat consequences or raid checks if later rules place them here;
- delayed triggers marked for Resolution;
- mandatory cleanup of transient tactical state before END.

This phase exists to prevent hidden timing ambiguity between combat completion and turn cleanup.

SC-1.6 through SC-1.9 may bind specific subsystems to this phase, but may not silently introduce an alternate settlement phase.

## 9. END phase

Purpose: close the active player's turn.

Authoritative actions:
- process "at end of turn" triggers;
- enforce hand-size/discard cleanup if V1 adopts a hand limit;
- expire "until end of turn" effects after appropriate end triggers;
- clear turn-scoped temporary modifiers;
- perform final terminal-state evaluation;
- if the match is not terminal, rotate `activePlayerId` to the opponent and transition to START.

No new turn begins until END fully completes.

## 10. Priority model

Smoke & Chrome uses explicit priority windows wherever players may respond.

V1 priority rules:
- active player receives priority first at the beginning of an interactive phase/window;
- a player may take one legal priority action or pass;
- after a legal action is placed/resolved according to its timing model, priority passes according to SC-1.6;
- when all eligible players pass consecutively with a non-empty Stack, resolve the top Stack object;
- when all eligible players pass consecutively with an empty Stack, advance the current phase/step;
- mandatory state-based/terminal checks occur before a fresh priority window is opened.

## 11. Stack interaction

The shared Stack defined by SC-1.2 is global to the match, not per-phase or per-player.

Phase advancement is forbidden while the Stack contains unresolved objects unless a future explicit rule states otherwise.

Effects that create triggers during resolution are enqueued/resolved according to SC-1.6 ordering rules.

## 12. Terminal-state evaluation

Terminal evaluation follows SC-1.1 and is performed at deterministic atomic boundaries, including at minimum:
- after mandatory start-of-turn effects;
- after mandatory draw/burnout processing;
- after an individual Stack object fully resolves;
- after atomic combat damage/casualty resolution;
- after Resolution-phase mandatory settlement;
- during END before turn rotation.

Once a terminal result is committed, no further optional action or phase transition is legal.

## 13. No simultaneous active turns

V1 is strictly alternating-turn.

There is never more than one active player. Response windows do not transfer turn ownership; they grant priority only.

## 14. Extra turns / skipped phases

V1 core rules do not assume extra turns or phase manipulation.

If future cards introduce them:
- extra turns must be explicit entries in an authoritative turn queue;
- skipped phases must be explicit phase-state flags;
- no effect may create recursive or unbounded turn insertion;
- replay must reconstruct the exact resulting turn queue.

## 15. Timeouts and disconnects

Turn/priority timers are part of match orchestration, not game power.

A timeout may cause:
- automatic pass;
- automatic default decision where a rule defines one;
- match loss only according to SC-1.1 timeout policy.

Reconnects restore authoritative turn/phase/priority/Stack state from the server snapshot/event log.

## 16. Canonical state fields

Minimum state model reserved by SC-1.3:

- `turnNumber`
- `activePlayerId`
- `phase`
- `combatStep` (nullable outside COMBAT)
- `priorityPlayerId` (nullable during mandatory processing)
- `consecutivePasses`
- `turnQueue`
- `phaseFlags`
- `stackDepth`
- `terminalResult`

Names may vary in implementation, but semantics may not.

## 17. SC-1.3 invariants

### SC-INV-TURN-001 — Single active player
During non-terminal match play exactly one player is the active player.

### SC-INV-TURN-002 — Ordered phase progression
Absent an explicit rules effect, phase transitions follow START → REFRESH → DRAW → DEVELOPMENT → OPERATIONS → COMBAT → RESOLUTION → END → START.

### SC-INV-TURN-003 — No phase advance with unresolved Stack
An interactive phase/step cannot advance while the Stack is non-empty.

### SC-INV-TURN-004 — Consecutive-pass semantics
Consecutive passes with a non-empty Stack resolve the top Stack object; consecutive passes with an empty Stack advance the current interactive phase/step.

### SC-INV-TURN-005 — Mandatory before optional
Mandatory phase/state processing completes before optional player priority opens.

### SC-INV-TURN-006 — Terminal halts progression
After terminal state is committed, no additional player action, Stack resolution, phase transition, or turn rotation may occur.

### SC-INV-TURN-007 — Deterministic replay
Given the same initial state, seed, and ordered legal actions, turn/phase/priority transitions must replay identically.

### SC-INV-TURN-008 — Response is not turn ownership
Priority granted to the non-active player never changes `activePlayerId`.

### SC-INV-TURN-009 — Explicit phase manipulation
Any future skipped phase, extra phase, or extra turn must exist as explicit authoritative state and may not be inferred from client behavior.

### SC-INV-TURN-010 — Atomic combat settlement
Combat damage/casualty application and its immediately associated terminal evaluation occur atomically at defined combat resolution boundaries.

## 18. SC-1.3 acceptance criteria

SC-1.3 is complete when:
- the canonical V1 phase order is frozen;
- mandatory vs interactive processing is defined;
- priority/pass behavior is defined at the phase level;
- Combat has reserved deterministic internal steps;
- Resolution has a defined systemic purpose;
- terminal checks are bound to deterministic boundaries;
- turn rotation is defined;
- timing/reconnect state can be represented authoritatively;
- invariants SC-INV-TURN-001 through SC-INV-TURN-010 are adopted.

Detailed resource rules, card speeds, Stack ordering, combat mathematics, cultivation timing, and District Influence formulas remain intentionally deferred to SC-1.4 through SC-1.9.
