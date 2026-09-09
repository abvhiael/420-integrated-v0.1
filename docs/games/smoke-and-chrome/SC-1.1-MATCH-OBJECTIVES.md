# Smoke & Chrome — SC-1.1 Match Objectives & Victory Conditions

Status: FROZEN for SC-1.1

## Purpose

SC-1.1 defines the canonical match objective model for Smoke & Chrome. Later rules, board zones, card text, matchmaking and deterministic engine logic MUST preserve these semantics unless a future versioned ruleset explicitly supersedes them.

## Design intent

Smoke & Chrome is a contest for control of a criminal/countercultural city economy, not a generic hit-points race. The primary win condition therefore centers on District influence while retaining an explicit elimination path so combat, sabotage and attrition remain meaningful.

## Canonical V1 victory model

A player wins a standard constructed match by satisfying either canonical victory condition:

1. **Dominance Victory** — control the required number of contested Districts at the end of the player's Resolution step and survive the verification window.
2. **Collapse Victory** — reduce the opposing player's Stability to zero or otherwise cause a rules-defined Collapse state.

Alternative card-, scenario- or tournament-defined victory conditions MAY exist later, but they MUST be explicit, deterministic and ruleset-versioned. No implicit or off-chain discretionary win condition is permitted.

## 1. Dominance Victory

### District objective

A standard V1 match uses a shared set of contested Districts. The exact board topology and District count are frozen in SC-1.2, but SC-1.1 freezes the objective semantics now.

A player achieves **Dominance** when that player controls the V1-required majority threshold of contested Districts at the end of their Resolution step.

### Verification window

Dominance does not resolve the instant control changes. At the end of Resolution:

1. determine control of every contested District;
2. evaluate the majority threshold;
3. resolve mandatory end-of-Resolution triggers;
4. re-evaluate control after those triggers;
5. if the same player still satisfies Dominance, declare that player the winner.

This prevents a transient mid-stack or mid-effect state from ending a match.

### Control semantics

SC-1.1 defines only the objective relationship: **District control is determined by Influence according to SC-1.9.** Exact ties, contest rules, neutralization and Influence calculation are deferred to SC-1.9.

A tied/contested District does not count as controlled by either player unless the later Influence rules explicitly state otherwise.

## 2. Collapse Victory

Each player has a match-level survivability value called **Stability**.

### Stability

- Stability is distinct from Flow, Flower, Data and Heat.
- Stability represents the resilience of the player's operation: leadership, logistics, safehouses, supply, public cover and organizational cohesion.
- Stability is not a spendable resource.
- The starting Stability value is frozen later during numerical balance, but the defeat semantics are frozen here.

### Collapse

A player enters **Collapse** when their Stability is zero or less after state-based resolution.

A Collapsed player loses the match unless a simultaneous-result rule below applies.

Cards may damage, restore, prevent or modify Stability only when their rules text explicitly permits it.

## 3. Objective priority

The engine MUST evaluate match-ending state in the following deterministic order after the completion of an atomic resolution window:

1. illegal/invalid match state check;
2. mandatory state-based effects;
3. simultaneous Collapse evaluation;
4. Dominance evaluation when the current rules window permits it;
5. explicit alternate-win/alternate-loss effects;
6. continue the match if no terminal state exists.

No UI animation, blockchain transaction, wallet state or external service may alter this order.

## 4. Simultaneous defeat / terminal states

### Both players Collapse

If both players enter Collapse from the same atomic effect or state-based evaluation, the result is a **draw** unless the resolving effect explicitly defines a winner.

### Dominance and Collapse together

If a player would satisfy Dominance while simultaneously entering Collapse in the same terminal evaluation, Collapse takes precedence: that player cannot win by Dominance while Collapsed.

If the opponent is also Collapsed in that same atomic evaluation, the match is a draw unless an explicit effect says otherwise.

### Multiple victory conditions

If one player satisfies multiple victory conditions in the same legal terminal window, the result remains a single win; no condition grants additional competitive reward weight unless a tournament format explicitly defines a separate scoring system.

## 5. Concession

A player may concede at any time the rules engine permits player priority or through an out-of-band match-control action provided by the authoritative server.

Concession:

- immediately awards the opponent the match;
- cannot be reversed after the authoritative match service records it;
- does not require a wallet signature;
- MUST NOT trigger blockchain settlement before authoritative match finalization;
- MUST be represented in the replay/event log.

## 6. Timeout / abandonment

Competitive formats may assign a match loss for timeout, repeated inactivity or abandonment.

