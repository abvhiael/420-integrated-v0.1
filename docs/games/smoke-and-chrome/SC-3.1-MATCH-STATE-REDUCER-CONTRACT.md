# SC-3.1 — Canonical MatchState, command envelope, event envelope, and pure reducer contract

## Status

Frozen for V1 deterministic engine implementation.

This document defines the authoritative match-state machine contract for Smoke & Chrome. SC-1 freezes the game rules. SC-2 freezes the canonical gameplay and collectible data models. SC-3.1 defines how those frozen inputs become deterministic, replayable state transitions.

The engine model is:

`AdmissionPackage + InitialSeed + OrderedCommands -> OrderedEvents -> MatchState`

For any valid admitted match, the same pinned inputs, command order, RNG stream, and reducer version MUST produce byte-for-byte equivalent canonical state and event hashes.

---

## 1. Authority model

There is exactly one authoritative gameplay state machine per match.

The reducer MUST be deterministic, side-effect free with respect to gameplay semantics, and incapable of consulting mutable external state during command reduction.

The reducer MUST NOT read or depend on:

- wall-clock time,
- local client time,
- network timing,
- wallet balances,
- marketplace state,
- current blockchain head,
- mutable ownership state,
- mutable latest card registries,
- unpinned release manifests,
- process-global randomness,
- platform-specific locale ordering,
- UI state.

All gameplay-relevant authority MUST arrive through the admitted match package, current MatchState, the canonical command envelope, and the pinned RNG state.

---

## 2. Canonical MatchState

V1 canonical state SHOULD expose a schema equivalent to:

```ts
interface MatchState {
  schemaVersion: string;
  engineVersion: string;
  rulesetVersion: string;
  matchId: string;
  admissionHash: string;
  releaseManifestHash: string;
  legalitySnapshotHash: string;
  abilityRegistryHash: string;
  effectRegistryHash: string;
  rngVersion: string;

  lifecycle: MatchLifecycle;
  turnNumber: number;
  activePlayerId: PlayerId;
  priorityPlayerId: PlayerId | null;
  phase: PhaseId;
  step: string | null;

  players: Record<PlayerId, PlayerMatchState>;
  districts: DistrictState[];
  streets: StreetState[];
  stack: StackItem[];
  objects: Record<ObjectId, RuntimeObject>;
  zones: ZoneIndex;

  pendingDecision: PendingDecision | null;
  pendingTriggers: PendingTrigger[];
  replacementContext: ReplacementContext | null;

  rng: MatchRngState;
  sequence: MatchSequenceState;
  terminal: TerminalState | null;

  stateHash: string;
}
```

The exact implementation language is not normative. The canonical field semantics, serialization rules, and transition invariants are normative.

---

## 3. Lifecycle

Canonical lifecycle values:

- `ADMITTED`
- `INITIALIZING`
- `ACTIVE`
- `PAUSED_FOR_DECISION`
- `TERMINAL`
- `INVALID`

A match MAY enter `INVALID` only for deterministic integrity failure such as irreconcilable state corruption, registry mismatch, invalid replay material, impossible reducer branch, or explicit fail-closed integrity condition.

Transport disconnection alone MUST NOT make a match `INVALID`.

---

## 4. Player match state

A player state SHOULD contain canonical fields equivalent to:

```ts
interface PlayerMatchState {
  playerId: string;
  seat: number;
  stability: number;
  resources: {
    flow: number;
    flowCapacity: number;
    flower: number;
    data: number;
    heat: number;
  };
  leaderObjectId: string;
  deckZoneId: string;
  handZoneId: string;
  discardZoneId: string;
  exileZoneId: string;
  operationZoneId: string;
  cultivationZoneId: string;
  conceded: boolean;
  timeoutState: TimeoutState | null;
}
```

Wallet identity, token balances, edition rarity, marketplace value, printing serial, and collectible provenance MUST NOT be stored in authoritative player gameplay state.

---

## 5. Command envelope

Every player or system intent entering the reducer MUST use a canonical envelope equivalent to:

