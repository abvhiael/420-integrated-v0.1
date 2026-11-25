package social

import (
 "context"
 "database/sql"
 "encoding/json"
 "strings"
 "time"
)

func wordSaladDeadline(variant string,now time.Time)*time.Time{
 if strings.HasSuffix(variant,":untimed"){return nil}
 duration:=120*time.Second
 if strings.HasSuffix(variant,":async"){duration=24*time.Hour}
 deadline:=now.Add(duration)
 return &deadline
}

// Caller holds the room and session locks, has verified the journal and
// obtained the authoritative database timestamp. Timeout is a pass, not
// termination of the match. Publish and private replay commit atomically.
func(s *ClassicSessions)expireWordSaladLocked(ctx context.Context,tx *sql.Tx,r *classicSessionRecord,a *RulesAdapter,now time.Time)error{
 if r.TurnSeat==nil{return ErrUnavailable}
 actor:=*r.TurnSeat
 before:=append(json.RawMessage(nil),r.State...)
 action:=json.RawMessage(`{"type":"timeout"}`)
 state,turn,finished,winner,e:=a.Apply(before,actor,action);if e!=nil{return e}
 frame,e:=a.decode(state);if e!=nil{return e}
 r.Sequence++;r.State=state
 kind:="move";var reason any
 if finished{r.Status="finished";r.FinishedReason="completed";reason="completed";r.WinnerSeat=winner;r.TurnSeat=nil;r.Deadline=nil;kind="finished"}else{r.TurnSeat=&turn;r.Deadline=wordSaladDeadline(frame.Variant,now)}
 _,e=tx.ExecContext(ctx,"UPDATE bg_account_social.classic_sessions SET engine_state=$2,sequence=$3,status=$4,turn_seat=$5,turn_deadline=$6,winner_seat=$7,finished_reason=$8,updated_at=clock_timestamp() WHERE id=$1",r.ID,string(r.State),r.Sequence,r.Status,r.TurnSeat,r.Deadline,r.WinnerSeat,reason);if e!=nil{return e}
 if finished{_,e=tx.ExecContext(ctx,"UPDATE bg_account_social.classic_rooms SET status='completed',revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",r.RoomID);if e!=nil{return e}}
 if e=s.publish(ctx,tx,*r,kind,actor);e!=nil{return e}
 return s.saveRuleMove(ctx,tx,r.ID,r.Sequence,actor,action,before,state,a)
}
