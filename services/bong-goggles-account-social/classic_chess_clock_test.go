package social

import (
	"encoding/json"
	"testing"
)

func TestBC32TimedBoundaryAndReplay(t *testing.T) {
	adapter, initial := bc321Adapter(t)
	clock, err := chessClockForProfile("3+2")
	if err != nil {
		t.Fatal(err)
	}
	const start int64 = 1800000000000
	genesis, err := chessFrameWithTime(adapter, initial, &chessTimedState{"3+2", clock, start})
	if err != nil {
		t.Fatal(err)
	}
	deadline := start + 180000
	move := chessAction("move", "e2e4")
	for _, at := range []int64{deadline, deadline + 1} {
		if _, _, _, _, err := adapter.applyChessTime(genesis, 0, chessTimedEvent{at, move}); err != ErrConflict {
			t.Fatalf("late move at %d: %v", at, err)
		}
	}
	event := chessTimedEvent{deadline - 1, move}
	next, turn, done, _, err := adapter.applyChessTime(genesis, 0, event)
	if err != nil || done || turn != 1 {
		t.Fatalf("timely move: %d %v %v", turn, done, err)
	}
	frame, err := adapter.decode(next)
	if err != nil {
		t.Fatal(err)
	}
	data, err := chessDecode(frame)
	if err != nil || data.Timing.Clock.Remaining != [2]int64{2001, 180000} {
		t.Fatalf("increment: %+v %v", data.Timing, err)
	}
	action, err := json.Marshal(event)
	if err != nil {
		t.Fatal(err)
	}
	trace := []RuleTrace{{2, 0, action, RuleHash(genesis), RuleHash(next)}}
	if _, err := adapter.replayFromVerified(genesis, 1, trace); err != nil {
		t.Fatal(err)
	}
	event.At--
	trace[0].Action, err = json.Marshal(event)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.replayFromVerified(genesis, 1, trace); err == nil {
		t.Fatal("replayed tampered timing")
	}
}

func TestBC32QueensGambitResignation(t *testing.T) {
	adapter, state := bc321Adapter(t)
	var err error
	for i, uci := range []string{
		"d2d4", "d7d5", "c2c4", "e7e6", "b1c3", "g8f6",
		"c1g5", "f8e7", "e2e3", "e8g8", "g1f3",
	} {
		state, _, _, _, err = adapter.Apply(state, i%2, chessAction("move", uci))
		if err != nil {
			t.Fatal(uci, err)
		}
	}
	_, _, done, winner, err := adapter.Apply(state, 1, chessAction("resign", ""))
	if err != nil || !done || winner == nil || *winner != 0 {
		t.Fatalf("Black resignation: %v %v %v", done, winner, err)
	}
}