```ts
interface CommandEnvelope<TPayload = unknown> {
  schemaVersion: string;
  commandId: string;
  matchId: string;
  actorId: string;
  actorSeat: number | null;
  commandType: string;
  payload: TPayload;
  expectedSequence: number;
  expectedStateHash: string;
  clientNonce?: string;
  source: "PLAYER" | "SYSTEM" | "TIMEOUT" | "REPLAY";
}
```

`commandId` MUST be unique within the match command domain.

`expectedSequence` and `expectedStateHash` provide optimistic concurrency protection. A command targeting stale authoritative state MUST fail deterministically rather than being silently reinterpreted against a newer state.

Client nonces MAY assist transport deduplication but MUST NOT become gameplay entropy.

---

## 6. Command validation pipeline

Command processing MUST occur in deterministic order:

1. schema validation,
2. match identity validation,
3. duplicate-command check,
4. sequence check,
5. state-hash check,
6. lifecycle eligibility,
7. actor authorization,
8. timing/priority eligibility,
9. target/object/zone existence,
10. cost and precondition validation,
11. ruleset legality,
12. effect-specific validation,
13. RNG requirement calculation,
14. event derivation,
15. event reduction,
16. invariant validation,
17. canonical state hashing.

Invalid commands MUST NOT partially mutate state.

---

## 7. Command result

A reducer invocation SHOULD yield one of:

```ts
type CommandResult =
  | {
      accepted: true;
      commandId: string;
      previousStateHash: string;
      events: EventEnvelope[];
      nextState: MatchState;
      nextStateHash: string;
    }
  | {
      accepted: false;
      commandId: string;
      previousStateHash: string;
      rejection: CommandRejection;
    };
```

Rejected commands MUST leave authoritative gameplay state and RNG counters unchanged unless a separately defined system policy explicitly models the rejection itself as an authoritative event. V1 baseline does not require rejection events in the match event stream.

---

## 8. Canonical rejection codes

V1 MUST support stable rejection categories including at minimum:

- `SC_CMD_SCHEMA_INVALID`
- `SC_CMD_MATCH_MISMATCH`
- `SC_CMD_DUPLICATE`
- `SC_CMD_SEQUENCE_STALE`
- `SC_CMD_STATE_HASH_MISMATCH`
- `SC_CMD_MATCH_NOT_ACTIVE`
- `SC_CMD_ACTOR_UNAUTHORIZED`
- `SC_CMD_NO_PRIORITY`
- `SC_CMD_WRONG_PHASE`
- `SC_CMD_OBJECT_UNKNOWN`
- `SC_CMD_ZONE_ILLEGAL`
- `SC_CMD_TARGET_ILLEGAL`
- `SC_CMD_COST_UNPAYABLE`
- `SC_CMD_PRECONDITION_FAILED`
- `SC_CMD_RULESET_ILLEGAL`
- `SC_CMD_DECISION_REQUIRED`
- `SC_CMD_TERMINAL_MATCH`
- `SC_CMD_INTEGRITY_FAILURE`

Rejection codes MUST be deterministic for equivalent invalid inputs.

---

## 9. Event envelope

Accepted commands produce zero or more canonical authoritative events.

```ts
interface EventEnvelope<TPayload = unknown> {
  schemaVersion: string;
  eventId: string;
  matchId: string;
  eventSequence: number;
  causationCommandId: string | null;
  correlationId: string;
  eventType: string;
  payload: TPayload;
  rngTrace?: RngTraceRef[];
  previousStateHash: string;
  resultingStateHash: string;
}
```

Events MUST be ordered, immutable, replayable, and sufficient to reconstruct state when combined with the canonical admitted initial state.

`eventId` SHOULD derive deterministically from match identity, event sequence, event type, and canonical payload hash rather than environment-generated randomness.

---

## 10. Event granularity

Events represent authoritative state transitions, not UI animations.

Examples include:

