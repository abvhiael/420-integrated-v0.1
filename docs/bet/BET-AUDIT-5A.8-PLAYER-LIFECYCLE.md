# BET 5A.8 — Player disconnect, reconnection, sitting out and leaving

## Authority and behavior

Transport connectivity is not an on-chain fact. A coordinator, websocket, browser
or indexer cannot declare a player disconnected, fold them, extend a clock,
withdraw their chips, recover their private key or alter an accepted hand.
Only a seat owner with the table's existing sit-out capability can record their
connectivity intent. An objectively expired native turn still follows 5A.5:
check when no bet is owed, otherwise fold. The engine then records next-hand
sit-out intent. Neither policy confiscates an all-in player's showdown claim.

`PokerSeatLedger420.PlayerLifecycle` stores an intent nonce, owner-reported
disconnect flag, next-hand sit-out intent and queued leave flag separately from
the funded `Seat` and escrow snapshots. `setDisconnected`, `requestSitOut`,
`requestLeave` and `cancelLeave` bind the current seat epoch and intent nonce.
This rejects stale reconnect writes, old-seat writes, and intentions overtaken
by an actual timeout. Only the immutable table-bound settlement coordinator may
call `markTimedOut`, for a seat in that exact active reserved hand.

While a hand is funded, presence/exit requests do not change its seat epoch,
seating snapshot, player balances, action key, action root, turn or deadline.
The player may still submit an otherwise valid signed action. An accepted deal
with locked escrow may finish private delivery and start after such a request;
new, unfunded deals and reservations exclude disconnected, sitting-out and
leaving seats. A change of idle eligibility advances the seating epoch, preventing
an unfunded old deal from becoming valid again after toggling out and back in.

Settlement and canonical refund apply pending eligibility atomically after
checking the original snapshot. No money is sent merely because a player is
disconnected. Reconnection and cancelling leave preserve sit-out intent; an
explicit authorized return is required for another hand. A player cannot return
while still disconnected or leaving. Existing blind/button rotation and buy-in
rules continue to apply; no new transport-selected blind or penalty is added.

`completeLeave` can be delivered by any relayer after the hand unlocks, using the
current seat epoch and lifecycle nonce. It requires a recorded owner leave
request and rechecks that owner's live leave/withdraw capabilities against the
actual settled balance. It always pays that owner. Pauses, operator suspension
and the new-table emergency do not strand an otherwise authorized exit. Failed
token transfers and callbacks roll back the whole exit. Zero-chip exits do not
depend on a token accepting a zero-value transfer. Leaving removes lifecycle
state and advances the seating epoch; a replacement seat requires a new action
key binding. Revocation can block payment but cannot destroy the escrow claim.
The legacy immediate `leave` and locked-hand `sitOut` behavior remain available.

## Reconnection

`PokerPlayerRecovery420` is a read-only projection pinned to one engine and its
ledger. A bounded nine-seat snapshot provides chain/block/time anchors, seat
ownership and epoch, lifecycle nonce, current action signer and serial, funded
hand/snapshot, deal, game/turn, public player accounting, evidence/recovery
deadlines, action/terminal roots and the canonical settlement receipt. Explicit
hand selection retains terminal receipts after cashout. Unknown hands, wrong
tables and zero player addresses reject. No plaintext private card, recipient
secret, shuffle secret or signing secret is returned.

`nlhe-player-lifecycle.mjs` reads a caller-pinned canonical block through an RPC
adapter and rechecks the block hash before publishing recovered state. The
adapter must use EIP-1898 `requireCanonical` or equivalent verified block reads;
the chain and deployed source contracts must be pinned by the caller. Local
guards invalidate cached actions on seat/key/intent/hand/root/nonce/deadline
changes, expiry, terminal state or wrong turn. RPC data is a presentation input,
never a substitute for the engine's canonical signature and state checks.
There is no automatic write retry or client-controlled clock reset. Loss of a
private encryption key uses the existing bounded evidence recovery policy;
reconnection never fabricates possession or decryptability.

## Focused qualification

The Level 2 workflow requires 25 actual `test58` native cases, 12 independent
client unit cases, actual reconnect/timeout/settlement trace replay and deployed
projection/ledger runtime identities, plus fresh direct seating/deal regressions.
All inherited mandatory 5A.5–5A.7 cases, rules/recovery/settlement owners, both
genuine proof bundles, funded control and ten adversarial scenarios remain
required. The projection is added to actual static analysis; unresolved scoped
High/Medium findings fail closed. Runtime/initcode sizes and the actual engine
constructor gas budget remain acceptance gates.

No new proving setup or proof material is necessary: the deterministic funded
hand context remains identical, and the existing 82 Groth16 statement/proof
checks must execute under the seven original verifying keys. Historical green
evidence is inherited only for identical source identities. The changed deal
and custody owners receive fresh execution. Missing/skipped native cases,
missing reconnect trace, a mismatched source SHA or a dirty tree cannot certify.

This defines local Level 1/Level 2 scope. It does not grant Level 3, a live
deployment, wager acceptance, an independently reviewed trusted setup or legal
operator approval. Unrelated 420Arcade documentation and global compiler checks
remain separate from this focused qualification.
