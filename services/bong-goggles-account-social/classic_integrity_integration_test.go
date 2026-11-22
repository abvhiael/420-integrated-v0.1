//go:build account420_integration

package social

import (
 "bytes"
 "context"
 "encoding/json"
 "errors"
 "strings"
 "net/http/httptest"
 "testing"
)

// Build the same authoritative 420ID-bound room and session by service
// methods; existing integration suites separately cover browser cookies and
// CSRF. This adversarial suite must not exhaust an unrelated social POST
// rate bucket by repeatedly sending intentionally malformed commands.
func bc11Session(t *testing.T,h *Handler)ClassicSessionView{
 t.Helper()
 ctx:=context.Background()
 room,e:=h.Rooms.Create(ctx,memberA,"chess","public",2)
 if e!=nil{t.Fatal(e)}
 ready,e:=h.Rooms.Change(ctx,memberB,room.ID,RoomChange{Action:"join",Seat:1,ExpectedRevision:room.Revision})
 if e!=nil||ready.Status!="ready"{t.Fatal("direct room admission",e)}
 session,e:=h.Sessions.Start(ctx,memberA,ready.ID)
 if e!=nil{t.Fatal(e)}
 return session
}
func TestBC11RejectAccountImpersonationReplayIllegalScoringAndWager(t *testing.T){
 _,h,host,peer,_:=bc07Sessions(t,"198.51.100.151")
 game:=bc11Session(t,h)
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
 for i,extra:=range []string{`"actor":"`+memberB+`"`,`"winnerSeat":0`,`"score":1000`,`"wager":420`}{
  requestBody:=`{"requestId":"`+bc06ActionID(t)+`","action":"move","expectedSequence":2,"move":{"take":1},`+extra+`}`
  var code int
  if i==0{
   // Exercise complete 420ID cookie and browser-origin path once.
   code=request(h,"POST","/v1/classic-sessions/"+game.ID+"/action",requestBody,host).Code
  }else{
   req:=httptest.NewRequest("POST","https://bonggoggles.420integrated.org/v1/classic-sessions/"+game.ID+"/action",strings.NewReader(requestBody))
   recorder:=httptest.NewRecorder()
   h.classicSessionsHTTP(ctx,recorder,req,memberA)
   code=recorder.Code
  }
  if code!=400{t.Fatal("privileged client field admitted",extra,code)}
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
 game:=bc11Session(t,h)
 ctx:=context.Background()
 _,e:=h.Sessions.Act(ctx,memberA,game.ID,ClassicSessionAction{
  RequestID:bc06ActionID(t),Action:"move",ExpectedSequence:2,Move:json.RawMessage(`{"take":1}`)})
 if e!=nil{t.Fatal("initial committed move",e)}
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
 if _,e=h.Sessions.Act(ctx,memberB,game.ID,ClassicSessionAction{
  RequestID:bc06ActionID(t),Action:"move",ExpectedSequence:3,Move:json.RawMessage(`{"take":1}`)});
  !errors.Is(e,ErrUnavailable){t.Fatal("mutated journal permitted a score write",e)}
 if _,e=store.DB.ExecContext(ctx,`UPDATE bg_account_social.classic_session_events
 SET public_state=$3 WHERE session_id=$1 AND sequence=$2`,game.ID,2,before);e!=nil{t.Fatal(e)}
 if w:=request(h,"GET","/v1/classic-sessions/"+game.ID+"/events?after=1","",peer);w.Code!=200||
  !strings.Contains(w.Body.String(),`"sequence":2`){t.Fatal("restored journal rejected",w.Code,w.Body.String())}
 if e=h.Sessions.VerifyRules(ctx,game.ID);e!=nil{t.Fatal("restored signed rules transcript rejected",e)}
}
