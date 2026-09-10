# SC-3.3 — Canonical Turn / Phase Advancement Reducer

Status: **FROZEN**

Parent phase: **SC-3 — Deterministic Match Engine Foundation**

Depends on:
- SC-1.3 — Turn sequence and phase structure
- SC-1.6 — Stack / priority
- SC-1.8 — Cultivation
- SC-1.9 — District / Influence
- SC-1.11 — Canonical RNG rules
- SC-2.2 — Ability/effect representation
- SC-2.3 — Runtime object model
- SC-3.1 — MatchState / command / event / reducer contract
- SC-3.2 — Match initialization and mulligan

## 1. Purpose

SC-3.3 defines the authoritative deterministic reducer for turn advancement, phase advancement, automatic phase work, priority opening/closing, phase-boundary trigger processing, and handoff between players.

The canonical V1 turn order remains:

`START → REFRESH → DRAW → DEVELOPMENT → OPERATIONS → COMBAT → RESOLUTION → END`

No client, UI, timer service, wallet, blockchain event, or external process may advance authoritative match time directly. Every advancement is represented by a validated command and an ordered canonical event batch processed by the SC-3.1 reducer.

## 2. TurnState

The authoritative MatchState contains a turn envelope equivalent to:

```text
TurnState {
  turnNumber
  activePlayerId
  nonActivePlayerId
  phase
  phaseStep
  priorityHolderId?
  consecutivePasses
  phaseEnteredAtSequence
  turnEnteredAtSequence
  pendingAutomaticWork[]
  pendingTriggers[]
  pendingDecisionId?
  combatState?
  terminalCheckPending
}
```

`turnNumber` begins at `1` when SC-3.2 enters the first START phase.

`phase` is one of:

- START
- REFRESH
- DRAW
- DEVELOPMENT
- OPERATIONS
- COMBAT
- RESOLUTION
- END

`phaseStep` is a versioned engine value and not a UI label. Later engine revisions may add internal substeps without changing the public V1 phase names, but a match is permanently pinned to the engine/ruleset version admitted at match start.

## 3. Advancement commands

Canonical command families include:

```text
ADVANCE_PHASE
PASS_PRIORITY
ADVANCE_AUTOMATIC_WORK
RESOLVE_PENDING_TRIGGER_BATCH
SUBMIT_PENDING_DECISION
BEGIN_COMBAT
ADVANCE_COMBAT_STEP
END_TURN
SYSTEM_TIMEOUT_PASS
SYSTEM_TIMEOUT_DECISION
```

A client cannot choose an arbitrary next phase. `ADVANCE_PHASE` means only: attempt the single legal next transition from the current canonical state.

Invalid skips, backwards movement, duplicate advancement, stale-state advancement, advancement while the Stack is unresolved, or advancement while a mandatory decision is pending must fail closed.

## 4. Phase transition pipeline

Every phase transition follows the same deterministic pipeline:

1. validate current phase completion conditions;
2. confirm no unresolved mandatory decision blocks advancement;
3. confirm Stack/priority conditions permit advancement;
4. emit `PHASE_EXITED`;
5. perform deterministic phase-exit automatic work;
6. collect and canonically order resulting triggers;
7. process required state-based checks;
8. perform terminal checks where required;
9. if terminal, stop;
10. select the single legal next phase;
11. emit `PHASE_ENTERED`;
12. perform deterministic phase-entry automatic work;
13. collect/order resulting triggers;
14. process mandatory automatic effects and state-based checks;
15. open priority only if the phase permits player action and no mandatory work/decision remains.

All emitted events are included in the normal SC-3.1 event sequence and state hash.

## 5. START phase

START is the canonical beginning-of-turn boundary.

Baseline START automatic work:

1. set current turn context;
2. expire modifiers whose duration is `until start of this turn` or equivalent canonical duration boundary;
3. enqueue start-of-turn triggers;
4. perform state-based checks;
5. process mandatory triggered work according to SC-1.6 / SC-2.2;
6. when clear, advance to REFRESH.

START is primarily a deterministic boundary phase. V1 does not grant open free-action priority in START unless an effect explicitly creates a decision or priority window through the canonical ability/effect system.

## 6. REFRESH phase

REFRESH performs the active player's renewable-turn reset.

Baseline automatic work:

