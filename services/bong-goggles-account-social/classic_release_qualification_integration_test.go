//go:build account420_integration

package social

import (
 "bytes"
 "context"
 "encoding/json"
 "errors"
 "sync"
 "testing"
 "time"
)

// Test-only deterministic rules; this proves PostgreSQL/420ID transport
// behaves across TWO REAL verified cookie subjects, not that Chess is ready.
func TestBC12TwoIndependent420IDAccountsRestartConcurrentMoveAndTerminalReplay(t *testing.T){
 store,h,host,peer,adapter:=bc07Sessions(t,"198.51.100.186")
 room:=bc06Room(t,h,host,peer)
 match:=bc06Start(t,h,host,room.ID)
 if match.ViewerSeat!=0||match.Sequence!=1{t.Fatal("host not admitted to first seat")}
 for i,cookie:=range []any{host,peer}{
  _=i;_=cookie
 }
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"");w.Code!=401{
  t.Fatal("unauthed client accessed game",w.Code)
 }
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",peer);w.Code!=200||
  bytes.Contains(w.Body.Bytes(),[]byte(`"private0"`))||
  bytes.Contains(w.Body.Bytes(),[]byte(`"private1"`)){t.Fatal("wrong 420ID private state",w.Code)}
 ctx:=context.Background()
 start:=time.Now()
 initial:=ClassicSessionAction{RequestID:bc06ActionID(t),Action:"move",ExpectedSequence:2,
  Move:json.RawMessage(`{"take":2}`)}
 first,e:=h.Sessions.Act(ctx,memberA,match.ID,initial)
 if e!=nil||first.Sequence!=2{t.Fatal("first authorized human action",e)}
 // Two service replicas compete to handle the same network retry. Exactly
 // one event/score can commit; all same-actor/digest retries are idempotent.
 replicas:=make([]*ClassicSessions,2)
 for i:=range replicas{
  replicas[i],e=NewClassicSessions(store,h.Rooms,func(game string)ClassicRule{
   if game=="chess"{return adapter};return nil
  })
  if e!=nil{t.Fatal(e)}
 }
 action:=ClassicSessionAction{RequestID:bc06ActionID(t),Action:"move",ExpectedSequence:3,
  Move:json.RawMessage(`{"take":1}`)}
 const attempts=12
 results:=make(chan error,attempts);var wg sync.WaitGroup
 for i:=0;i<attempts;i++{
  wg.Add(1)
  go func(n int){defer wg.Done()
   view,e:=replicas[n%2].Act(ctx,memberB,match.ID,action)
   if e==nil&&view.Sequence!=3{e=ErrConflict}
   results<-e
  }(i)
 }
 wg.Wait();close(results)
 for e:=range results{if e!=nil{t.Fatal("concurrent same-ID retry not idempotent",e)}}
 var public,commands int
 if e=store.DB.QueryRowContext(ctx,`SELECT count(*) FROM bg_account_social.classic_session_events
  WHERE session_id=$1`,match.ID).Scan(&public);e!=nil||public!=3{t.Fatal("duplicate event",public,e)}
 if e=store.DB.QueryRowContext(ctx,`SELECT count(*) FROM bg_account_social.classic_session_commands
  WHERE session_id=$1`,match.ID).Scan(&commands);e!=nil||commands!=2{t.Fatal("duplicate command",commands,e)}
 resumed,e:=NewClassicSessions(store,h.Rooms,func(game string)ClassicRule{
  if game=="chess"{return adapter};return nil
 })
 if e!=nil{t.Fatal(e)}
 if e=resumed.VerifyRules(ctx,match.ID);e!=nil{t.Fatal("server restart failed replay",e)}
 for _,actor:=range []string{memberA,memberB}{
  snapshot,e:=resumed.Get(ctx,actor,match.ID)
  if e!=nil||snapshot.Sequence!=3||snapshot.Status!="active"{t.Fatal("per-seat restore",e)}
 }
 // Finish after a cold process-boundary recovery and confirm authoritative
 // winner, scores and public event high-water are identical for both clients.
 for _,step:=range []struct{actor string;seq int64;take int}{
  {memberA,4,2},{memberB,5,1},
 }{
  output,e:=resumed.Act(ctx,step.actor,match.ID,ClassicSessionAction{
   RequestID:bc06ActionID(t),ExpectedSequence:step.seq,Action:"move",
   Move:json.RawMessage(`{"take":`+string(rune('0'+step.take))+`}`)})
  if e!=nil||output.Sequence!=step.seq{t.Fatal("post-crash move failed",step,e)}
 }
 if e=resumed.VerifyRules(ctx,match.ID);e!=nil{t.Fatal("terminal replay differed",e)}
 hostView,e:=resumed.Get(ctx,memberA,match.ID);if e!=nil{t.Fatal(e)}
 peerView,e:=resumed.Get(ctx,memberB,match.ID);if e!=nil{t.Fatal(e)}
 if hostView.Status!="finished"||peerView.Status!="finished"||
  hostView.Sequence!=5||peerView.Sequence!=5||
  hostView.WinnerSeat==nil||*hostView.WinnerSeat!=0||
  peerView.WinnerSeat==nil||*peerView.WinnerSeat!=0||
  bytes.Equal(hostView.PrivateView,peerView.PrivateView){t.Fatal("cross-account terminal, winner or privacy diverged")}
 for _,actor:=range []string{memberA,memberB}{
  public,high,e:=resumed.Events(ctx,actor,match.ID,0)
  if e!=nil||high!=5||len(public)!=5{t.Fatal("client public replay mismatch",actor,high,e)}
  for k,v:=range public{
   if v.Sequence!=int64(k+1)||bytes.Contains(v.PublicState,[]byte("private"))||
    bytes.Contains(v.PublicState,[]byte("seed"))||bytes.Contains(v.PublicState,[]byte("take")){
    t.Fatal("journal gap or hidden information",actor,k)
   }
  }
 }
 if _,e=resumed.Act(ctx,memberA,match.ID,ClassicSessionAction{
  RequestID:bc06ActionID(t),Action:"move",ExpectedSequence:6,Move:json.RawMessage(`{"take":1}`)});
  !errors.Is(e,ErrConflict){t.Fatal("post-terminal command accepted",e)}
 if time.Since(start)>12*time.Second{t.Fatal("12 concurrent resumes and a complete session exceeded 12s local budget")}
}
