# 5A.5 — Blinds, betting rounds, turn authorization and timeouts

This work owns the cash NLHE turn state machine. Qualification requires executed
tests and source-bound evidence; this document is not an acceptance certificate.

## Rules and authority

Tables have two through nine participating seats, including sparse seat masks.
The small blind is half the big blind. Forced posts are capped at actual stacks;
posts are not voluntary actions. The heads-up button posts the small blind and
acts first preflop, then last postflop. On transition to heads-up, a surviving
previous big blind cannot be charged the big blind twice consecutively.

With at least two players able to bet, the nominal big blind is the bring-in even
when its poster is short. A lone player responds only to actual opposing chips;
matched lone players and all-in seats require no artificial actions. A player
cannot raise into an empty side pot. The last full increment sets the minimum
raise. Short raises require all-in and reopen a previously acting player only
when cumulative increases reach a full increment. Calls pay the lesser of the
amount owed and the remaining stack. Every transition conserves chips.

Each of the four betting rounds waits for every pending eligible player. Public
card proofs advance only the corresponding reveal window. All-in runouts still
require actual proofs, even though no strategic betting turns remain. Terminal,
refunded and settled hands cannot reopen betting or accept late public reveals.

Before reservation, scoped governance binds the native resolver and one immutable
30–3600 second turn duration. A starter must use that duration. The native engine
alone commits the actor, next nonce, deadline and state root to the dispute clock.
Controllers cannot replace or expire a native turn through legacy clock APIs.

Actions require the current seated owner's action capability, current signer and
signer serial, hand/chain/contract domain, seat epoch, next nonce, expected state
root and unexpired signature. Any relay may submit the signature. The canonical
actor alone may act. At the exact turn deadline a valid action wins; timeout is
available strictly afterward, to anyone, and checks when nothing is owed or folds
when facing a bet. Each accepted move creates a fresh full-duration next turn.

Pauses, operator suspension and new-hand emergency controls block admission.
Unavailable unstarted hands have a bounded original-escrow refund path even when
delivery is complete. They cannot blame providers for an admission failure.
Already funded play continues objectively. A dispute holds settlement and grants
bounded review; it does not let a participant freeze the betting clock.

These decisions retain the repository's cash rules. The [official TDA rules]
(https://www.pokertda.com/view-poker-tda-rules/) provide reference for heads-up
order, deadline ties and full-raise reopening; this is not a tournament feature.
Antes, straddles, time banks and tournament blind schedules are outside this cash
policy and cannot be introduced by a hand starter.

## Acceptance owners

| Area | Executable evidence |
| --- | --- |
| Every occupied-seat mask, rotation and short blinds | `PokerBettingKernel55Test` |
| Full rounds, cumulative reopening, empty side pots, conservation fuzzing | `PokerBettingKernel55Test` |
| Actual funded admission, immutable policy, action and clock authority | `PokerBettingRounds55Test` |
| Replay, wrong owner/nonce/chain, capability revocation and signer rotation | `PokerBettingRounds55Test` |
| Exact deadline, stale deadlines, permissionless check/fold, settlement | `PokerBettingRounds55Test` |
| Disputes, unavailable-start refund, genuine all-in proofs, late reveals | `PokerBettingRounds55Test` |
| Preserved native betting and outcome behavior | inherited native owners |
| Real funded context, genuine Groth16 proofs and independent replay | WS8 executable owners |

The arithmetic harness invokes the production kernel in isolated unit state. It
does not admit decks, custody funds or constitute cryptographic integration.
The funded owner uses the production fixture and genuine generated verifiers.
Existing proving keys may be reused only for identical circuit relations. Changed
hand contexts require fresh genuine proofs, not relabelled public inputs.

Level 1 must execute the affected owners and verify bundle checksums. Level 2 must
bind actual executed native, cryptographic and independent replay results to the
same clean Git SHA. Historical cryptographic inheritance is valid only where
source identities match; changed native contracts require fresh native tests.
Unrelated 420Arcade documentation failures are a separate owner.
