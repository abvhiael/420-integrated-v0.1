# BET 5A.7 — Showdown, winner determination and settlement

The native engine is the only table-bound custody coordinator. It accepts no
caller-selected winners or payout vectors. Its pinned outcome calculator ranks
authenticated cards using the 5A.6 evaluator, returns uncalled excess, assigns
eligible contribution-tier winners, divides ties and odd chips, and applies the
table's immutable rake policy. The ledger conserves the original reserved chips
and transfers the exact rake atomically.

## Showdown and privacy policy

V1 requires both authenticated hole cards for every nonfolded showdown contender,
including losing contenders. A missing opening cannot be replaced by a claimed
rank or a discretionary muck. All five board cards must also have accepted
provider shares and unmask proofs. Folded hole cards remain private. A hand won
by folds settles without opening the board or anyone's hole cards. Missing
required evidence follows the existing bounded proof/recovery and objectively
attributed provider-bond policy, rather than paying an unverified winner.

`PokerNativeOutcome420.showdownRanks` exposes the authenticated survivor scores
only at a complete showdown through the table's bound reveal channel. It remains
usable for audit after settlement and cashout. Folded and absent seats score zero.

## One settlement authority and immutable receipts

Direct settlement and disputed outcome proposals now use the same admission
guard: initialized terminal hand, no prior settlement or abort, current reserved
hand, matching original escrow snapshot and seat mask, bound reveal channel and
the exact pinned calculator runtime hash. This closes the previous proposal-path
gap: a substituted calculator could propose a false result even though direct
settlement rejected its changed code.

An appended ERC-7201 mapping preserves an immutable settlement receipt containing
the hand's table, final state and action roots, original escrow snapshot, pinned
calculator hash, existing terminal transcript, all nine final balances, rake,
nonce, time, seat mask and contested/uncontested status. The existing transcript
formula and wire methods are retained. A receipt event exports the complete
payout vector for independent replay. Failed dispute finalization, token payment
or bond closure rolls back all receipts, flags, ledger updates and transfers.
Successful late showdown correction also closes its pending recovery flag,
retaining the historical recovery fields and emitting the correction event.
Original-snapshot voids remain distinct from verified winner settlements.

The ledger rejects nonzero payouts outside a table's configured seats as well as
changes to nonparticipating seats. Replay, late actions and recovery cannot alter
a completed receipt. Cashout and table pause do not erase settlement history.
These changes apply to newly deployed code; existing bindings remain immutable.

## Genuine single-winner qualification

The inherited 800-chip funded fixture still qualifies its shared-board tie:
399/399 final chips plus 2 rake. A second, deterministic valid shuffle swaps final
deck positions 0 and 12. Seat 0 receives an ace-high flush against seat 1's
king-high flush; actual native settlement and independent replay must both give
418/380 plus 2 rake. Both independent providers retain their separate 800-chip
bonds. This uses the same real seat keys, recipient delivery, generated verifiers
and funded hand context.

All seven verifying/proving relations are reused. Five identical-public-witness
proofs are retained byte for byte (initial deck, first shuffle, two recipient
proofs and aggregate key). Only the 36 statements affected by the new final deck
root receive new genuine proofs. The generator verifies every reused/generated
proof against the persisted verifying key. Qualification independently recompiles
all seven relations, checks generated verifier/key identity, and verifies all 41
proofs in each bundle: 82 verifications over 77 distinct proof objects. No new
setup ceremony or cryptographic acceptance mock is introduced.

## Execution gates

`PokerShowdown57Test` owns 18 mandatory production-funded cases: tie and single
winner, uncontested privacy, complete survivor openings, premature rejection,
folded-card confidentiality, forged ledger vectors, out-of-table slots, changed
calculator rejection for settlement and proposals, rake and bond failure rollback,
actual token callback rejection, appealed deadline boundaries, durable history
after cashout, wrong policy rejection, late showdown recovery closure and terminal replay/recovery rejection.
Runtime fault injection tests rejection and rollback; it never supplies accepted
cryptographic results.

Level 2 requires fresh exact-SHA execution of all 18 cases, all 32 inherited 5A.5
and eleven 5A.6 mandatory cases, affected native regressions, both genuine proof
bundles, independent executed-hand replay with receipt validation, scoped static
analysis and actual deployment size/constructor-budget evidence. Certificates
reject missing or skipped owners. Unchanged historical sources retain their
recorded cryptographic provenance. This document is scope, not success evidence.
Level 3/live release and unrelated repository compiler/documentation failures
remain separate from this focused qualification.
