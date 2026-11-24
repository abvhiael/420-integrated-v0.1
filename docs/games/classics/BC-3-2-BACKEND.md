# BC-3.2 Chess backend

The Chess adapter implements orthodox play under `bc-chess-standard@1.1.0`.
White is seat 0 and Black is seat 1. Placement, side to move, castling
rights and legal en-passant availability determine repetition identity.
Scores use integer half-points. Terminal frames retain the canonical
reason and winner. The production resolver's release boundary still
applies.

## Untimed session persistence

With the Chess adapter explicitly installed, the existing session transport
initializes an untimed game. The transaction stores the sealed rules identity,
snapshot, command receipt, and journal. Verified resume reconstructs the frame
from sealed genesis and accepted actions. Chess resignation passes through
the rules adapter and its terminal result is in the private journal. An
already-started Chess game cannot be cancelled through the match action route.
Pre-start cancellation uses the room lifecycle.

Canonical FEN describes board state for analysis and test fixtures. It cannot
restore a match. The backend PGN export authorizes seated participants, verifies
a repeatable-read session snapshot and derives SAN and the result from the
accepted trace. Export metadata is supplied by the trusted caller in seat order.

## Timed sessions

The existing start endpoint accepts an optional Chess `clockProfile`. Omit it
or use `untimed` for an untimed match. Use `timed` for the 10+0 default, or
supply a canonical preset such as `3+2`. The first successful start freezes the
profile. The private journal records server timestamps in integer milliseconds.
Cold replay reconstructs the balances and deadline from genesis and checks
the result against the committed session. Expiration uses the Chess rules
adapter and journals flag fall atomically with the final board and clocks.

## Qualification scope

`TestBC32` in the Classics qualification workflow includes initial-position and
reference perft, notation, terminal and claim rules, material-policy fixtures,
and untimed and timed PostgreSQL matches, including resume and PGN after a fresh
session service is instantiated. Run locally with PostgreSQL 16:

```sh
go test -race -tags account420_integration -run '^TestBC32' ./services/bong-goggles-account-social
go vet -tags account420_integration ./services/bong-goggles-account-social ./cmd/bong-goggles-social
```

The approved digital rule uses material exclusions for automatic dead-position
draws and flag-fall draws. Resignation awards a win to the opponent.
All three decisions are synchronous and replay from the same board and
recorded action. The adapter version and rules hash distinguish this policy
from earlier development builds. Public Chess release is gated separately.
