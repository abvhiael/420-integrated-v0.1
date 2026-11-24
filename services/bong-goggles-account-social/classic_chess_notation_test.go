package social

import (
	"strings"
	"testing"
)

func TestBC32FEN(t *testing.T) {
	if got := chessInitialBoard().fen(); got != chessInitialFEN {
		t.Fatalf("initial FEN = %s", got)
	}
	for _, fen := range []string{
		chessInitialFEN,
		"7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",
		"7k/6Q1/6K1/8/8/8/8/8 b - - 0 1",
		"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
	} {
		board, err := parseChessFEN(fen)
		if err != nil || board.fen() != fen {
			t.Fatalf("roundtrip %q: %v", fen, err)
		}
	}
	for _, fen := range []string{
		"8/8/8/8/8/8/8/8 w - - 0 1",
		"7k/8/8/8/8/8/8/K7 w K - 0 1",
		"7k/8/8/8/8/8/8/K7 b - e3 0 1",
		"7k/8/8/8/8/8/8/K7 w - - 0 0",
		"7k/8/8/8/8/8/8/K7 w - - -1 1",
	} {
		if _, err := parseChessFEN(fen); err == nil {
			t.Fatalf("accepted %q", fen)
		}
	}
}

func TestBC32PGN(t *testing.T) {
	adapter, state := bc321Adapter(t)
	meta := ChessPGNMetadata{"Club \"Night\"", "BongGoggles", "????.??.??", "1", "White", "Black"}
	if pgn, err := adapter.ExportChessPGN([32]byte{}, nil, meta); err != nil ||
		!strings.HasSuffix(pgn, "[Result \"*\"]\n\n*\n") {
		t.Fatalf("unfinished game: %q / %v", pgn, err)
	}
	var trace []RuleTrace
	for i, uci := range []string{"f2f3", "e7e5", "g2g4", "d8h4"} {
		action := chessAction("move", uci)
		next, _, _, _, err := adapter.Apply(state, i%2, action)
		if err != nil {
			t.Fatal(err)
		}
		trace = append(trace, RuleTrace{int64(i + 2), i % 2, action, RuleHash(state), RuleHash(next)})
		state = next
	}
	got, err := adapter.ExportChessPGN([32]byte{}, trace, meta)
	want := `[Event "Club \"Night\""]
[Site "BongGoggles"]
[Date "????.??.??"]
[Round "1"]
[White "White"]
[Black "Black"]
[Result "0-1"]

1. f3 e5 2. g4 Qh4# 0-1
`
	if err != nil || got != want {
		t.Fatalf("PGN = %q, err = %v", got, err)
	}
	meta.Site = "invalid\ntag"
	if _, err := adapter.ExportChessPGN([32]byte{}, trace, meta); err == nil {
		t.Fatal("accepted a multiline tag")
	}
	meta.Site = "BongGoggles"
	trace[2].BeforeHash = "tampered"
	if _, err := adapter.ExportChessPGN([32]byte{}, trace, meta); err == nil {
		t.Fatal("accepted a tampered trace")
	}
}

func TestBC32ReferencePerft(t *testing.T) {
	// Standard perft positions 2 and 3 exercise castling, pins, and en passant.
	cases := []struct {
		fen   string
		nodes [3]int
	}{
		{"r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", [3]int{48, 2039, 97862}},
		{"8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [3]int{14, 191, 2812}},
		{"rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", [3]int{44, 1486, 62379}},
	}
	var perft func(chessBoard, int) int
	perft = func(board chessBoard, depth int) int {
		if depth == 0 {
			return 1
		}
		nodes := 0
		for _, move := range board.legal() {
			nodes += perft(board.apply(move), depth-1)
		}
		return nodes
	}
	for _, fixture := range cases {
		board, err := parseChessFEN(fixture.fen)
		if err != nil {
			t.Fatalf("%s: %v", fixture.fen, err)
		}
		for i, want := range fixture.nodes {
			if got := perft(board, i+1); got != want {
				t.Fatalf("%s at depth %d: got %d, want %d", fixture.fen, i+1, got, want)
			}
		}
	}
}
