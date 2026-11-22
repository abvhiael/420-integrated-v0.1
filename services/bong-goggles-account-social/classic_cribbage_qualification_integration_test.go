//go:build account420_integration

package social

import (
 "bytes"
 "context"
 "encoding/json"
 "errors"
 "net/http"
 "sync"
 "testing"
)

// BC-1.7 adversarial qualification uses genuine PostgreSQL, the registered
// Cribbage rules and signed 420ID principals. No stand-in rules or client score.
func bc17Friends(t *testing.T,store *Store){
 t.Helper()
 for _,pair:=range [][2]string{{memberA,memberB},{memberB,memberA}}{
  if e:=store.Relationship(context.Background(),pair[0],pair[1],"follow",true);e!=nil{t.Fatal(e)}
 }
}

func TestBC17ParallelSignedChallengesAreAtomicAndBounded(t *testing.T){
 store,h,host,_:=bc16Fixture(t)
 bc17Friends(t,store)
 ctx:=context.Background()
 nonce:=bc06ActionID(t)
 const attempts=12
 type result struct{id string;err error}
 results:=make(chan result,attempts)
 var wg sync.WaitGroup
 for i:=0;i<attempts;i++{
  wg.Add(1)
  go func(){
   defer wg.Done()
   room,e:=h.Sessions.Challenge(ctx,memberA,memberB,nonce)
   results<-result{room.ID,e}
  }()
 }
 wg.Wait();close(results)
 first:=""
 for r:=range results{
  if r.err!=nil{t.Fatal("parallel request ID must recover single verified lobby",r.err)}
  if first==""{first=r.id}
  if r.id!=first{t.Fatal("parallel challenge created more than one room",r.id,first)}
 }
 var rooms,requests,invites int
 for _,test:=range []struct{sql string;into *int}{
  {"SELECT count(*) FROM bg_account_social.classic_rooms WHERE host=$1 AND game_id='cribbage' AND status='open'",&rooms},
  {"SELECT count(*) FROM bg_account_social.classic_match_requests WHERE actor=$1",&requests},
  {"SELECT count(*) FROM bg_account_social.classic_room_invites WHERE inviter=$1 AND status='pending'",&invites},
 }{
  if e:=store.DB.QueryRowContext(ctx,test.sql,memberA).Scan(test.into);e!=nil{t.Fatal(e)}
 }
 if rooms!=1||requests!=1||invites!=1{t.Fatalf("non-idempotent signed request: rooms=%d ledger=%d invitations=%d",rooms,requests,invites)}
 // A changed target with the original nonce is a conflict, not a new room.
 if _,e:=h.Sessions.Challenge(ctx,memberA,extraThird,nonce);!errors.Is(e,ErrConflict){t.Fatal("cross-target nonce reuse",e)}
 // The same serialization domain protects the 10-active-room cap even
 // while one client calls ordinary Create and another sends challenges.
 otherRequests:=make([]string,16)
 for i:=range otherRequests{otherRequests[i]=bc06ActionID(t)}
 resultsErr:=make(chan error,len(otherRequests))
 for i:=range otherRequests{
  wg.Add(1)
  go func(id string){
   defer wg.Done()
   _,e:=h.Sessions.Challenge(ctx,memberA,memberB,id)
   resultsErr<-e
  }(otherRequests[i])
 }
 wg.Wait();close(resultsErr)
 ok,conflicts:=0,0
 for e:=range resultsErr{
  if e==nil{ok++}else if errors.Is(e,ErrConflict){conflicts++}else{t.Fatal("quota unexpected",e)}
 }
 if ok!=9||conflicts!=7{t.Fatalf("parallel quota exceeded or prematurely blocked: success=%d conflict=%d",ok,conflicts)}
 if e:=store.DB.QueryRowContext(ctx,
  "SELECT count(*) FROM bg_account_social.classic_rooms WHERE host=$1 AND status IN ('open','ready','in_game')",memberA).Scan(&rooms);e!=nil||rooms!=10{
  t.Fatal("host active-room quota diverged",rooms,e)
 }
 if w:=request(h,"GET","/v1/classic-sessions/history","",host);w.Code!=200{t.Fatal("bounded history after concurrent requests",w.Code)}
}

func TestBC17ContestedTerminalRematchCanOnlyCreateOneLobby(t *testing.T){
 store,h,host,peer:=bc16Fixture(t)
 bc17Friends(t,store)
 room:=bc15Room(t,h,host,peer,2)
 match:=bc06Start(t,h,host,room.ID)
 if r:=bc06Act(t,h,host,match.ID,"resign",match.Sequence+1,nil,bc06ActionID(t));r.Code!=200{
  t.Fatal("terminal match",r.Code,r.Body.String())
 }
 path:="/v1/classic-sessions/"+match.ID+"/rematch"
 const contenders=2
 type outcome struct{roomID string;err error;actor string}
 results:=make(chan outcome,contenders)
 ctx:=context.Background()
 start:=make(chan struct{})
 for _,actor:=range []string{memberA,memberB}{
  actor:=actor;nonce:=bc06ActionID(t)
  go func(){
   <-start
   room,e:=h.Sessions.Rematch(ctx,actor,match.ID,nonce)
   results<-outcome{room.ID,e,actor}
  }()
 }
 close(start)
 success,conflict:=0,0
 winner:=""
 for i:=0;i<contenders;i++{
  v:=<-results
  if v.err==nil{success++;winner=v.roomID
  }else if errors.Is(v.err,ErrConflict){conflict++
  }else{t.Fatal("invalid rematch contention outcome",v.actor,v.err)}
 }
 if success!=1||conflict!=1||winner==""{t.Fatal("concurrent terminal rematch duplicated",success,conflict)}
 var ledger int
 if e:=store.DB.QueryRowContext(ctx,"SELECT count(*) FROM bg_account_social.classic_match_requests WHERE source_session_id=$1",match.ID).Scan(&ledger);e!=nil||ledger!=1{
  t.Fatal("one source produced multiple rematches",ledger,e)
 }
 if w:=request(h,"GET","/v1/classic-rooms/"+winner,"",nil);w.Code!=401{t.Fatal("public lobby privacy",w.Code)}
}

