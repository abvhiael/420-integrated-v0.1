package social

import (
 "bytes"
 "context"
 "database/sql"
 "encoding/json"
 "time"
)

// Every public event, including the resumable SSE stream, must match this
// closed server-owned metadata projection. Never pass through arbitrary JSONB
// from the database: it may contain concealed cards, random seeds or scores.
var classicPublicKeys=map[string]bool{
 "status":true,"turnSeat":true,"deadline":true,
 "winnerSeat":true,"finishedReason":true,
}

func validClassicPublicEvent(event ClassicSessionEvent,seats int)bool{
 return validClassicPublicEventForSession(event,seats,false)
}
func validClassicPublicEventForSession(event ClassicSessionEvent,seats int,allowUntimed bool)bool{
 if event.Sequence<1||seats<2||seats>4||!validViewerState(event.PublicState)||
  !noDuplicateJSON(event.PublicState){return false}
 var state map[string]json.RawMessage
 if json.Unmarshal(event.PublicState,&state)!=nil||len(state)!=len(classicPublicKeys){return false}
 for key:=range state{if !classicPublicKeys[key]{return false}}
 var decoded struct{
  Status string `json:"status"`
  TurnSeat *int `json:"turnSeat"`
  Deadline *time.Time `json:"deadline"`
  WinnerSeat *int `json:"winnerSeat"`
  FinishedReason string `json:"finishedReason"`
 }
 d:=json.NewDecoder(bytes.NewReader(event.PublicState));d.DisallowUnknownFields()
 if d.Decode(&decoded)!=nil{return false}
 if decoded.WinnerSeat!=nil&&(*decoded.WinnerSeat<0||*decoded.WinnerSeat>=seats){return false}
 if event.ActorSeat!=nil&&(*event.ActorSeat<0||*event.ActorSeat>=seats){return false}
 if decoded.Status=="active"{
  if (event.Kind!="started"&&event.Kind!="move")||decoded.TurnSeat==nil||
   *decoded.TurnSeat<0||*decoded.TurnSeat>=seats||(decoded.Deadline==nil&&!allowUntimed)||
   decoded.WinnerSeat!=nil||decoded.FinishedReason!=""{return false}
  return (event.Kind=="started")==(event.Sequence==1)&&
   (event.ActorSeat==nil)==(event.Kind=="started")
 }
 if event.Sequence==1||decoded.TurnSeat!=nil||decoded.Deadline!=nil{return false}
 switch decoded.Status{
 case "finished":return event.Kind=="finished"&&decoded.FinishedReason=="completed"&&event.ActorSeat!=nil
 case "resigned":return event.Kind=="resigned"&&decoded.FinishedReason=="resigned"&&event.ActorSeat!=nil
 case "timed_out":return event.Kind=="timed_out"&&decoded.FinishedReason=="timed_out"&&event.ActorSeat!=nil
 case "cancelled":return event.Kind=="cancelled"&&decoded.FinishedReason=="cancelled"&&decoded.WinnerSeat==nil&&event.ActorSeat!=nil
 }
 return false
}

// The immutable journal must be a single contiguous chain and its current
// event must agree with the committed session status/turn. The serving role
// has SELECT/INSERT only; no forged browser scores or event updates.
func (s *ClassicSessions) verifyClassicJournalTx(ctx context.Context,tx *sql.Tx,rec classicSessionRecord)error{
 if rec.Sequence<1||rec.Sequence>1000000{return ErrUnavailable}
 var count,first,last int64
 e:=tx.QueryRowContext(ctx,`SELECT count(*),COALESCE(min(sequence),0),COALESCE(max(sequence),0)
 FROM bg_account_social.classic_session_events WHERE session_id=$1`,rec.ID).
 Scan(&count,&first,&last)
 if e!=nil{return e}
 if count!=rec.Sequence||first!=1||last!=rec.Sequence{return ErrUnavailable}
 var kind string
 var same bool
 e=tx.QueryRowContext(ctx,`SELECT kind,(public_state ? 'deadline') AND (public_state - 'deadline')=($3::jsonb - 'deadline')
 AND (public_state->>'deadline')::timestamptz IS NOT DISTINCT FROM
     ($3::jsonb->>'deadline')::timestamptz
 FROM bg_account_social.classic_session_events
 WHERE session_id=$1 AND sequence=$2`,rec.ID,rec.Sequence,string(classicPublicState(rec))).Scan(&kind,&same)
 if e!=nil||!same{return ErrUnavailable}
 switch rec.Status{
 case "active":if kind!="started"&&kind!="move"{return ErrUnavailable}
 case "finished":if kind!="finished"{return ErrUnavailable}
 case "resigned":if kind!="resigned"{return ErrUnavailable}
 case "timed_out":if kind!="timed_out"{return ErrUnavailable}
 case "cancelled":if kind!="cancelled"{return ErrUnavailable}
 default:return ErrUnavailable
 }
 return nil
}
