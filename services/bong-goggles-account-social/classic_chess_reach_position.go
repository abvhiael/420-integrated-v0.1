package social

// A reachability node keeps the automatic draw state with the board.
// Fullmove numbers do not affect which continuations are possible.
type chessReachPosition struct {
	Board   chessBoard
	History chessRepetition
}

type chessReachPositionKey struct {
	Position   chessPositionIdentity
	Halfmove   int
	Repetition string
}

func (p chessReachPosition) key() (chessReachPositionKey, error) {
	identity, err := p.Board.identity()
	if err != nil {
		return chessReachPositionKey{}, err
	}
	return chessReachPositionKey{identity, p.Board.Half, p.History.Positions}, nil
}

func (p chessReachPosition) after(move chessMove) (chessReachPosition, int, error) {
	next := p.Board.apply(move)
	identity, err := next.identity()
	if err != nil {
		return chessReachPosition{}, 0, err
	}
	history, count, err := p.History.record(identity, next.Half == 0 || p.Board.Castle != next.Castle)
	if err != nil {
		return chessReachPosition{}, 0, err
	}
	return chessReachPosition{next, history}, count, nil
}

// expand identifies a mating leaf or returns every legal continuation.
// Checkmate takes priority on the move reaching an automatic draw limit.
func (p chessReachPosition) expand(seat int) (chessMateReachability, []chessMove, error) {
	if seat < 0 || seat > 1 {
		return chessMateUnknown, nil, ErrInvalid
	}
	moves := p.Board.legal()
	if len(moves) == 0 {
		if p.Board.Turn == 1-seat && p.Board.check(p.Board.Turn) {
			return chessMatePossible, nil, nil
		}
		return chessMateImpossible, nil, nil
	}
	identity, err := p.Board.identity()
	if err != nil {
		return chessMateUnknown, nil, err
	}
	if p.Board.Half >= 150 || chessOccurrences(p.History, identity) >= 5 ||
		chessMaterialCannotMate(p.Board, seat) {
		return chessMateImpossible, nil, nil
	}
	return chessMateUnknown, moves, nil
}
