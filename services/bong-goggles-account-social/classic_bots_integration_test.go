//go:build account420_integration

package social

import (
 "bytes"
 "context"
 "errors"
 "sync"
 "testing"
 "time"
)

func TestBC08MixedBotSessionSerializesReplaysAndKeepsSecrets(t *testing.T){
 store,h,host,peer,adapter:=bc07Sessions(t,"198.51.100.161")
 policies,_,_,_:=bc08Policies()
 if e:=h.Sessions.EnableBots(map[string]ClassicBotPolicies{"chess":policies});e!=nil{t.Fatal(e)}
 room:=bc05Create(t,h,host,"chess","private",2)
 status,ready:=bc05Change(t,h,host,room.ID,room.Revision,1,"bot",map[string]any{"difficulty":"hard"})
 if status!=200||ready.Status!="ready"{t.Fatal("bot-filled room not ready",status)}
 match:=bc06Start(t,h,host,room.ID)
 if match.TurnSeat==nil||*match.TurnSeat!=0||match.Sequence!=1{t.Fatal("wrong initial seat",match)}
 if n,e:=h.Sessions.SweepBots(context.Background());e!=nil||n!=0{t.Fatal("non-bot turn consumed",n,e)}
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",peer);w.Code!=404{
  t.Fatal("outsider received bot seat projection",w.Code)
 }
 first:=bc06Act(t,h,host,match.ID,"move",2,map[string]any{"take":2},bc06ActionID(t))
 if first.Code!=200{t.Fatal("human move",first.Code,first.Body.String())}
 if w:=bc06Act(t,h,host,match.ID,"move",3,map[string]any{"take":1},bc06ActionID(t));w.Code!=403{
  t.Fatal("host impersonated bot",w.Code)
 }
 // Concurrent sweeper and explicit worker calls must serialize through
 // the room and session row locks. Exactly one bot action can commit.
 var wg sync.WaitGroup
 results:=make(chan bool,2)
 failures:=make(chan error,2)
 for i:=0;i<2;i++{
  wg.Add(1);go func(){defer wg.Done()
   moved,e:=h.Sessions.RunBotTurn(context.Background(),match.ID)
   results<-moved;failures<-e
  }()
 }
 wg.Wait();close(results);close(failures)
 count:=0
 for done:=range results{if done{count++}}
 for e:=range failures{if e!=nil{t.Fatal("bot worker race",e)}}
 if count!=1{t.Fatal("bot turn executed multiple times",count)}
 if e:=h.Sessions.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("invalid bot replay",e)}
 state,e:=h.Sessions.Get(context.Background(),memberA,match.ID)
 if e!=nil||state.Sequence!=3||state.Status!="active"||state.TurnSeat==nil||*state.TurnSeat!=0||
  !bytes.Contains(state.PrivateView,[]byte(`"scores":[2,2]`)){
  t.Fatal("bot scoring or visible state",state,e)
 }
 if bytes.Contains(state.PrivateView,[]byte("private1"))||bytes.Contains(state.PrivateView,[]byte("seed")){
  t.Fatal("bot-side state leaked into human view")
 }
 second:=bc06Act(t,h,host,match.ID,"move",4,map[string]any{"take":1},bc06ActionID(t))
 if second.Code!=200{t.Fatal("second human move",second.Code,second.Body.String())}
 processed,e:=h.Sessions.SweepBots(context.Background())
 if e!=nil||processed!=1{t.Fatal("scheduled terminal bot move",processed,e)}
 final,e:=h.Sessions.Get(context.Background(),memberA,match.ID)
 if e!=nil||final.Status!="finished"||final.WinnerSeat==nil||*final.WinnerSeat!=1||final.Sequence!=5{
  t.Fatal("server-owned bot result",final,e)
 }
 if e:=h.Sessions.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("completed bot transcript",e)}
 var journalCount,moveCount int
 if e=store.DB.QueryRow("SELECT count(*) FROM bg_account_social.classic_session_events WHERE session_id=$1",match.ID).Scan(&journalCount);e!=nil||journalCount!=5{t.Fatal("event journal",journalCount,e)}
 if e=store.DB.QueryRow("SELECT count(*) FROM bg_account_social.classic_rule_moves WHERE session_id=$1",match.ID).Scan(&moveCount);e!=nil||moveCount!=4{t.Fatal("private move journal",moveCount,e)}
 ev:=request(h,"GET","/v1/classic-sessions/"+match.ID+"/events?after=0","",host)
 if ev.Code!=200||bytes.Contains(ev.Body.Bytes(),[]byte(`"take"`))||
  bytes.Contains(ev.Body.Bytes(),[]byte("private0"))||bytes.Contains(ev.Body.Bytes(),[]byte("private1")){
  t.Fatal("public journal exposed bot actions or secrets",ev.Code,ev.Body.String())
 }
 // Restart with the same ruleset and policies: no replay of completed bots.
 restored,e:=NewClassicSessions(store,h.Rooms,func(game string)ClassicRule{return adapter})
 if e!=nil{t.Fatal(e)}
 if e=restored.EnableBots(map[string]ClassicBotPolicies{"chess":policies});e!=nil{t.Fatal(e)}
 if n,e:=restored.SweepBots(context.Background());e!=nil||n!=0{t.Fatal("restart duplicated bot move",n,e)}
 if e=restored.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("restart replay failed",e)}
}
func TestBC08RejectMissingPolicyAndExpiredBotTurn(t *testing.T){
 store,h,host,_,adapter:=bc07Sessions(t,"198.51.100.162")
 room:=bc05Create(t,h,host,"chess","private",2)
 status,ready:=bc05Change(t,h,host,room.ID,room.Revision,1,"bot",map[string]any{"difficulty":"medium"})
 if status!=200{t.Fatal("bot lobby",status)}
 if w:=request(h,"POST","/v1/classic-sessions",body(map[string]any{"roomId":room.ID}),host);w.Code!=503{
  t.Fatal("unqualified bot game started",w.Code,w.Body.String())
 }
 if e:=h.Sessions.EnableBots(map[string]ClassicBotPolicies{"chess":ClassicBotPolicies{Easy:&bc08Policy{}}});e==nil{
  t.Fatal("incomplete policies accepted")
 }
 policies,_,_,_:=bc08Policies()
 if e:=h.Sessions.EnableBots(map[string]ClassicBotPolicies{"chess":policies});e!=nil{t.Fatal(e)}
 match:=bc06Start(t,h,host,ready.ID)
 if w:=bc06Act(t,h,host,match.ID,"move",2,map[string]any{"take":1},bc06ActionID(t));w.Code!=200{
  t.Fatal("host move to bot",w.Code,w.Body.String())
 }
 if _,e:=store.DB.Exec("UPDATE bg_account_social.classic_sessions SET turn_deadline=clock_timestamp()-interval '5 seconds' WHERE id=$1",match.ID);e!=nil{t.Fatal(e)}
 moved,e:=h.Sessions.RunBotTurn(context.Background(),match.ID)
 if e!=nil||moved{t.Fatal("expired bot executed action",moved,e)}
 final,e:=h.Sessions.Get(context.Background(),memberA,match.ID)
 if e!=nil||final.Status!="timed_out"||final.Sequence!=3{t.Fatal("expired bot not timed out",final,e)}
 var n int
 if e=store.DB.QueryRow("SELECT count(*) FROM bg_account_social.classic_rule_moves WHERE session_id=$1",match.ID).Scan(&n);e!=nil||n!=1{
  t.Fatal("timeout emitted bot move",n,e)
 }
 if e=h.Sessions.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("timed-out session replay",e)}
 // Without an installed game policy a restarted worker must fail closed.
 restored,e:=NewClassicSessions(store,h.Rooms,func(game string)ClassicRule{return adapter})
 if e!=nil{t.Fatal(e)}
 if _,e=restored.RunBotTurn(context.Background(),match.ID);!errors.Is(e,ErrInvalid){
  t.Fatal("unconfigured worker ran",e)
 }
 _=time.Second // retain explicit deadline behavior coverage
}
