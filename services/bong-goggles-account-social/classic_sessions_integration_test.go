//go:build account420_integration

package social

import (
 "bytes"
 "context"
 "encoding/json"
 "errors"
 "net/http"
 "net/http/httptest"
 "strings"
 "sync"
 "testing"
 "time"
)

func bc06Fixture(t *testing.T,ip string)(*Store,*Handler,*http.Cookie,*http.Cookie){
 t.Helper()
 store,broker,_,h:=fixture(t)
 messages,e:=NewMessageService(store,bytes.Repeat([]byte{41},32));if e!=nil{t.Fatal(e)}
 games,e:=NewAccountGames(store);if e!=nil{t.Fatal(e)}
 if e=h.EnableAccountExtras(messages,games);e!=nil{t.Fatal(e)}
 rooms,e:=NewClassicRooms(store);if e!=nil{t.Fatal(e)}
 if e=h.EnableClassicRooms(rooms);e!=nil{t.Fatal(e)}
 sessions,e:=NewClassicSessions(store,rooms,bc06Resolver);if e!=nil{t.Fatal(e)}
 if e=h.EnableClassicSessions(sessions);e!=nil{t.Fatal(e)}
 host:=bc05Login(t,h,broker,memberA,ip)
 peer:=bc05Login(t,h,broker,memberB,ip)
 t.Cleanup(func(){
  ctx:=context.Background()
  _,_=store.DB.ExecContext(ctx,"DELETE FROM bg_account_social.classic_session_commands WHERE session_id IN (SELECT id FROM bg_account_social.classic_sessions WHERE room_id IN (SELECT id FROM bg_account_social.classic_rooms WHERE host=$1))",memberA)
  _,_=store.DB.ExecContext(ctx,"DELETE FROM bg_account_social.classic_session_events WHERE session_id IN (SELECT id FROM bg_account_social.classic_sessions WHERE room_id IN (SELECT id FROM bg_account_social.classic_rooms WHERE host=$1))",memberA)
  _,_=store.DB.ExecContext(ctx,"DELETE FROM bg_account_social.classic_sessions WHERE room_id IN (SELECT id FROM bg_account_social.classic_rooms WHERE host=$1)",memberA)
  _,_=store.DB.ExecContext(ctx,"DELETE FROM bg_account_social.classic_room_invites WHERE room_id IN (SELECT id FROM bg_account_social.classic_rooms WHERE host=$1)",memberA)
  _,_=store.DB.ExecContext(ctx,"DELETE FROM bg_account_social.classic_room_seats WHERE room_id IN (SELECT id FROM bg_account_social.classic_rooms WHERE host=$1)",memberA)
  _,_=store.DB.ExecContext(ctx,"DELETE FROM bg_account_social.classic_rooms WHERE host=$1",memberA)
  _=store.Relationship(ctx,memberB,memberA,"block",false)
  _=store.Relationship(ctx,memberA,memberB,"block",false)
 })
 return store,h,host,peer
}
func bc06Room(t *testing.T,h *Handler,a,b *http.Cookie)ClassicRoomView{
 t.Helper()
 room:=bc05Create(t,h,a,"chess","public",2)
 status,joined:=bc05Change(t,h,b,room.ID,room.Revision,1,"join",nil)
 if status!=200||joined.Status!="ready"{t.Fatal("public room not ready",status,joined)}
 return joined
}
func bc06Start(t *testing.T,h *Handler,a *http.Cookie,roomID string)ClassicSessionView{
 t.Helper()
 reply:=request(h,"POST","/v1/classic-sessions",body(map[string]any{"roomId":roomID}),a)
 if reply.Code!=201{t.Fatal("start",reply.Code,reply.Body.String())}
 var result struct{Session ClassicSessionView}
 if e:=json.Unmarshal(reply.Body.Bytes(),&result);e!=nil{t.Fatal(e)}
 if !uuid.MatchString(result.Session.ID){t.Fatal("missing session ID")}
 return result.Session
}
func bc06Act(t *testing.T,h *Handler,cookie *http.Cookie,id,kind string,seq int64,move any,requestID string)*httptest.ResponseRecorder{
 t.Helper()
 data:=map[string]any{"requestId":requestID,"action":kind,"expectedSequence":seq}
 if move!=nil{data["move"]=move}
 return request(h,"POST","/v1/classic-sessions/"+id+"/action",body(data),cookie)
}
func bc06ActionID(t *testing.T)string{
 t.Helper();id,e:=newID();if e!=nil{t.Fatal(e)};return id
}
func TestBC06SessionMovesReplaysPrivacyAndRestart(t *testing.T){
 store,h,a,b:=bc06Fixture(t,"198.51.100.111")
 room:=bc06Room(t,h,a,b)
 if status,_:=bc05Change(t,h,a,room.ID,room.Revision,1,"bot",map[string]any{"difficulty":"easy"});status!=400{
  t.Fatal("occupied player seat bot replacement",status)
 }
 if w:=request(h,"POST","/v1/classic-sessions",body(map[string]any{"roomId":room.ID,"winner":memberA}),a);w.Code!=400{t.Fatal("client winner injection",w.Code)}
 if w:=request(h,"POST","/v1/classic-sessions",body(map[string]any{"roomId":room.ID}),b);w.Code!=404{t.Fatal("foreign start accepted",w.Code)}
 match:=bc06Start(t,h,a,room.ID)
 if match.Sequence!=1||match.Status!="active"||match.TurnSeat==nil||*match.TurnSeat!=0||match.Deadline==nil{
  t.Fatal("session initial authority",match)
 }
 if !strings.Contains(string(match.PrivateView),"only-a")||strings.Contains(string(match.PrivateView),"only-b"){t.Fatal("wrong private seat view")}
 // A retried start is idempotent: one room and one durable session.
 same:=bc06Start(t,h,a,room.ID)
 if same.ID!=match.ID||same.Sequence!=1{t.Fatal("duplicate start created another session")}
 if status,_:=bc05Change(t,h,a,room.ID,room.Revision+1,1,"leave",nil);status!=409{
  t.Fatal("BC-0.5 changed active session seats",status)
 }
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",b);w.Code!=200||
  !strings.Contains(w.Body.String(),"only-b")||strings.Contains(w.Body.String(),"only-a"){
  t.Fatal("private opponent view",w.Code,w.Body.String())
 }
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"");w.Code!=401{t.Fatal("guest resumed match",w.Code)}
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",&http.Cookie{Name:sessionCookieName,Value:"forged-session"});w.Code!=401{t.Fatal("forged cookie",w.Code)}
 if w:=request(h,"GET","/v1/classic-sessions", "",a);w.Code!=200||!strings.Contains(w.Body.String(),match.ID){t.Fatal("resume list",w.Code)}
 id:=bc06ActionID(t)
 if w:=bc06Act(t,h,b,match.ID,"move",2,map[string]int{"take":1},bc06ActionID(t));w.Code!=403{
  t.Fatal("opponent stole turn",w.Code,w.Body.String())
 }
 if w:=bc06Act(t,h,a,match.ID,"move",2,map[string]int{"take":7},id);w.Code!=400{
  t.Fatal("unqualified illegal move",w.Code,w.Body.String())
 }
 first:=bc06Act(t,h,a,match.ID,"move",2,map[string]int{"take":1},id)
 if first.Code!=200{t.Fatal("first legal move",first.Code,first.Body.String())}
 if w:=bc06Act(t,h,a,match.ID,"move",2,map[string]int{"take":1},id);w.Code!=200{t.Fatal("idempotent replay",w.Code,w.Body.String())}
 if w:=bc06Act(t,h,a,match.ID,"move",2,map[string]int{"take":2},id);w.Code!=409{t.Fatal("request ID reused for changed move",w.Code)}
 if w:=bc06Act(t,h,a,match.ID,"move",3,map[string]int{"take":1},bc06ActionID(t));w.Code!=403{t.Fatal("same player double move",w.Code)}
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID+"/events?after=0","",b);w.Code!=200||
  !strings.Contains(w.Body.String(),`"sequence":2`)||strings.Contains(w.Body.String(),"only-a")||
  strings.Contains(w.Body.String(),"only-b"){t.Fatal("public event privacy",w.Code,w.Body.String())}
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID+"/events?after=500","",b);w.Code!=409{t.Fatal("future event cursor",w.Code)}
 // Restart transport with same durable store and pinned test engine.
 recovered,e:=NewClassicSessions(store,h.Rooms,bc06Resolver);if e!=nil{t.Fatal(e)}
 if e=store.ReadyClassicSessions(context.Background());!errors.Is(e,ErrUnavailable){t.Fatal("superuser must fail restricted runtime grant qualification",e)}
 h.Sessions=recovered
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",a);w.Code!=200||
   !strings.Contains(w.Body.String(),`"sequence":2`){t.Fatal("failed resume after restart",w.Code,w.Body.String())}
 if w:=bc06Act(t,h,b,match.ID,"move",3,map[string]int{"take":1},bc06ActionID(t));w.Code!=200{
  t.Fatal("second actor move",w.Code,w.Body.String())
 }
 if w:=bc06Act(t,h,a,match.ID,"move",4,map[string]int{"take":1},bc06ActionID(t));w.Code!=200||
  !strings.Contains(w.Body.String(),`"status":"finished"`){t.Fatal("terminal engine decision",w.Code,w.Body.String())}
 if w:=bc06Act(t,h,b,match.ID,"move",5,map[string]int{"take":1},bc06ActionID(t));w.Code!=409{t.Fatal("post-terminal move",w.Code)}
 var count int
 if e=store.DB.QueryRow("SELECT count(*) FROM bg_account_social.classic_session_events WHERE session_id=$1",match.ID).Scan(&count);e!=nil||count!=4{
  t.Fatal("event count must match start+3 actions",e,count)
 }
}
func TestBC06TimeoutSweepResignationAndBlocks(t *testing.T){
 store,h,a,b:=bc06Fixture(t,"198.51.100.112")
 room:=bc06Room(t,h,a,b);match:=bc06Start(t,h,a,room.ID)
 if _,e:=store.DB.Exec("UPDATE bg_account_social.classic_sessions SET turn_deadline=clock_timestamp()-interval '5 seconds' WHERE id=$1",match.ID);e!=nil{t.Fatal(e)}
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",b);w.Code!=200||
  !strings.Contains(w.Body.String(),`"status":"timed_out"`){t.Fatal("expire read",w.Code,w.Body.String())}
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID+"/events?after=1","",a);w.Code!=200||
  !strings.Contains(w.Body.String(),`"kind":"timed_out"`){t.Fatal("timeout not published",w.Code,w.Body.String())}
 n,e:=h.Sessions.Sweep(context.Background());if e!=nil||n!=0{t.Fatal("duplicate timeout",n,e)}
 if w:=bc06Act(t,h,a,match.ID,"move",3,map[string]int{"take":1},bc06ActionID(t));w.Code!=409{t.Fatal("timeout allowed move",w.Code)}
 room2:=bc06Room(t,h,a,b);game2:=bc06Start(t,h,a,room2.ID)
 if e=store.Relationship(context.Background(),memberB,memberA,"block",true);e!=nil{t.Fatal(e)}
 if w:=request(h,"GET","/v1/classic-sessions/"+game2.ID,"",b);w.Code!=404{t.Fatal("blocked participant saw private match",w.Code)}
 if w:=request(h,"GET","/v1/classic-sessions/"+game2.ID+"/events?after=0","",a);w.Code!=404{t.Fatal("block leaked event journal",w.Code)}
 if e=store.Relationship(context.Background(),memberB,memberA,"block",false);e!=nil{t.Fatal(e)}
 if w:=bc06Act(t,h,b,game2.ID,"resign",2,nil,bc06ActionID(t));w.Code!=200||
  !strings.Contains(w.Body.String(),`"status":"resigned"`){t.Fatal("resign denied",w.Code,w.Body.String())}
 if w:=request(h,"GET","/v1/classic-sessions/"+game2.ID,"",a);w.Code!=200||
  !strings.Contains(w.Body.String(),`"winnerSeat":0`){t.Fatal("two-seat forfeit winner",w.Code)}
 if w:=request(h,"GET","/v1/classic-sessions/"+game2.ID+"/events?after=1","",a);w.Code!=200||
  !strings.Contains(w.Body.String(),`"kind":"resigned"`){t.Fatal("schema-qualified resignation event",w.Code,w.Body.String())}
}
func TestBC06ConcurrentMovesSEEDeliveryAndFailClosedRules(t *testing.T){
 _,h,a,b:=bc06Fixture(t,"198.51.100.113")
 room:=bc06Room(t,h,a,b)
 // No production rule engine is bundled: activation cannot fabricate a chess game.
 h.Sessions.Rules=nil
 if w:=request(h,"POST","/v1/classic-sessions",body(map[string]any{"roomId":room.ID}),a);w.Code!=503{
  t.Fatal("unqualified rules started a match",w.Code,w.Body.String())
 }
 h.Sessions.Rules=bc06Resolver
 match:=bc06Start(t,h,a,room.ID)
 var wg sync.WaitGroup
 results:=make(chan int,2)
 for i:=0;i<2;i++{
  wg.Add(1);go func(){defer wg.Done()
   reply:=request(h,"POST","/v1/classic-sessions/"+match.ID+"/action",
     body(map[string]any{"action":"move","requestId":func()string{id,_:=newID();return id}(),
      "expectedSequence":2,"move":map[string]int{"take":1}}),a)
   results<-reply.Code
  }()
 }
 wg.Wait();close(results)
 good,conflict:=0,0
 for v:=range results{if v==200{good++}else if v==409{conflict++}else{t.Fatal("unexpected concurrent move result",v)}}
 if good!=1||conflict!=1{t.Fatal("concurrent moves both committed",good,conflict)}
 ctx,cancel:=context.WithTimeout(context.Background(),200*time.Millisecond)
 defer cancel()
 url:="https://bonggoggles.420integrated.org/v1/classic-sessions/"+match.ID+"/stream"
 req:=httptest.NewRequest("GET",url,nil).WithContext(ctx)
 req.Header.Set("X-Forwarded-Proto","https")
 req.AddCookie(b)
 recorder:=httptest.NewRecorder()
 h.ServeHTTP(recorder,req)
 if recorder.Code!=200||!strings.Contains(recorder.Header().Get("Content-Type"),"text/event-stream")||
  !strings.Contains(recorder.Body.String(),"event: state")||
  !strings.Contains(recorder.Body.String(),"id: 2")||
  strings.Contains(recorder.Body.String(),"only-a"){
  t.Fatal("unauthorized, missing or secret SSE payload",recorder.Code,recorder.Body.String())
 }
 if w:=bc06Act(t,h,b,match.ID,"cancel",3,nil,bc06ActionID(t));w.Code!=403{
  t.Fatal("non-host cancelled active match",w.Code)
 }
 if w:=bc06Act(t,h,a,match.ID,"cancel",3,nil,bc06ActionID(t));w.Code!=200||
  !strings.Contains(w.Body.String(),`"status":"cancelled"`){t.Fatal("host cancellation denied",w.Code,w.Body.String())}
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID+"/events?after=2","",b);w.Code!=200||
  !strings.Contains(w.Body.String(),`"kind":"cancelled"`){t.Fatal("schema-qualified cancellation event",w.Code,w.Body.String())}
}
