# BC-3.2 Chess backend

The Chess adapter implements orthodox play under `bc-chess-standard@1.0.0`.
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

## Qualification scope

`TestBC32` in the Classics qualification workflow includes initial-position and
reference perft, notation, terminal and claim rules, checkpoint verification,
and an untimed PostgreSQL match that resumes and exports PGN after a fresh
session service is instantiated. Run locally with PostgreSQL 16:

```sh
go test -race -tags account420_integration -run '^TestBC32' ./services/bong-goggles-account-social
go vet -tags account420_integration ./services/bong-goggles-account-social ./cmd/bong-goggles-social
```

BC-3.2 still requires authoritative timed-session and timed-replay integration.
The conditional exact search and cooperative witnesses prove some positions.
The checkpoint verifier checks a standalone traversal. An arbitrary position
can still exhaust the synchronous search, and there is no durable session
handoff to the checkpoint solver. These constraints leave automatic dead
position and loss-on-resignation or flag-fall adjudication unqualified in the
general case. The full BC-3.2 release gate stays open.