- `MATCH_INITIALIZED`
- `TURN_STARTED`
- `PHASE_CHANGED`
- `CARD_DRAWN`
- `OBJECT_CREATED`
- `OBJECT_MOVED`
- `RESOURCE_CHANGED`
- `COST_PAID`
- `STACK_ITEM_CREATED`
- `STACK_ITEM_RESOLVED`
- `DAMAGE_ASSIGNED`
- `DAMAGE_APPLIED`
- `COUNTER_CHANGED`
- `CONTROL_CHANGED`
- `CULTIVATION_STAGE_CHANGED`
- `DISTRICT_INFLUENCE_CHANGED`
- `DISTRICT_CONTROL_CHANGED`
- `RNG_CONSUMED`
- `DECISION_OPENED`
- `DECISION_RESOLVED`
- `PLAYER_CONCEDED`
- `MATCH_TERMINATED`

A single command MAY emit multiple events. Their ordering is authoritative.

---

## 11. Pure reducer contract

Conceptually:

```ts
reduce(
  previousState: MatchState,
  command: CommandEnvelope,
  pinnedContent: PinnedGameplayContent
): CommandResult
```

The reducer MUST be a pure deterministic function of those inputs.

Any required randomness MUST come from `previousState.rng`, following SC-1.11. The reducer MUST NOT obtain entropy from the host environment.

Any required card/rules/ability/effect information MUST come from the hash-pinned admitted content set defined by SC-2.

---

## 12. Event application

The event reducer SHOULD be separately expressible as:

```ts
applyEvent(state: MatchState, event: EventEnvelope): MatchState
```

Replay MUST be capable of rebuilding authoritative state by applying the ordered event stream from the canonical initial state.

Command handling MAY derive events using full rules logic, but event application MUST NOT need to consult mutable external state.

---

## 13. Sequence model

Match state MUST contain monotonically increasing deterministic counters.

Recommended minimum:

```ts
interface MatchSequenceState {
  commandSequence: number;
  eventSequence: number;
  objectSequence: number;
  decisionSequence: number;
  stackSequence: number;
}
```

Generated IDs SHOULD derive from match ID plus the applicable deterministic sequence counter.

Reconnect, retry, host migration, and replay MUST NOT allocate different authoritative IDs for the same transition.

---

## 14. Idempotency

A previously accepted `commandId` submitted again MUST NOT execute twice.

The engine MUST return the prior deterministic result or a canonical duplicate outcome without:

- paying costs twice,
- consuming RNG twice,
- emitting duplicate events,
- creating duplicate RuntimeObjects,
- advancing counters twice.

Transport retries are therefore semantically harmless.

---

## 15. State hashing

Every accepted transition MUST produce a canonical state hash.

The hash input MUST include all authoritative gameplay state and MUST exclude non-authoritative presentation metadata.

State hashing MUST use:

- canonical key ordering,
- canonical array ordering,
- canonical number representation,
- explicit schema/version identifiers,
- explicit null/absence semantics,
- deterministic serialization.

The state hash MUST NOT include:

- local timestamps,
- animation state,
- network metrics,
- device identifiers,
- wallet balances,
- marketplace values,
- artwork download locations,
- edition cosmetic metadata unless separately committed outside gameplay state.

---

## 16. Hidden information

The authoritative MatchState MAY contain hidden gameplay information required for deterministic execution.

Clients MUST receive projected views, not unrestricted authoritative state.

Projection MUST be a pure function equivalent to:

```ts
projectState(authoritativeState, viewerScope): PublicOrPrivateView
```

Projection MUST NOT mutate authoritative state.

Opponent hidden card identities, future deck order, protected RNG material, and unrevealed choices MUST remain inaccessible until rules permit disclosure.

---

## 17. Decisions

When a rules effect requires player input, the engine MUST open an explicit `PendingDecision`.

A decision MUST pin:

- decision ID,
- eligible actor,
- decision type,
- legal option domain or deterministic option predicate,
- minimum/maximum selections,
- ordering requirements,
- timeout policy reference,
- originating effect/stack item,
- state hash at decision creation.

While a mandatory decision is open, unrelated commands MUST fail unless explicitly permitted by the rules.

A reconnect MUST restore the same pending decision without regenerating options or consuming RNG again.

---

## 18. RNG integration

SC-1.11 remains authoritative.

SC-3.1 adds the engine constraint that RNG is consumed only by an accepted committed transition.

Invalid/stale/duplicate commands MUST NOT advance the RNG stream.

