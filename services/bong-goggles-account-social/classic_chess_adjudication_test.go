package social

import (
	"encoding/json"
	"testing"
)

func bc322Position(white, black map[int]byte, turn, half int) chessBoard {
	p := chessBoard{Turn: turn, EP: -1, Half: half, Full: 100}
	for i := range p.Squares {
		p.Squares[i] = '.'
	}
	for i, v := range white {
		p.Squares[i] = v
	}
	for i, v := range black {
		p.Squares[i] = v
	}
	return p
}
func TestBC322DeadAndMatePrecedence(t *testing.T) {
	mate := bc322Position(map[int]byte{46: 'K', 54: 'Q'}, map[int]byte{63: 'k'}, 1, 150)
	reason, w := chessAutomatic(mate, 5)
	if reason != "checkmate" || w == nil || *w != 0 {
		t.Fatal(reason, w)
	}
	stale := bc322Position(map[int]byte{46: 'K', 53: 'Q'}, map[int]byte{63: 'k'}, 1, 0)
	reason, w = chessAutomatic(stale, 1)
	if reason != "stalemate" || w != nil {
		t.Fatal(reason, w)
	}
	bare := bc322Position(map[int]byte{0: 'K'}, map[int]byte{63: 'k'}, 0, 0)
	if !chessDeadPosition(bare) {
		t.Fatal("bare kings")
	}
	twoKnights := bc322Position(map[int]byte{46: 'K', 45: 'N', 53: 'N'}, map[int]byte{63: 'k'}, 0, 0)
	if chessMaterialCannotMate(twoKnights, 0) {
		t.Fatal("two knights can mate")
	}
	sameBishops := bc322Position(map[int]byte{0: 'K', 2: 'B'}, map[int]byte{63: 'k', 61: 'b'}, 0, 0)
	if !chessDeadPosition(sameBishops) {
		t.Fatal("same-color bishop complex")
	}
}
func TestBC322MaterialPolicy(t *testing.T) {
	for _, fixture := range []struct {
		fen            string
		dead, flagDraw bool
	}{
		{"7k/8/8/8/8/8/8/K7 w - - 0 1", true, true},
		{"7k/8/8/8/8/8/8/KB6 w - - 0 1", true, true},
		{"7k/8/8/8/8/8/8/KN6 w - - 0 1", true, true},
		{"7k/8/8/8/8/8/8/KQ6 w - - 0 1", false, true},
		{"7k/8/8/8/8/8/8/KQ6 b - - 0 1", false, false},
		{"7k/8/8/8/8/8/8/KNN5 b - - 0 1", false, false},
		{"5b1k/8/8/8/8/8/8/KB6 w - - 0 1", false, false},
	} {
		board, err := parseChessFEN(fixture.fen)
		if err != nil {
			t.Fatal(fixture.fen, err)
		}
		if chessDeadPosition(board) != fixture.dead {
			t.Fatalf("dead position: %s", fixture.fen)
		}
		winner, err := chessAdjudicateLoss(board, board.Turn, "flag-fall")
		if err != nil || (winner == nil) != fixture.flagDraw {
			t.Fatalf("flag fall %s: %v %v", fixture.fen, winner, err)
		}
		winner, err = chessAdjudicateLoss(board, board.Turn, "resigned")
		if err != nil || winner == nil || *winner != 1-board.Turn {
			t.Fatalf("resignation %s: %v %v", fixture.fen, winner, err)
		}
	}
}
func TestBC322RepetitionClaims(t *testing.T) {
	a, state := bc321Adapter(t)
	if _, _, _, _, e := a.Apply(state, 0, chessAction("claim-draw", "")); e == nil {
		t.Fatal("premature claim")
	}
	cycle := []string{"g1f3", "g8f6", "f3g1", "f6g8"}
	var e error
	for i := 0; i < 7; i++ {
		state, _, _, _, e = a.Apply(state, i%2, chessAction("move", cycle[i%4]))
		if e != nil {
			t.Fatal(i, e)
		}
	}
	f, e := a.decode(state)
	if e != nil {
		t.Fatal(e)
	}
	before, e := chessDecode(f)
	if e != nil {
		t.Fatal(e)
	}
	claim, _, done, w, e := a.Apply(state, 1, chessAction("claim-draw", "f6g8"))
	if e != nil || !done || w != nil {
		t.Fatal(done, w, e)
	}
	f, e = a.decode(claim)
	if e != nil {
		t.Fatal(e)
	}
	after, e := chessDecode(f)
	if e != nil || before.Board != after.Board || after.ClaimMove != "f6g8" {
		t.Fatal("intended move committed", e)
	}
	for i := 7; i < 16; i++ {
		var done bool
		state, _, done, w, e = a.Apply(state, i%2, chessAction("move", cycle[i%4]))
		if e != nil || done != (i == 15) || w != nil {
			t.Fatal(i, done, w, e)
		}
	}
	f, e = a.decode(state)
	if e != nil {
		t.Fatal(e)
	}
	after, e = chessDecode(f)
	if e != nil || after.Reason != "fivefold" {
		t.Fatal(after.Reason, e)
	}
}
func TestBC322FlagAuthority(t *testing.T) {
	a, state := bc321Adapter(t)
	c, e := newChessClock(60000, 0)
	if e != nil {
		t.Fatal(e)
	}
	if _, _, e = a.adjudicateChessFlag(state, c, 59999); e == nil {
		t.Fatal("early flag")
	}
	if _, _, _, _, e = a.Apply(state, 0, json.RawMessage(`{"type":"flag-fall"}`)); e == nil {
		t.Fatal("client flag")
	}
	out, next, e := a.adjudicateChessFlag(state, c, 60000)
	if e != nil || next.Remaining[0] != 0 {
		t.Fatal(next, e)
	}
	f, e := a.decode(out)
	if e != nil || !f.Terminal || f.Winner == nil || *f.Winner != 1 {
		t.Fatal(f, e)
	}
	if _, _, e = a.adjudicateChessFlag(out, next, 60001); e == nil {
		t.Fatal("duplicate flag")
	}
}

