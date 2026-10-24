# BET 5A.4 — Workstream 6 independent NLHE replay and atomic settlement

## Settlement authority and authentication

The player's current seat/epoch action key, rather than a table controller signature, authorizes the action. `PokerActionKeys420.checkSignature` verifies canonical low-s secp256k1 signatures bound to chain, engine, hand, table, configuration, ruleset, seat-snapshot, signer serial, nonce, expected game state and expiry. `PokerNLHEBetting420.action` enforces the only legal actor and timing, consumes the engine's monotonically increasing nonce by recording the move and commits the ensuing state transition. `timeout` is permissionless but only after the pending actor's on-chain deadline and can produce only an objectively forced check/fold.

WS6 additionally records a domain-separated `actionTranscriptRoot` for every signed action and time-out, including prior and resulting state roots, seat, move, amount, nonce, signing digest, signature bytes hash and expiry or immutable timer. SignedActionEvidence and TimeoutActionEvidence preserve the exact evidence needed for independent off-chain replay. A terminal settlement seals both the final action state and this ordered transcript commitment with the original funded escrow snapshot, the bound calculation implementation hash, the complete nine-seat payoff vector, fee and immutable table rake policy.

## Native independent outcome

The sole ledger settlement coordinator remains the authenticated NLHE engine. No caller can pass winners or amounts. It calls the one-time bound native outcome calculator, which ranks five-of-seven genuine showdown cards for each nonfolded participating seat, calculates tiered multiway pots by actual contribution levels, refunds uniquely uncalled overbets, handles ties and allocates odd chips clockwise from the button. Every payout includes the canonical policy's no-flop/no-drop conditions, fee rate and cap; the registered rake policy hash must match the table configuration. Its output must conserve all original player chips and fee, and `PokerSeatLedger420.settleReservedHand` atomically updates the whole reserved custody vector once.

The accepted stage-two 52-card root is authenticated by the Workstreams 1–4 proofs. The five historical flop/turn/river positions are validated by their permanently recorded `opened` states, which can only be set after both providers' real share proofs and canonical card-unmask proof. They are **not** re-queried through `isStageComplete` for old live streets: after entering showdown those predicates intentionally fail closed, so reusing them would deadlock every valid contested settlement. Stage four itself must be fully proof-complete, and both frozen hole-card physical positions for every surviving seat must be opened. This is a necessary correction to the prior Workstream 4/Workstream 6 integration boundary.

The native calculator's deployed runtime code hash is pinned when the engine binds it once. Settlement and disputed outcome proposal reject runtime-code changes to that binding. A result proposal in a disputed hand uses the same independently calculated balances, policy and state-root-bound native-resolution hash; a competing operator-chosen vector has no trusted submission path. The pre-existing deterministic appeal lifecycle, original-snapshot void and separated provider-bond vault from Workstream 5 remain authoritative.

## Qualification boundaries

Workstream 6 Level 1 owns:
- Current seat signed action and timeout history with exact state/nonce transcript commitments, replay protection and unique final settlement.
- Real funded complete flop/turn/river/showdown from individually verified public reveal slots through `PokerNativeOutcome420.calculate` and `PokerNLHEBetting420.settle`, including chip conservation and exact ledger balances.
- Direct tests of the **same production native side-pot kernel** for short all-in tiers, noneligible folded contributors, clockwise odd-chip tie splitting and nine-seat conservation with rake.
- Pure independent interpreter checks for 2–9-seat button/blind mechanics, forced timeouts, signed/epoch/nonce/expected-root requirements, illegal reopens, multiseat side pots and all-card ranking comparisons. The JavaScript interpreter is a second implementation, not the authoritative chain ledger or a signature oracle. Its boolean authentication inputs are to be produced by independently validated on-chain signature and transcript evidence, not by arbitrary controllers.
- Pinned compiler variant for isolated funded Foundry tests as used in Workstreams 3–5; no reduction in contract security assertions and no redundant proof generation.

The legitimate production proof chain inherited from Workstreams 1–5 is not recertified by mock test fixtures. A production cryptographic audit, immutable trusted code registration policies, recipient-key custody, and production ceremony remain pre-mainnet qualifications. This workstream does not confer governance authority on a reviewer or settle funds via a controller assertion.