- ready/refresh objects that are eligible under the pinned ruleset;
- clear turn-scoped usage markers that expire at REFRESH;
- advance Flow capacity according to SC-1.4 rules, capped by the pinned V1 maximum;
- refill available Flow to the player's current Flow capacity;
- apply explicit replacement/prevention effects in canonical layer order;
- enqueue REFRESH triggers;
- run state-based checks.

The engine must never derive Flow from wallet balance, owned Printings, NFT rarity, marketplace state, or any external account property.

When mandatory REFRESH work is clear, advance to DRAW.

## 7. DRAW phase

Baseline DRAW automatic work:

1. attempt the normal turn draw for the active player;
2. if the deck contains a card, move the canonical top object from DECK to HAND;
3. if the deck is empty, invoke the frozen SC-1.1 Burnout/deck-exhaustion rules rather than inventing an immediate-loss rule;
4. enqueue draw-related triggers;
5. process state-based and terminal checks.

The draw operation does not consume RNG. Deck order was already determined by canonical shuffle/randomness operations.

After mandatory DRAW work resolves, advance to DEVELOPMENT.

## 8. DEVELOPMENT phase

DEVELOPMENT is an open action phase for the active player.

When DEVELOPMENT is entered and all phase-entry automatic work is clear:

- active player receives priority first;
- legal development actions may include playing eligible cards, activating eligible abilities, planting eligible Genetic cards, harvesting Harvest Ready cultivation objects, and other actions explicitly allowed by the pinned ruleset/card definitions;
- non-active player may respond through normal Stack/priority rules where applicable.

The phase ends only when:

- Stack is empty;
- no mandatory decision or trigger batch is pending;
- both players have consecutively passed on an empty Stack with the active player having had priority in the current legal advancement window, or an equivalent canonical `ADVANCE_PHASE` request is accepted after the pass condition is satisfied.

On completion, advance to OPERATIONS.

## 9. OPERATIONS phase

OPERATIONS is an open action phase for effects and actions permitted by the pinned ruleset/card definitions.

The baseline engine does not infer legality from flavor text. Only canonical card/effect definitions may mark actions as valid during OPERATIONS.

Priority starts with the active player after phase-entry automatic work clears.

The same empty-Stack / consecutive-pass closure rule used by DEVELOPMENT applies.

On completion, advance to COMBAT.

## 10. COMBAT phase

COMBAT enters the SC-1.7 deterministic combat state machine.

At minimum, the combat context records:

```text
CombatState {
  step
  attackers[]
  blockers[]
  damageAssignments[]
  laneExposure[]
  pressureResults[]
}
```

SC-3.3 owns only phase-level orchestration. Detailed attack legality, blocking, damage, casualties, exposed-lane attacks, and pressure production are implemented by the dedicated combat reducer in later SC phases.

The phase cannot advance while combat has an unresolved mandatory substep, Stack item, response window, damage batch, casualty cleanup, or combat decision.

After the combat state machine reaches its canonical completed state, advance to RESOLUTION.

## 11. RESOLUTION phase

RESOLUTION performs deterministic end-of-action-board processing.

Baseline automatic work includes:

1. advance eligible cultivation objects by the SC-1.8 lifecycle rules;
2. apply deterministic acceleration/regression modifiers;
3. convert eligible temporary Street combat pressure into District Influence using the SC-1.9 baseline conversion rules;
4. clear pressure that is defined as turn-scoped after conversion;
5. resolve mandatory RESOLUTION triggers;
6. run state-based checks;
7. perform Dominance/Collapse terminal checks at the defined terminal boundary.

Influence ownership is recalculated only from canonical Influence values. Combat pressure itself never directly assigns District ownership.

When RESOLUTION is clear, advance to END.

## 12. END phase

END performs deterministic end-of-turn cleanup and pressure checks.

Baseline automatic work includes:

- apply Heat pressure according to SC-1.4 bands;
- process end-of-turn triggered abilities;
- expire `until end of turn` modifiers;
- clear turn-scoped action/usage flags;
- clear remaining temporary turn-only state;
- perform state-based checks;
- perform terminal checks after the full mandatory END batch.

If the match is not terminal, END hands turn ownership to the other player and initializes:

```text
turnNumber = turnNumber + 1
activePlayerId = previous nonActivePlayerId
nonActivePlayerId = previous activePlayerId
phase = START
```

