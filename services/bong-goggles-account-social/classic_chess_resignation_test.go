package social

import "testing"

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
