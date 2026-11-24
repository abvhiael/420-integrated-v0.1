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