The transition is emitted as authoritative events and is replay-stable.

## 13. Priority model

Priority follows SC-1.6.

Rules:

- only one player holds priority at a time;
- active player receives first priority when an open priority window begins unless a more specific pinned rule overrides it;
- taking a Stack-creating action resets `consecutivePasses` to zero;
- passing priority increments the canonical pass sequence;
- when both players consecutively pass with a non-empty Stack, the top Stack item resolves;
- after top resolution, priority reopens according to SC-1.6;
- when both players consecutively pass with an empty Stack in a phase that permits phase closure, that phase becomes eligible to advance;
- mandatory automatic work and unresolved mandatory decisions prevent normal priority from opening.

A reconnect does not reset priority, pass count, Stack position, or pending decisions.

## 14. Automatic work queue

Phase-entry and phase-exit work is represented as deterministic queued work rather than invisible mutation.

Each automatic work item must have stable identity equivalent to:

```text
AutomaticWorkItem {
  workId
  kind
  sourceId?
  controllerId?
  phase
  orderKey
  payload
}
```

Work ordering must be canonical and independent of iteration order, database row order, client render order, network arrival order, or platform implementation details.

Mandatory work is exhausted before normal player priority opens.

## 15. Trigger collection and ordering

Triggers created at phase boundaries are not resolved in incidental discovery order.

They are collected into an explicit batch and ordered using the pinned SC-1.6 / SC-2.2 trigger-ordering rules.

Where player choice is required to order simultaneous controlled triggers, the engine creates a canonical pending decision. No advancement occurs until that decision is resolved or a deterministic timeout command resolves it under the match policy.

## 16. State-based checks

State-based checks run at deterministic boundaries, including at minimum:

- after automatic work batches;
- after Stack-item resolution;
- after combat damage/casualty batches;
- after phase-exit work;
- after phase-entry work;
- before normal priority opens where the pinned rules require it;
- before terminal advancement boundaries.

State-based checks may emit events, queue triggers, remove illegal attachments, process destroyed objects, or produce terminal conditions, but may not call external services or mutate state outside the reducer.

## 17. Terminal checks

Terminal checks use SC-1.1 precedence.

If Collapse and Dominance become terminal in the same canonical terminal batch, Collapse precedence applies exactly as frozen in SC-1.1.

Once terminal:

- no later phase advancement is legal;
- no normal player action is legal;
- remaining non-required cosmetic/UI work is outside authoritative state;
- the terminal reason and winner/draw result are immutable.

## 18. Timeouts

Wall-clock passage is not itself a reducer input.

A host/tournament service may observe real time and submit a deterministic system command such as:

- `SYSTEM_TIMEOUT_PASS`
- `SYSTEM_TIMEOUT_DECISION`

The reducer validates that the referenced player/decision/priority state is still current before applying it.

A delayed duplicate timeout command is idempotent or rejected as stale and must never produce a second advancement.

## 19. Event families

Canonical SC-3.3 event families include:

```text
TURN_STARTED
TURN_ENDED
PHASE_ENTERED
PHASE_EXITED
AUTOMATIC_WORK_QUEUED
AUTOMATIC_WORK_APPLIED
PRIORITY_OPENED
PRIORITY_PASSED
PRIORITY_TRANSFERRED
PHASE_ADVANCEMENT_AVAILABLE
FLOW_CAPACITY_CHANGED
FLOW_REFRESHED
CARD_DRAWN
BURNOUT_PROGRESS_CHANGED
CULTIVATION_ADVANCED
PRESSURE_CONVERTED_TO_INFLUENCE
HEAT_PRESSURE_APPLIED
TURN_SCOPED_STATE_CLEARED
TERMINAL_CHECK_PERFORMED
```

Exact serialized event schemas are versioned engine data.

## 20. Failure / rejection reasons

Stable rejection categories include:

```text
SC_PHASE_STALE_STATE
SC_PHASE_INVALID_TRANSITION
SC_PHASE_STACK_NOT_EMPTY
SC_PHASE_PRIORITY_NOT_CLOSED
SC_PHASE_PENDING_DECISION
SC_PHASE_PENDING_AUTOMATIC_WORK
SC_PHASE_PENDING_TRIGGER_BATCH
SC_PHASE_COMBAT_INCOMPLETE
SC_PHASE_MATCH_TERMINAL
SC_PHASE_NOT_ACTIVE_PLAYER
SC_PHASE_INVALID_SYSTEM_TIMEOUT
SC_PHASE_ENGINE_INTEGRITY_FAILURE
```