func TestBC322BareKingFlagDrawAndResignationWin(t *testing.T) {
	adapter, initial := bc321Adapter(t)
	frame, err := adapter.decode(initial)
	if err != nil {
		t.Fatal(err)
	}
	board, err := parseChessFEN("7k/8/8/8/8/8/8/KQ6 w - - 0 2")
	if err != nil {
		t.Fatal(err)
	}
	key, err := board.identity()
	if err != nil {
		t.Fatal(err)
	}
	history, _, err := (chessRepetition{}).record(key, false)
	if err != nil {
		t.Fatal(err)
	}
	frame.Round = board.Full
	frame.Data, err = json.Marshal(chessRuleData{
		Board: board, Repetition: history, LastMove: "h7h8", LastSAN: "Kh8", Offer: -1,
	})
	if err != nil {
		t.Fatal(err)
	}
	state, err := adapter.encode(frame)
	if err != nil {
		t.Fatal(err)
	}
	clock, err := newChessClock(60000, 0)
	if err != nil {
		t.Fatal(err)
	}
	flagged, _, err := adapter.adjudicateChessFlag(state, clock, 60000)
	if err != nil {
		t.Fatal(err)
	}
	ended, err := adapter.decode(flagged)
	if err != nil {
		t.Fatal(err)
	}
	data, err := chessDecode(ended)
	if err != nil || !ended.Terminal || ended.Winner != nil || data.Reason != "flag-fall" {
		t.Fatalf("bare king should draw on timeout: %+v %+v %v", ended, data, err)
	}
	resigned, _, terminal, winner, err := adapter.Apply(state, 0, chessAction("resign", ""))
	if err != nil || !terminal || winner == nil || *winner != 1 {
		t.Fatalf("bare king should win on resignation: %v %v %v", terminal, winner, err)
	}
	trace := []RuleTrace{{Sequence: 2, Seat: 0, Action: chessAction("resign", ""), BeforeHash: RuleHash(state), AfterHash: RuleHash(resigned)}}
	if _, err := adapter.replayFromVerified(state, 1, trace); err != nil {
		t.Fatal(err)
	}
}
