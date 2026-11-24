package social

import (
	"encoding/json"
	"testing"
)

func TestBC32ReachabilityCheckpoint(t *testing.T) {
	board, err := parseChessFEN("7k/8/5KQ1/8/8/8/8/8 w - - 0 1")
	if err != nil {
		t.Fatal(err)
	}
	job, err := newChessReachabilityJob(board, 0)
	if err != nil {
		t.Fatal(err)
	}
	if result, err := job.advance(1); err != nil || result != chessMateUnknown {
		t.Fatalf("one expansion: %v %v", result, err)
	}
	checkpoint, err := job.checkpoint()
	if err != nil {
		t.Fatal(err)
	}
	restored, err := restoreChessReachabilityJob(checkpoint)
	if err != nil {
		t.Fatal(err)
	}
	if result, err := restored.advance(64); err != nil || result != chessMatePossible {
		t.Fatalf("resumed result: %v %v", result, err)
	}
	for _, action := range restored.Witness {
		found := false
		for _, move := range board.legal() {
			if move.UCI() == action {
				board = board.apply(move)
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("illegal witness move: %s", action)
		}
	}
	if board.Turn != 1 || !board.check(1) || len(board.legal()) != 0 {
		t.Fatal("witness does not end in black checkmate")
	}
	job.Result = chessMateImpossible
	forged, err := json.Marshal(job)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := restoreChessReachabilityJob(forged); err == nil {
		t.Fatal("accepted forged impossibility")
	}
}

func TestBC32OpeningPrefixResignation(t *testing.T) {
	for _, test := range []struct {
		move  string
		loser int
	}{
		{"e2e4", 0},
		{"d2d4", 1},
	} {
		adapter, state := bc321Adapter(t)
		state, _, _, _, err := adapter.Apply(state, 0, chessAction("move", test.move))
		if err != nil {
			t.Fatal(err)
		}
		_, _, finished, winner, err := adapter.Apply(state, test.loser, chessAction("resign", ""))
		if err != nil || !finished || winner == nil || *winner != 1-test.loser {
			t.Fatalf("resignation after %s: %v %v %v", test.move, finished, winner, err)
		}
	}
}

func TestBC32ReachabilitySlicingMatchesSingleBatch(t *testing.T) {
	board, err := parseChessFEN("7k/8/5KQ1/8/8/8/8/8 w - - 0 1")
	if err != nil {
		t.Fatal(err)
	}
	sliced, err := newChessReachabilityJob(board, 0)
	if err != nil {
		t.Fatal(err)
	}
	whole, err := newChessReachabilityJob(board, 0)
	if err != nil {
		t.Fatal(err)
	}
	if result, err := whole.advance(128); err != nil || result != chessMatePossible {
		t.Fatalf("whole search: %v %v", result, err)
	}
	for sliced.Cursor < whole.Cursor {
		if _, err := sliced.advance(1); err != nil {
			t.Fatal(err)
		}
	}
	want, err := whole.checkpoint()
	if err != nil {
		t.Fatal(err)
	}
	got, err := sliced.checkpoint()
	if err != nil || string(got) != string(want) {
		t.Fatal("single-step traversal changed the checkpoint", err)
	}
}

func TestBC32SicilianResignation(t *testing.T) {
	adapter, state := bc321Adapter(t)
	for i, uci := range []string{"e2e4", "c7c5", "g1f3"} {
		next, _, _, _, err := adapter.Apply(state, i%2, chessAction("move", uci))
		if err != nil {
			t.Fatal(uci, err)
		}
		state = next
	}
	_, _, done, winner, err := adapter.Apply(state, 0, chessAction("resign", ""))
	if err != nil || !done || winner == nil || *winner != 1 {
		t.Fatalf("White resignation: %v %v %v", done, winner, err)
	}
}