Timeout rules MUST be defined by the match/tournament format, not inferred by the client.

A network disconnect alone is not an immediate defeat while the configured reconnect window remains open.

## 7. Draw conditions

A standard match may end in a draw only through a rules-defined condition, including:

- simultaneous Collapse;
- deterministic unresolved terminal state explicitly designated a draw;
- tournament clock expiration where the format defines a draw;
- a card/effect that explicitly declares a draw.

Players may not mutually manufacture an authoritative draw unless the format explicitly supports intentional draws.

## 8. Deck exhaustion

Running out of cards is NOT, by itself, an immediate loss in V1.

When a player must draw from an empty deck, the game applies **Burnout** according to the later draw/resource rules. Burnout must create escalating strategic pressure and may ultimately cause Collapse, but the precise numerical implementation is deferred to SC-1.4/SC-1.6.

This keeps long matches playable while preventing indefinite deck-loop stalemates.

## 9. No pay-to-win objective modifiers

Wallet, collectible edition, foil status, ownership provenance, marketplace history, token holdings or cross-game prestige MUST NOT alter:

- the District threshold required for Dominance;
- starting Stability;
- Collapse thresholds;
- tie-breaking inside core match rules;
- draw odds;
- objective evaluation order;
- tournament match points except where a tournament rule applies equally to all entrants.

Owned editions may alter presentation and entitlement, never competitive objective math.

## 10. Authoritative finalization

The match engine / authoritative match service determines the terminal result.

Blockchain components MAY later record or settle:

- tournament prizes;
- collectible rewards;
- achievements;
- season attestations;
- provenance-linked rewards.

They MUST NOT independently decide who won a live match.

The canonical terminal record should contain at minimum:

- match ID;
- ruleset version;
- winner or draw;
- terminal reason;
- final deterministic state hash;
- ordered event/replay commitment;
- authoritative finalization timestamp/sequence.

## 11. Terminal reason codes

The deterministic engine SHOULD expose stable reason codes rather than free-text outcomes.

Minimum V1 codes:

- `SC_WIN_DOMINANCE`
- `SC_WIN_OPPONENT_COLLAPSE`
- `SC_WIN_OPPONENT_CONCEDED`
- `SC_WIN_OPPONENT_TIMEOUT`
- `SC_WIN_ALTERNATE_EFFECT`
- `SC_DRAW_SIMULTANEOUS_COLLAPSE`
- `SC_DRAW_FORMAT_TIMEOUT`
- `SC_DRAW_EFFECT`
- `SC_INVALID_MATCH_STATE`

These names may be encoded differently in implementation, but their semantics must remain stable within the V1 ruleset.

## 12. SC-1.1 invariants

### SC-INV-OBJ-001 — deterministic terminal result
Identical initial state, RNG seed and ordered legal actions MUST produce the same winner/draw and terminal reason.

### SC-INV-OBJ-002 — no transient Dominance
A temporary District majority during effect/stack resolution MUST NOT end a match.

### SC-INV-OBJ-003 — Collapse precedence
A player in Collapse cannot win through Dominance in the same terminal evaluation.

### SC-INV-OBJ-004 — wallet neutrality
Wallet linkage and owned collectible edition MUST NOT alter objective thresholds or terminal evaluation.

### SC-INV-OBJ-005 — authoritative engine
No chain, wallet, marketplace or client-side UI component may independently declare a canonical match winner.

### SC-INV-OBJ-006 — replay completeness
Every canonical terminal result MUST be derivable from the authoritative replay/event sequence.

### SC-INV-OBJ-007 — explicit draws
The engine MUST NOT emit a draw unless a versioned rules condition explicitly permits it.

## 13. Deferred to later SC-1 slices

SC-1.1 intentionally does not freeze:

- exact number/layout of Districts — SC-1.2;
- turn phases and timing windows — SC-1.3;
- starting Stability number — balance pass / SC-1.4;
- resource numbers — SC-1.4;
- Stack/priority details — SC-1.6;
- combat damage rules — SC-1.7;
- cultivation victory interaction — SC-1.8;
- Influence/control calculation — SC-1.9;
- deck construction — SC-1.10;
- RNG — SC-1.11.

## SC-1.1 acceptance gate

SC-1.1 is complete when:

- the two canonical V1 victory paths are frozen;
- Collapse, draw and simultaneous-result semantics are frozen;
- objective evaluation is deterministic;
- blockchain/wallet authority boundaries are explicit;
- objective invariants are documented;
- later SC-1 slices can depend on this file without redefining match victory semantics.