Every authoritative RNG consumption MUST be traceable to:

- RNG domain,
- pre-consumption counter,
- bounded-selection or shuffle request,
- causation command/event,
- post-consumption counter.

The live seed MAY remain protected while the match is active, but replay/audit material MUST support deterministic verification after the appropriate disclosure boundary.

---

## 19. Atomicity

Each accepted command is atomic from the perspective of authoritative state.

The engine MUST either:

- fully derive and apply its legal ordered event batch and commit the resulting state, or
- reject/fail closed with no partial authoritative transition.

Persistence-layer implementation MAY use transactions, append-only logs, snapshots, or equivalent mechanisms, but partial visible gameplay commits are forbidden.

---

## 20. Terminal state

When SC-1 terminal rules produce a terminal match result, MatchState MUST store an immutable terminal record equivalent to:

```ts
interface TerminalState {
  terminalSequence: number;
  result: "PLAYER_A_WIN" | "PLAYER_B_WIN" | "DRAW" | "INVALID";
  reasonCode: string;
  winningPlayerId: string | null;
  losingPlayerId: string | null;
  terminalEventId: string;
  finalStateHash: string;
}
```

Once terminal, ordinary gameplay commands MUST be rejected.

Post-match persistence, reward claims, collectible settlement, ranking submission, and tournament reporting are external workflows and MUST NOT rewrite the terminal gameplay state.

---

## 21. Snapshot and replay

Implementations MAY persist periodic snapshots for performance.

A snapshot MUST be identified by:

- match ID,
- event sequence,
- canonical state hash,
- engine/schema version.

Snapshots are caches, not alternate authority.

The append-only ordered event history plus initial admitted state remains sufficient to verify the canonical state chain.

---

## 22. Host migration / server restart

A server restart or host migration MUST reconstruct the same authoritative MatchState from persisted canonical material.

No transition may depend on in-memory-only counters, unordered map iteration, process IDs, random UUIDs, timers that were not modeled canonically, or local timestamps.

---

## 23. Timeouts

Wall-clock measurement belongs to transport/orchestration, not the reducer.

When a timeout policy determines that gameplay action is required, orchestration MUST submit a canonical system command such as:

- `TIMEOUT_PASS_PRIORITY`
- `TIMEOUT_SELECT_DEFAULT`
- `TIMEOUT_CONCEDE`

The reducer processes that command deterministically like any other command.

This keeps elapsed real time outside the authoritative game function while preserving deterministic timeout consequences.

---

## 24. Match initialization

Initialization MUST consume the immutable MatchAdmissionPackage and create the complete initial authoritative state.

Initialization MUST deterministically:

1. validate all pinned hashes,
2. establish seats,
3. construct player state,
4. instantiate Leader RuntimeObjects,
5. instantiate deck RuntimeObjects from CardDefinitions only,
6. assign deterministic object IDs,
7. perform canonical deck shuffle through SC-1.11 RNG,
8. establish starting resources and Stability,
9. create shared District/Street topology,
10. set starting player using the canonical V1 start-player policy,
11. perform opening-hand setup when defined,
12. emit the initialization event chain,
13. produce the first active state hash.

Printing/Edition provenance MUST NOT affect runtime object construction.

---

## 25. Canonical command families

SC-3 implementation SHOULD support explicit command families instead of free-form mutation calls, including:

- match setup commands,
- priority/pass commands,
- play/cast commands,
- activated-ability commands,
- target/choice commands,
- attack declaration commands,
- block declaration commands,
- cultivation commands,
- decision-resolution commands,
- concession commands,
- timeout/system commands.

Each family MUST have schema-versioned payloads.

---

## 26. No direct state mutation API

External callers MUST NOT receive a generic capability such as:

`setState(path, value)`

or

`applyArbitraryPatch(patch)`

Authoritative transitions MUST enter through recognized validated command types and produce recognized canonical events.

Administrative tooling MUST not bypass the reducer for active competitive matches.

---

## 27. Engine/version pinning

Every match MUST pin an engine reducer version compatible with the admitted ruleset/schema set.

A running or replayed match MUST never silently switch to a newer reducer implementation.

