package social

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"
)

type chessTimedState struct {
	Profile string     `json:"profile"`
	Clock   chessClock `json:"clock"`
	At      int64      `json:"at"`
}

var chessClockProfiles = map[string][2]int64{
	"1+0": {1, 0}, "2+1": {2, 1}, "3+0": {3, 0}, "3+2": {3, 2},
	"5+0": {5, 0}, "5+3": {5, 3}, "10+0": {10, 0}, "15+10": {15, 10},
	"30+0": {30, 0}, "30+30": {30, 30}, "60+0": {60, 0},
}

func chessClockForProfile(profile string) (chessClock, error) {
	if profile == "timed" {
		profile = "10+0"
	}
	values, ok := chessClockProfiles[profile]
	if !ok {
		return chessClock{}, ErrInvalid
	}
	return newChessClock(values[0]*60000, values[1]*1000)
}

func (c *chessTimedState) deadline(turn int) *time.Time {
	if c == nil || turn < 0 || turn > 1 {
		return nil
	}
	value := time.UnixMilli(c.At + c.Clock.Remaining[turn]).UTC()
	return &value
}

func chessFrameWithTime(a *RulesAdapter, state json.RawMessage, timing *chessTimedState) (json.RawMessage, error) {
	frame, err := a.decode(state)
	if err != nil {
		return nil, err
	}
	data, err := chessDecode(frame)
	if err != nil {
		return nil, err
	}
	data.Timing = timing
	frame.Data, err = json.Marshal(data)
	if err != nil {
		return nil, err
	}
	return a.encode(frame)
}

// This envelope is written only to the private replay journal. The public
// command decoder continues to accept only a Chess move or lifecycle action.
type chessTimedEvent struct {
	At   int64           `json:"at"`
	Move json.RawMessage `json:"move,omitempty"`
}

func (a *RulesAdapter) applyChessTime(state json.RawMessage, seat int, event chessTimedEvent) (json.RawMessage, int, bool, *int, error) {
	frame, err := a.decode(state)
	if err != nil || frame.Terminal {
		return nil, 0, false, nil, ErrInvalid
	}
	data, err := chessDecode(frame)
	if err != nil || data.Timing == nil || event.At < data.Timing.At || event.At > 253402300799999 {
		return nil, 0, false, nil, ErrInvalid
	}
	timing := *data.Timing
	elapsed := event.At - timing.At
	if len(event.Move) == 0 {
		if seat != frame.Turn {
			return nil, 0, false, nil, ErrInvalid
		}
		next, clock, err := a.adjudicateChessFlag(state, timing.Clock, elapsed)
		if err != nil {
			return nil, 0, false, nil, err
		}
		timing.Clock, timing.At = clock, event.At
		next, err = chessFrameWithTime(a, next, &timing)
		if err != nil {
			return nil, 0, false, nil, err
		}
		result, err := a.decode(next)
		return next, -1, true, result.Winner, err
	}
	if elapsed >= timing.Clock.Remaining[frame.Turn] {
		return nil, 0, false, nil, ErrConflict
	}
	next, turn, terminal, winner, err := a.Apply(state, seat, event.Move)
	if err != nil {
		return nil, 0, false, nil, err
	}
	var command chessCommand
	if !strictRuleJSON(event.Move, &command) {
		return nil, 0, false, nil, ErrInvalid
	}
	move := command.Type == "move" || command.Type == "move-offer"
	timing.Clock, _, err = timing.Clock.advance(frame.Turn, elapsed, move, terminal)
	if err != nil {
		return nil, 0, false, nil, err
	}
	timing.At = event.At
	next, err = chessFrameWithTime(a, next, &timing)
	return next, turn, terminal, winner, err
}

func (a *RulesAdapter) chessReplayTiming(state, action json.RawMessage) (*chessTimedEvent, error) {
	if !isClassicChess(a) {
		return nil, nil
	}
	frame, err := a.decode(state)
	if err != nil {
		return nil, err
	}
	data, err := chessDecode(frame)
	if err != nil || data.Timing == nil {
		return nil, err
	}
	var event chessTimedEvent
	if !strictRuleJSON(action, &event) {
		return nil, ErrInvalid
	}
	return &event, nil
}

func (s *ClassicSessions) expireChessLocked(ctx context.Context, tx *sql.Tx, rec *classicSessionRecord, a *RulesAdapter, now time.Time) error {
	if rec.TurnSeat == nil {
		return ErrUnavailable
	}
	seat := *rec.TurnSeat
	event := chessTimedEvent{At: now.UnixMilli()}
	next, _, _, winner, err := a.applyChessTime(rec.State, seat, event)
	if err != nil {
		return err
	}
	action, err := json.Marshal(event)
	if err != nil {
		return err
	}
	before := rec.State
	rec.Sequence++
	rec.State, rec.Status, rec.FinishedReason = next, "finished", "completed"
	rec.TurnSeat, rec.Deadline, rec.WinnerSeat = nil, nil, winner
	_, err = tx.ExecContext(ctx, `UPDATE bg_account_social.classic_sessions
		SET engine_state=$2, sequence=$3, status='finished', turn_seat=NULL, turn_deadline=NULL,
		    winner_seat=$4, finished_reason='completed', updated_at=clock_timestamp() WHERE id=$1`,
		rec.ID, string(next), rec.Sequence, winner)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `UPDATE bg_account_social.classic_rooms
		SET status='completed', revision=revision+1, updated_at=clock_timestamp() WHERE id=$1`, rec.RoomID)
	if err != nil {
		return err
	}
	if err := s.publish(ctx, tx, *rec, "finished", seat); err != nil {
		return err
	}
	return s.saveRuleMove(ctx, tx, rec.ID, rec.Sequence, seat, action, before, next, a)
}
