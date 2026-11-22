//go:build account420_integration

package social

import (
 "bytes"
 "context"
 "encoding/json"
 "errors"
 "strings"
 "testing"
)

func TestBC11RejectAccountImpersonationReplayIllegalScoringAndWager(t *testing.T){
 _,h,host,peer,_:=bc07Sessions(t,"198.51.100.151")
 room:=bc06Room(t,h,host,peer)
 game:=bc06Start(t,h,host,room.ID)
 ctx:=context.Background()
 id:=bc06ActionID(t)
 legal:=ClassicSessionAction{RequestID:id,Action:"move",ExpectedSequence:2,
  Move:json.RawMessage(`{"take":1}`)}
 if _,e:=h.Sessions.Act(ctx,memberB,game.ID,legal);!errors.Is(e,ErrForbidden){
  t.Fatal("other 420ID subject stole active turn",e)}
 for _,bad:=range []string{
  `{"take":9}`,`{"take":1,"score":9000}`,
  `{"take":1,"winnerSeat":0}`,`{"take":1,"take":2}`,
 }{
  attack:=legal;attack.RequestID=bc06ActionID(t);attack.Move=json.RawMessage(bad)
  if _,e:=h.Sessions.Act(ctx,memberA,game.ID,attack);e==nil{
   t.Fatal("illegal/scored rule action accepted",bad)}
 }
 // The API parser must reject all client-supplied privileged fields, not
 // silently accept a coerced subject/seat, result, wallet or stake.
 for _,extra:=range []string{`"actor":"`+memberB+`"`,`"winnerSeat":0`,`"score":1000`,`"wager":420`}{
  requestBody:=`{"requestId":"`+bc06ActionID(t)+`","action":"move","expectedSequence":2,"move":{"take":1},`+extra+`}`
  w:=request(h,"POST","/v1/classic-sessions/"+game.ID+"/action",requestBody,host)
  if w.Code!=400{t.Fatal("privileged client field admitted",extra,w.Code,w.Body.String())}
 }
 before,e:=h.Sessions.Get(ctx,memberA,game.ID)
 if e!=nil||before.Sequence!=1{t.Fatal("unqualified attempts changed state",e,before.Sequence)}
 accepted,e:=h.Sessions.Act(ctx,memberA,game.ID,legal)
 if e!=nil||accepted.Sequence!=2{t.Fatal("legal 420ID move not committed exactly once",e)}
 again,e:=h.Sessions.Act(ctx,memberA,game.ID,legal)
 if e!=nil||again.Sequence!=2{t.Fatal("idempotent request moved twice",e)}
 altered:=legal;altered.Move=json.RawMessage(`{"take":2}`)
 if _,e=h.Sessions.Act(ctx,memberA,game.ID,altered);!errors.Is(e,ErrConflict){
  t.Fatal("same request ID changed score",e)}
 if _,e=h.Sessions.Act(ctx,memberB,game.ID,legal);!errors.Is(e,ErrConflict){
  t.Fatal("another subject reused original command",e)}
 oldSequence:=legal;oldSequence.RequestID=bc06ActionID(t)
 if _,e=h.Sessions.Act(ctx,memberB,game.ID,oldSequence);!errors.Is(e,ErrConflict){
  t.Fatal("old command sequence replayed",e)}
 snapshot,e:=h.Sessions.Get(ctx,memberB,game.ID)
 if e!=nil||snapshot.Sequence!=2||bytes.Contains(snapshot.PrivateView,[]byte("private0"))||
  bytes.Contains(snapshot.PrivateView,[]byte("private1")){t.Fatal("private or forged score view",e)}
 if !bytes.Contains(snapshot.PrivateView,[]byte(`"scores":[1,0]`)){t.Fatal("server score changed",string(snapshot.PrivateView))}
 if reply:=request(h,"GET","/v1/classic-sessions/"+game.ID+"/events?after=0","",peer);
  reply.Code!=200||strings.Contains(reply.Body.String(),"private0")||
  strings.Contains(reply.Body.String(),"private1")||strings.Contains(reply.Body.String(),`"take"`){
  t.Fatal("public log disclosed private action or hidden card",reply.Code,reply.Body.String())
 }
}

func TestBC11CorruptPublicJournalFailsClosedAndRecoversAfterRestore(t *testing.T){
 store,h,host,peer,_:=bc07Sessions(t,"198.51.100.152")
 room:=bc06Room(t,h,host,peer)
 game:=bc06Start(t,h,host,room.ID)
 ok:=bc06Act(t,h,host,game.ID,"move",2,map[string]int{"take":1},bc06ActionID(t))
 if ok.Code!=200{t.Fatal("initial committed move",ok.Code)}
 ctx:=context.Background()
 var before string
 e:=store.DB.QueryRowContext(ctx,`SELECT public_state::text FROM bg_account_social.classic_session_events
 WHERE session_id=$1 AND sequence=2`,game.ID).Scan(&before)
 if e!=nil{t.Fatal(e)}
 // An operator credential can alter a row for this adversarial test; the
 // serving role has no such UPDATE grant. Neither HTTP nor SSE may pass a
 // corrupted public journal to any participating account.
 tampered:=`{"status":"active","turnSeat":1,"deadline":"2026-11-22T01:00:00Z","winnerSeat":null,"finishedReason":"","hiddenCard":"opponent-secret"}`
 if _,e=store.DB.ExecContext(ctx,`UPDATE bg_account_social.classic_session_events
 SET public_state=$3 WHERE session_id=$1 AND sequence=$2`,game.ID,2,tampered);e!=nil{t.Fatal(e)}
 if w:=request(h,"GET","/v1/classic-sessions/"+game.ID+"/events?after=0","",peer);w.Code!=503||
  strings.Contains(w.Body.String(),"opponent-secret"){t.Fatal("tampered public journal disclosed",w.Code,w.Body.String())}
 if w:=request(h,"GET","/v1/classic-sessions/"+game.ID,"",host);w.Code!=503{
  t.Fatal("tampered event authenticated as a valid match",w.Code)}
 if w:=bc06Act(t,h,peer,game.ID,"move",3,map[string]int{"take":1},bc06ActionID(t));w.Code!=503{
  t.Fatal("mutated journal permitted a score write",w.Code)}
 if _,e=store.DB.ExecContext(ctx,`UPDATE bg_account_social.classic_session_events
 SET public_state=$3 WHERE session_id=$1 AND sequence=$2`,game.ID,2,before);e!=nil{t.Fatal(e)}
 if w:=request(h,"GET","/v1/classic-sessions/"+game.ID+"/events?after=1","",peer);w.Code!=200||
  !strings.Contains(w.Body.String(),`"sequence":2`){t.Fatal("restored journal rejected",w.Code,w.Body.String())}
 if e=h.Sessions.VerifyRules(ctx,game.ID);e!=nil{t.Fatal("restored signed rules transcript rejected",e)}
}
