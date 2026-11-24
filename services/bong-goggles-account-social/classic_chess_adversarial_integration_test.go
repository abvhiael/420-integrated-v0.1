//go:build account420_integration

package social

import (
 "context"
 "encoding/json"
 "errors"
 "sync"
 "testing"
 "strings"
)

func TestBC37ConcurrentCompleteChess(t *testing.T){
 store,h,white,black:=bc06Fixture(t,"198.51.100.207")
 adapter,e:=NewChessRulesAdapter();if e!=nil{t.Fatal(e)}
 resolve:=func(game string)ClassicRule{if game=="chess"{return adapter};return nil}
 h.Sessions.Rules=resolve
 room:=bc06Room(t,h,white,black)
 match:=bc06Start(t,h,white,room.ID)
 ctx:=context.Background()
 s:=h.Sessions
 // Two distinct legal actions compete for the same revision. Exactly one
 // may commit; retries of its immutable request must not duplicate it.
 actions:=[]ClassicSessionAction{
 {RequestID:bc06ActionID(t),Action:"move",ExpectedSequence:2,Move:chessAction("move","e2e4")},
 {RequestID:bc06ActionID(t),Action:"move",ExpectedSequence:2,Move:chessAction("move","d2d4")},
 }
 type outcome struct{i int;err error}
 results:=make(chan outcome,2);start:=make(chan struct{});var wg sync.WaitGroup
 for i,a:=range actions{wg.Add(1);go func(i int,a ClassicSessionAction){defer wg.Done();<-start;_,err:=s.Act(ctx,memberA,match.ID,a);results<-outcome{i,err}}(i,a)}
 close(start);wg.Wait();close(results)
 winner:=-1
 for r:=range results{if r.err==nil{if winner!=-1{t.Fatal("two committed moves")};winner=r.i}else if !errors.Is(r.err,ErrConflict){t.Fatal(r.err)}}
 if winner<0{t.Fatal("no committed move")}
 if _,e=s.Act(ctx,memberA,match.ID,actions[winner]);e!=nil{t.Fatal("idempotent retry",e)}
 collision:=actions[winner];collision.Move=actions[1-winner].Move
 if _,e=s.Act(ctx,memberA,match.ID,collision);!errors.Is(e,ErrConflict){t.Fatal("request digest collision",e)}
 // New instance recovers from database, without any original process state.
 s,e=NewClassicSessions(store,h.Rooms,resolve);if e!=nil{t.Fatal(e)};h.Sessions=s
 if e=s.VerifyRules(ctx,match.ID);e!=nil{t.Fatal(e)}
 for i,member:=range []string{memberA,memberB}{
  v,e:=s.Get(ctx,member,match.ID);if e!=nil||v.Sequence!=2||v.ViewerSeat!=i||v.TurnSeat==nil||*v.TurnSeat!=1{t.Fatal("cold recovery",v,e)}
  var view map[string]json.RawMessage
  if e=json.Unmarshal(v.PrivateView,&view);e!=nil{t.Fatal(e)}
  for _,key:=range []string{"seed","repetition","engineState","opponentPolicy","journal"}{if _,ok:=view[key];ok{t.Fatal("private field",key)}}
 }
 outsider:=bc06ActionID(t)
 if _,e=s.Get(ctx,outsider,match.ID);!errors.Is(e,ErrNotFound){t.Fatal("outsider read",e)}
 if _,_,e=s.Events(ctx,outsider,match.ID,0);!errors.Is(e,ErrNotFound){t.Fatal("outsider events",e)}
 // Complete an independent legal game through authenticated HTTP, not
 // injected terminal state. Scholar's mate tests White scoring and replay.
 room=bc06Room(t,h,white,black)
 full:=bc06Start(t,h,white,room.ID)
 for i,uci:=range []string{"e2e4","e7e5","f1c4","b8c6","d1h5","g8f6","h5f7"}{
  actor:=white;if i%2==1{actor=black}
  r:=bc06Act(t,h,actor,full.ID,"move",int64(i+2),map[string]string{"type":"move","uci":uci},bc06ActionID(t))
  if r.Code!=200{t.Fatal(i,r.Code,r.Body.String())}
 }
 if e=s.VerifyRules(ctx,full.ID);e!=nil{t.Fatal(e)}
 for _,member:=range []string{memberA,memberB}{
  v,e:=s.Get(ctx,member,full.ID);if e!=nil||v.Status!="finished"||v.WinnerSeat==nil||*v.WinnerSeat!=0||v.Sequence!=8||v.TurnSeat!=nil{t.Fatal("terminal",v,e)}
  var public struct{Scores []int64;Reason string}
  if json.Unmarshal(v.PrivateView,&public)!=nil||len(public.Scores)!=2||public.Scores[0]!=2||public.Scores[1]!=0||public.Reason!="checkmate"{t.Fatal("score",public)}
 }
 events,seq,e:=s.Events(ctx,memberA,full.ID,0);if e!=nil||seq!=8||len(events)!=8{t.Fatal("journal",seq,len(events),e)}
 if _,e=s.Act(ctx,memberA,full.ID,ClassicSessionAction{RequestID:bc06ActionID(t),Action:"move",ExpectedSequence:9,Move:chessAction("move","a2a3")});!errors.Is(e,ErrConflict){t.Fatal("terminal mutation",e)}
 pgn,e:=s.ExportChessPGN(ctx,memberB,full.ID,ChessPGNMetadata{"Match","BongGoggles","????.??.??","1","White","Black"})
 if e!=nil||!strings.HasSuffix(pgn,"4. Qxf7# 1-0\n"){t.Fatal(pgn,e)}
}
