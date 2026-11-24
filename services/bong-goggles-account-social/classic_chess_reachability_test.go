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

func TestBC32ReachabilityCapacityPreservesFrontier(t *testing.T) {
	board, err := parseChessFEN("7k/8/5KQ1/8/8/8/8/8 w - - 0 1")
	if err != nil {
		t.Fatal(err)
	}
	job, err := newChessReachabilityJob(board, 0)
	if err != nil {
		t.Fatal(err)
	}
	result, err := job.advanceBounded(1, 1)
	if err != nil || result != chessMateUnknown || !job.storageLimited || job.Cursor != 0 || len(job.Nodes) != 1 {
		t.Fatalf("cutoff damaged pending frontier: %v %v %v %d %d", result, err, job.storageLimited, job.Cursor, len(job.Nodes))
	}
	checkpoint, err := job.checkpoint()
	if err != nil {
		t.Fatal(err)
	}
	restored, err := restoreChessReachabilityJob(checkpoint)
	if err != nil {
		t.Fatal(err)
	}
	result, err = restored.advanceBounded(128, 4096)
	if err != nil || result != chessMatePossible {
		t.Fatalf("resumed search: %v %v", result, err)
	}
}

func TestBC32ReachPositionAutomaticEndings(t *testing.T) {
	board, err := parseChessFEN("7k/8/5KQ1/8/8/8/8/8 w - - 149 75")
	if err != nil {
		t.Fatal(err)
	}
	position := chessReachPosition{Board: board}
	identity, err := board.identity()
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 4; i++ {
		position.History, _, err = position.History.record(identity, false)
		if err != nil {
			t.Fatal(err)
		}
	}
	result, moves, err := position.expand(0)
	if err != nil || result != chessMateUnknown || len(moves) == 0 {
		t.Fatalf("before thresholds: %v %v", result, err)
	}
	foundMate, foundDraw := false, false
	for _, move := range moves {
		child, _, err := position.after(move)
		if err != nil {
			t.Fatal(err)
		}
		if child.Board.Half != 150 {
			t.Fatalf("unexpected halfmove count %d", child.Board.Half)
		}
		result, moves, err := child.expand(0)
		if err != nil || len(moves) != 0 {
			t.Fatalf("child still has continuations: %v %v", result, err)
		}
		foundMate = foundMate || result == chessMatePossible
		foundDraw = foundDraw || result == chessMateImpossible
	}
	if !foundMate || !foundDraw {
		t.Fatal("fixture should permit both checkmate and an automatic draw")
	}
	job, err := newChessHistoryReachabilityJob(position, 0)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := job.advance(1); err != nil {
		t.Fatal(err)
	}
	checkpoint, err := job.checkpoint()
	if err != nil {
		t.Fatal(err)
	}
	restored, err := restoreChessReachabilityJob(checkpoint)
	if err != nil {
		t.Fatal(err)
	}
	if result, err := restored.advance(128); err != nil || result != chessMatePossible {
		t.Fatalf("restore near draw limit: %v %v", result, err)
	}

	before, err := position.key()
	if err != nil {
		t.Fatal(err)
	}
	position.History, _, err = position.History.record(identity, false)
	if err != nil {
		t.Fatal(err)
	}
	after, err := position.key()
	if err != nil || before == after {
		t.Fatal("fifth repetition collided with the fourth", err)
	}
	result, moves, err = position.expand(0)
	if err != nil || result != chessMateImpossible || len(moves) != 0 {
		t.Fatalf("fifth repetition: %v %v", result, err)
	}
}
