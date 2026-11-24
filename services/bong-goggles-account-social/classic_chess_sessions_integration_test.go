//go:build account420_integration

package social

import (
	"context"
	"strings"
	"testing"
)

func TestBC32UntimedChessSession(t *testing.T) {
	store, handler, white, black := bc06Fixture(t, "198.51.100.195")
	adapter, err := NewChessRulesAdapter()
	if err != nil {
		t.Fatal(err)
	}
	resolve := func(game string) ClassicRule {
		if game == "chess" {
			return adapter
		}
		return nil
	}
	handler.Sessions.Rules = resolve
	room := bc06Room(t, handler, white, black)
	match := bc06Start(t, handler, white, room.ID)
	if match.Deadline != nil || match.TurnSeat == nil || *match.TurnSeat != 0 {
		t.Fatalf("untimed opening snapshot: %+v", match)
	}
	w := bc06Act(t, handler, white, match.ID, "move", 2,
		map[string]string{"type": "move", "uci": "e2e4"}, bc06ActionID(t))
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"deadline":null`) {
		t.Fatalf("opening move: %d %s", w.Code, w.Body)
	}
	restarted, err := NewClassicSessions(store, handler.Rooms, resolve)
	if err != nil {
		t.Fatal(err)
	}
	handler.Sessions = restarted
	ctx := context.Background()
	if err := restarted.VerifyRules(ctx, match.ID); err != nil {
		t.Fatal(err)
	}
	events, sequence, err := restarted.Events(ctx, memberA, match.ID, 0)
	if err != nil || sequence != 2 || len(events) != 2 {
		t.Fatalf("restored events: %d %d %v", len(events), sequence, err)
	}
	id := bc06ActionID(t)
	for i := 0; i < 2; i++ {
		w = bc06Act(t, handler, white, match.ID, "resign", 3, nil, id)
		if w.Code != 200 || !strings.Contains(w.Body.String(), `"reason":"resigned"`) ||
			!strings.Contains(w.Body.String(), `"winnerSeat":1`) {
			t.Fatalf("resignation: %d %s", w.Code, w.Body)
		}
	}
	if err := restarted.VerifyRules(ctx, match.ID); err != nil {
		t.Fatal(err)
	}
	meta := ChessPGNMetadata{"Match", "BongGoggles", "????.??.??", "1", "White", "Black"}
	pgn, err := restarted.ExportChessPGN(ctx, memberB, match.ID, meta)
	if err != nil || !strings.HasSuffix(pgn, "1. e4 0-1\n") {
		t.Fatalf("persisted PGN: %q %v", pgn, err)
	}
	if _, err := restarted.ExportChessPGN(ctx, bc06ActionID(t), match.ID, meta); err != ErrNotFound {
		t.Fatalf("nonparticipant export: %v", err)
	}
}

func TestBC32TimedChessSession(t *testing.T) {
	store, handler, white, black := bc06Fixture(t, "198.51.100.196")
	adapter, err := NewChessRulesAdapter()
	if err != nil {
		t.Fatal(err)
	}
	handler.Sessions.Rules = func(game string) ClassicRule {
		if game == "chess" {
			return adapter
		}
		return nil
	}
	room := bc06Room(t, handler, white, black)
	ctx := context.Background()
	match, err := handler.Sessions.startWithClock(ctx, memberA, room.ID, "3+2")
	if err != nil || match.Deadline == nil {
		t.Fatalf("start: %+v %v", match, err)
	}
	move := map[string]string{"type": "move", "uci": "e2e4"}
	id := bc06ActionID(t)
	for i := 0; i < 2; i++ {
		w := bc06Act(t, handler, white, match.ID, "move", 2, move, id)
		if w.Code != 200 {
			t.Fatalf("move or retry: %d %s", w.Code, w.Body)
		}
	}
	if err := handler.Sessions.VerifyRules(ctx, match.ID); err != nil {
		t.Fatal(err)
	}
	tx, err := store.DB.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	rec, err := scanClassicSession(tx.QueryRowContext(ctx, "SELECT "+classicSessionFields+
		" FROM bg_account_social.classic_sessions WHERE id=$1 FOR UPDATE", match.ID))
	if err != nil || rec.Sequence != 2 || rec.Deadline == nil {
		t.Fatalf("snapshot: %+v %v", rec, err)
	}
	frame, err := adapter.decode(rec.State)
	if err != nil {
		t.Fatal(err)
	}
	data, err := chessDecode(frame)
	if err != nil || data.Timing.Clock.Remaining[0] <= 180000 || data.Timing.Clock.Remaining[1] != 180000 {
		t.Fatalf("balances: %+v %v", data.Timing, err)
	}
	if err := handler.Sessions.expireLocked(ctx, tx, &rec, *rec.Deadline); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	if err := handler.Sessions.VerifyRules(ctx, match.ID); err != nil {
		t.Fatal(err)
	}
	meta := ChessPGNMetadata{"Match", "BongGoggles", "????.??.??", "1", "White", "Black"}
	pgn, err := handler.Sessions.ExportChessPGN(ctx, memberB, match.ID, meta)
	if err != nil || !strings.HasSuffix(pgn, "1. e4 1-0\n") {
		t.Fatalf("timed PGN: %q %v", pgn, err)
	}
}