## 21. Determinism and replay

Given the same:

- admitted MatchAdmissionPackage;
- initial state;
- engine/ruleset versions;
- RNG state;
- ordered accepted command stream;

phase and turn advancement must produce byte-equivalent canonical event semantics and the same resulting authoritative state hash.

Rendering, animations, audio, network latency, reconnect timing, wallet status, blockchain state, marketplace ownership, and local timezone cannot affect advancement.

## 22. SC-3.3 invariants

**SC-INV-TURN-001 — Single legal next phase**  
For every non-terminal normal phase state, the engine defines at most one canonical next phase.

**SC-INV-TURN-002 — No client phase mutation**  
Clients request advancement; they never authoritatively assign phase or turn state.

**SC-INV-TURN-003 — Mandatory work before priority**  
Normal priority cannot open while mandatory automatic work, triggers, or decisions remain unresolved.

**SC-INV-TURN-004 — Stack closure**  
A phase cannot close while the Stack is non-empty.

**SC-INV-TURN-005 — Consecutive-pass semantics**  
Priority/phase closure follows the frozen SC-1.6 consecutive-pass model.

**SC-INV-TURN-006 — Reconnect neutrality**  
Reconnect cannot alter phase, turn, priority, pass count, Stack, or pending decision state.

**SC-INV-TURN-007 — Draw determinism**  
Normal draw consumes the canonical top deck object and no RNG.

**SC-INV-TURN-008 — Flow determinism**  
REFRESH Flow changes depend only on pinned gameplay state/rules, never wallet or collectible state.

**SC-INV-TURN-009 — Cultivation boundary**  
Baseline cultivation growth occurs through canonical RESOLUTION work only unless an explicit effect says otherwise.

**SC-INV-TURN-010 — Pressure boundary**  
Street combat pressure cannot directly change District ownership; only deterministic Influence conversion may do so.

**SC-INV-TURN-011 — Heat boundary**  
Baseline Heat pressure is applied only at the canonical END boundary defined by the pinned ruleset.

**SC-INV-TURN-012 — Turn handoff atomicity**  
END-to-next-START player handoff is one authoritative deterministic transition sequence.

**SC-INV-TURN-013 — Timeout command requirement**  
Wall-clock passage alone can never mutate authoritative match state.

**SC-INV-TURN-014 — Terminal immutability**  
No phase or turn advancement is legal after terminal state is committed.

**SC-INV-TURN-015 — Canonical automatic ordering**  
Automatic work order cannot depend on runtime collection iteration, database order, UI order, or network order.

**SC-INV-TURN-016 — Trigger ordering determinism**  
Simultaneous phase-boundary triggers are resolved only through canonical ordering or explicit canonical player decisions.

**SC-INV-TURN-017 — Replay equivalence**  
The same admitted state and accepted command stream must reproduce the same phase/turn states and hashes.

**SC-INV-TURN-018 — Wallet / Printing neutrality**  
Wallet linkage, Edition, Printing, rarity, serial, provenance, marketplace value, or ownership cannot alter phase timing, priority, Flow, draws, combat windows, cultivation advancement, Influence conversion, or Heat processing.

**SC-INV-TURN-019 — No hidden external authority**  
No blockchain read, oracle, mutable service, local clock, or client callback may be consulted inside the pure advancement reducer.

**SC-INV-TURN-020 — Fail closed**  
Unknown phase states, impossible priority configurations, malformed automatic work, or incompatible engine versions must halt/reject rather than guess a transition.

## 23. Exit criteria

SC-3.3 is complete when:

- the full V1 phase cycle is formally executable from START through END and back to START;
- automatic phase work has canonical boundaries;
- priority opening/closing and Stack gating are deterministic;
- phase-boundary triggers/decisions are explicit;
- turn ownership handoff is replay-stable;
- timeout behavior is command-driven;
- terminal conditions prevent further advancement;
- cross-system wallet/collectible neutrality remains intact.

The next phase may implement the generic deterministic command validation / action-legality pipeline that consumes this turn/phase state.
