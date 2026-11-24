package social

import "encoding/json"

// These material exclusions are sound, including the one-sided cases
// where the opponent has only pieces that cannot assist a mating net.
func chessMaterialCannotMate(p chessBoard, seat int) bool {
	own, other := 0, 0
	ownKnights, otherKnights, otherHeavy := 0, 0, 0
	ownBishops, otherBishops := byte(0), byte(0)
	for i, v := range p.Squares {
		k := chessKind(v)
		if k == '.' || k == 'K' {
			continue
		}
		bit := byte(1 << uint((i/8+i%8)%2))
		if chessColor(v) == seat {
			own++
			switch k {
			case 'P', 'R', 'Q':
				return false
			case 'N':
				ownKnights++
			case 'B':
				ownBishops |= bit
			}
		} else {
			other++
			switch k {
			case 'N':
				otherKnights++
			case 'B':
				otherBishops |= bit
			default:
				otherHeavy++
			}
		}
	}
	if own == 0 {
		return true
	}
	if own == 1 && other == 0 {
		return true
	}
	return ownKnights == 0 && ownBishops != 3 && otherKnights == 0 && otherHeavy == 0 && (ownBishops|otherBishops) != 3
}
func chessDeadPosition(p chessBoard) bool {
	return chessMaterialCannotMate(p, 0) && chessMaterialCannotMate(p, 1)
}

func chessAdjudicateLoss(p chessBoard, loser int, reason string) (*int, error) {
	if loser < 0 || loser > 1 || (reason != "resigned" && reason != "flag-fall") {
		return nil, ErrInvalid
	}
	winner := 1 - loser
	if reason == "flag-fall" && chessMaterialCannotMate(p, winner) {
		return nil, nil
	}
	return &winner, nil
}

// Server-only reducer. No client action is registered for flag fall. The
// caller supplies a trusted elapsed-time measurement and current clock;
// the session journals those inputs atomically with the new state.
func (a *RulesAdapter) adjudicateChessFlag(raw json.RawMessage, clock chessClock, elapsed int64) (json.RawMessage, chessClock, error) {
	if a == nil || a.definition.GameID != "chess" {
		return nil, clock, ErrInvalid
	}
	f, e := a.decode(raw)
	if e != nil {
		return nil, clock, e
	}
	if f.Terminal {
		return nil, clock, ErrForbidden
	}
	next, flag, e := clock.advance(f.Turn, elapsed, false, false)
	if e != nil {
		return nil, clock, e
	}
	if !clock.Timed || !flag {
		return nil, clock, ErrInvalid
	}
	d, e := chessDecode(f)
	if e != nil {
		return nil, clock, e
	}
	winner, e := chessAdjudicateLoss(d.Board, f.Turn, "flag-fall")
	if e != nil {
		return nil, clock, e
	}
	loser := f.Turn
	if e = chessFinish(&f, &d, "flag-fall", winner); e != nil {
		return nil, clock, e
	}
	d.Loser = &loser
	f.Data, e = json.Marshal(d)
	if e != nil {
		return nil, clock, e
	}
	out, e := a.encode(f)
	if e != nil {
		return nil, clock, e
	}
	return out, next, nil
}