Breaking semantic changes require a new engine version.

Historical reducer implementations or deterministic compatibility modules MUST remain available for replay verification of supported historical matches.

---

## 28. Failure semantics

Internal integrity failure MUST fail closed.

Examples:

- impossible zone duplication,
- missing pinned CardDefinition,
- event sequence gap,
- RNG counter mismatch,
- hash-chain mismatch,
- malformed stack reference,
- orphan attachment,
- invalid terminal transition.

The engine MUST NOT guess, auto-heal silently, or consult mutable current state to repair an authoritative competitive match.

---

## 29. SC-3.1 invariants

### SC-INV-ENGINE-001 — Pure authority
For identical canonical inputs, reducer output is identical.

### SC-INV-ENGINE-002 — No external mutable dependency
Command reduction never depends on mutable external/chain/wallet/marketplace state.

### SC-INV-ENGINE-003 — Atomic command processing
Rejected or failed commands do not partially mutate authoritative state.

### SC-INV-ENGINE-004 — Idempotent command IDs
A duplicate accepted command cannot execute twice.

### SC-INV-ENGINE-005 — Monotonic sequencing
Command, event, object, decision, and stack sequences never move backward or fork within one authoritative match history.

### SC-INV-ENGINE-006 — Replay equivalence
Initial admitted state plus ordered canonical events reproduces the authoritative state hash chain.

### SC-INV-ENGINE-007 — Deterministic IDs
Authoritative object/event/decision IDs do not depend on random UUIDs or process-local entropy.

### SC-INV-ENGINE-008 — RNG commit discipline
Only accepted committed gameplay transitions consume match RNG.

### SC-INV-ENGINE-009 — Stale-state rejection
Commands targeting a mismatched sequence or state hash cannot be silently applied to newer state.

### SC-INV-ENGINE-010 — Hidden-state projection
Viewer projections cannot mutate authoritative state or reveal protected information.

### SC-INV-ENGINE-011 — Printing neutrality
Edition/Printing metadata cannot enter competitive state transitions.

### SC-INV-ENGINE-012 — Wallet neutrality
Wallet state cannot modify command validity, stats, costs, RNG, priority, draw odds, or competitive transitions except for pre-match entitlement gates outside the admitted gameplay package.

### SC-INV-ENGINE-013 — Terminal immutability
Once terminal, gameplay state cannot resume or be rewritten by reward/market/ranking workflows.

### SC-INV-ENGINE-014 — Snapshot non-authority
Snapshots may accelerate restoration but cannot define a competing match history.

### SC-INV-ENGINE-015 — Version pinning
An admitted match never silently changes engine/rules/schema versions.

### SC-INV-ENGINE-016 — Fail closed
Integrity ambiguity produces deterministic rejection/invalid state rather than guessed gameplay behavior.

### SC-INV-ENGINE-017 — Canonical event ordering
Event order is authoritative and stable for equivalent command/state inputs.

### SC-INV-ENGINE-018 — Reconnect neutrality
Reconnect cannot alter RNG, object IDs, decisions, priority, phase, resources, or any gameplay state.

### SC-INV-ENGINE-019 — Timeout modeling
Elapsed wall-clock time never directly mutates gameplay state; timeout effects enter through canonical system commands.

### SC-INV-ENGINE-020 — No arbitrary mutation path
All active-match gameplay mutation flows through recognized command validation and canonical event reduction.

---

## 30. Exit criteria

SC-3.1 is complete when:

- MatchState semantics are frozen,
- command and event envelopes are frozen,
- pure reducer authority is defined,
- state/event hashing requirements are defined,
- deterministic sequencing and IDs are defined,
- idempotency semantics are defined,
- hidden-state projection is defined,
- decision handling is defined,
- RNG commit semantics are tied into the reducer,
- atomicity and failure rules are defined,
- terminal immutability is defined,
- replay/snapshot behavior is defined,
- engine version pinning is defined,
- the SC-3.1 invariants are accepted.

SC-3.2 may then define deterministic match initialization, opening setup, opening hand, mulligan, first-player selection, and transition into the first START phase in executable-engine detail.