func TestBC17BlockRevokesInviteAndVerifiedHistory(t *testing.T){
 store,h,host,peer:=bc16Fixture(t)
 ctx:=context.Background()
 bc17Friends(t,store)
 code,lobby:=bc16Send(t,h,host,"/v1/classic-sessions/challenge",bc06ActionID(t),map[string]any{"target":memberB})
 if code!=201{t.Fatal("signed challenge",code)}
 if w:=request(h,"GET","/v1/classic-sessions/history","",peer);w.Code!=200||
  !bytes.Contains(w.Body.Bytes(),[]byte(lobby.ID)){t.Fatal("accepted participant invitation missing",w.Code)}
 if e:=store.Relationship(ctx,memberB,memberA,"block",true);e!=nil{t.Fatal(e)}
 if w:=request(h,"GET","/v1/classic-sessions/history","",peer);w.Code!=200||
  bytes.Contains(w.Body.Bytes(),[]byte(lobby.ID)){t.Fatal("blocked private invitation leaked",w.Code)}
 if w:=request(h,"GET","/v1/classic-rooms/"+lobby.ID,"",peer);w.Code==200{t.Fatal("blocked room still visible")}
 if w:=request(h,"POST","/v1/classic-rooms/"+lobby.ID+"/change",body(RoomChange{
  Action:"accept",Seat:1,ExpectedRevision:lobby.Revision}),peer);w.Code==200{t.Fatal("blocked invitation accepted")}
 if e:=store.Relationship(ctx,memberB,memberA,"block",false);e!=nil{t.Fatal(e)}
 // Unblocking does not restore follow consent. Existing historical request
 // cannot be used as a hidden bypass to force a new authorized match.
 if w:=request(h,"POST","/v1/classic-rooms/"+lobby.ID+"/change",body(RoomChange{
  Action:"accept",Seat:1,ExpectedRevision:lobby.Revision}),peer);w.Code==200{t.Fatal("unblock silently restored mutual consent")}
}

func TestBC17ConcurrentCribbageMoveUsesOneImmutableJournal(t *testing.T){
 store,h,host,peer,adapter:=bc15Fixture(t,"198.51.100.246")
 room:=bc15Room(t,h,host,peer,2)
 session:=bc06Start(t,h,host,room.ID)
 ctx:=context.Background()
 actionRaw,e:=json.Marshal(bc15Move(t,session));if e!=nil{t.Fatal(e)}
 action:=ClassicSessionAction{RequestID:bc06ActionID(t),ExpectedSequence:session.Sequence+1,Action:"move",Move:actionRaw}
 const n=10
 outcomes:=make(chan error,n)
 var wg sync.WaitGroup
 for i:=0;i<n;i++{
  wg.Add(1)
  go func(){
   defer wg.Done()
   view,e:=h.Sessions.Act(ctx,memberA,session.ID,action)
   if e==nil&&(view.Sequence!=2||view.ViewerSeat!=0){e=ErrUnavailable}
   outcomes<-e
  }()
 }
 wg.Wait();close(outcomes)
 for e:=range outcomes{if e!=nil{t.Fatal("legitimate same-request retry failed",e)}}
 for _,cookie:=range []*http.Cookie{host,peer}{
  view:=bc15Get(t,h,cookie,session.ID)
  if view.Sequence!=2||view.RulesHash!=adapter.hash{t.Fatal("cross-seat state changed",view.Sequence)}
 }
 var moves,events,commands int
 for _,test:=range []struct{sql string;into *int}{
  {"SELECT count(*) FROM bg_account_social.classic_rule_moves WHERE session_id=$1",&moves},
  {"SELECT count(*) FROM bg_account_social.classic_session_events WHERE session_id=$1",&events},
  {"SELECT count(*) FROM bg_account_social.classic_session_commands WHERE session_id=$1",&commands},
 }{
  if e:=store.DB.QueryRowContext(ctx,test.sql,session.ID).Scan(test.into);e!=nil{t.Fatal(e)}
 }
 if moves!=1||events!=2||commands!=1{t.Fatalf("duplicate move or journal: %d %d %d",moves,events,commands)}
 if e:=h.Sessions.VerifyRules(ctx,session.ID);e!=nil{t.Fatal("concurrent immutable replay",e)}
 if _,e:=h.Sessions.Act(ctx,memberB,session.ID,action);!errors.Is(e,ErrConflict){
  t.Fatal("other 420ID identity reused request ID",e)
 }
 if _,e:=h.Sessions.Act(ctx,memberA,session.ID,ClassicSessionAction{
  RequestID:bc06ActionID(t),ExpectedSequence:session.Sequence+1,Action:"move",Move:actionRaw,
 });!errors.Is(e,ErrConflict){t.Fatal("independent stale move accepted",e)}
}
