//go:build account420_integration

package social

import (
 "bytes"
 "context"
 "encoding/json"
 "net/http"
 "testing"
)

// BC-1.5 integration uses the actual PostgreSQL-backed 420ID session,
// signed cookie principal, server-only shuffle, move journal and room locks.
func bc15Fixture(t *testing.T,ip string)(*Store,*Handler,*http.Cookie,*http.Cookie,*RulesAdapter){
 t.Helper()
 store,h,host,peer:=bc06Fixture(t,ip)
 adapter,e:=NewCribbageRulesAdapter();if e!=nil{t.Fatal(e)}
 h.Sessions.Rules=func(game string)ClassicRule{
  if game=="cribbage"{return adapter}
  return nil
 }
 if e=h.Sessions.EnableBots(map[string]ClassicBotPolicies{
  "cribbage":NewCribbageBotPolicies(),
 });e!=nil{t.Fatal(e)}
 return store,h,host,peer,adapter
}
func bc15Room(t *testing.T,h *Handler,host,peer *http.Cookie,n int)ClassicRoomView{
 t.Helper()
 r:=bc05Create(t,h,host,"cribbage","public",n)
 code,joined:=bc05Change(t,h,peer,r.ID,r.Revision,1,"join",nil)
 if code!=200{t.Fatal("peer join",n,code)}
 r=joined
 for seat:=2;seat<n;seat++{
  level:=[]string{"easy","medium","hard"}[(seat-2)%3]
  code,r=bc05Change(t,h,host,r.ID,r.Revision,seat,"bot",map[string]any{"difficulty":level})
  if code!=200{t.Fatal("qualified bot seat",n,seat,code)}
 }
 if r.Status!="ready"{t.Fatal("room did not become ready",n,r)}
 return r
}
func bc15Get(t *testing.T,h *Handler,cookie *http.Cookie,id string)ClassicSessionView{
 t.Helper()
 reply:=request(h,"GET","/v1/classic-sessions/"+id,"",cookie)
 if reply.Code!=200{t.Fatalf("authenticated resume GET=%d: %s",reply.Code,reply.Body.String())}
 var payload struct{Session ClassicSessionView}
 if e:=json.Unmarshal(reply.Body.Bytes(),&payload);e!=nil{t.Fatal(e)}
 if payload.Session.ID!=id{t.Fatal("wrong session identity")}
 return payload.Session
}
func bc15Move(t *testing.T,session ClassicSessionView)map[string]any{
 t.Helper()
 var v struct{
  Phase string `json:"phase"`
  Hand []int `json:"hand"`
  PegCount int `json:"pegCount"`
  Seat int `json:"seat"`
 }
 if e:=json.Unmarshal(session.PrivateView,&v);e!=nil{t.Fatal(e)}
 if session.TurnSeat==nil||*session.TurnSeat!=v.Seat{t.Fatal("private seat/turn mismatch")}
 switch v.Phase{
 case "discard":
  n:=1;if session.SeatCount==2{n=2}
  if len(v.Hand)<n{t.Fatal("not enough private discard cards")}
  return map[string]any{"type":"discard","cards":v.Hand[:n]}
 case "cut":
  return map[string]any{"type":"cut"}
 case "peg":
  for _,card:=range v.Hand{
   if cribbagePips(card)+v.PegCount<=31{return map[string]any{"type":"play","card":card}}
  }
  if len(v.Hand)>0{return map[string]any{"type":"go"}}
 }
 t.Fatalf("no canonical human move in %s",v.Phase)
 return nil
}
func TestBC15TwoIndependent420IDAccountsPlayAndColdResume(t *testing.T){
 store,h,host,peer,adapter:=bc15Fixture(t,"198.51.100.215")
 room:=bc15Room(t,h,host,peer,2)
 if w:=request(h,"POST","/v1/classic-sessions",body(map[string]string{"roomId":room.ID}),peer);w.Code!=404{
  t.Fatal("nonhost started independent 420ID match",w.Code)
 }
 match:=bc06Start(t,h,host,room.ID)
 if match.RulesHash!=adapter.hash||match.RulesVersion!="v1.0"||match.Status!="active"{t.Fatal("unqualified rules identity",match)}
 initialOther:=bc15Get(t,h,peer,match.ID)
 if initialOther.ViewerSeat!=1||match.ViewerSeat!=0||bytes.Equal(match.PrivateView,initialOther.PrivateView){
  t.Fatal("independent 420ID seat views not isolated")
 }
 for _,view:=range []ClassicSessionView{match,initialOther}{
  for _,private:=range [][]byte{[]byte(`"deck"`),[]byte(`"seed"`),[]byte(`"opponentHand"`),[]byte(`"allHands"`)}{
   if bytes.Contains(view.PrivateView,private){t.Fatal("hidden engine field leaked")}
  }
 }
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"");w.Code!=401{t.Fatal("guest could view hidden match",w.Code)}
 if w:=request(h,"POST","/v1/classic-sessions/"+match.ID+"/action",body(map[string]any{
  "action":"move","expectedSequence":2,"requestId":bc06ActionID(t),
  "move":map[string]any{"type":"cut"},
 }));w.Code!=401{t.Fatal("unauthenticated move",w.Code)}
 if w:=request(h,"POST","/v1/classic-sessions",body(map[string]string{"roomId":room.ID}),host);w.Code!=201{
  t.Fatal("idempotent host restart",w.Code,w.Body.String())
 }
 // Each accepted POST returns an independently verified seat projection.
 // Reusing its signed response for the very next turn avoids an unnecessary
 // O(N) full-journal replay twice per move. Recheck both actual 420ID cookies
 // at checkpoints and at finish; the game still runs all the way to 121.
 current:=match
 for step:=0;step<400;step++{
  if current.Status=="finished"{
   a:=bc15Get(t,h,host,match.ID);b:=bc15Get(t,h,peer,match.ID)
   if a.Sequence!=b.Sequence||a.Sequence!=current.Sequence||a.ViewerSeat!=0||b.ViewerSeat!=1||bytes.Equal(a.PrivateView,b.PrivateView){
    t.Fatal("terminal two-account projection mismatch")
   }
   if current.WinnerSeat==nil||current.Sequence<30{t.Fatal("invalid terminal 121-point result")}
   if e:=h.Sessions.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("full journal replay",e)}
   var moves,events int
   if e:=store.DB.QueryRow("SELECT count(*) FROM bg_account_social.classic_rule_moves WHERE session_id=$1",match.ID).Scan(&moves);e!=nil{t.Fatal(e)}
   if e:=store.DB.QueryRow("SELECT count(*) FROM bg_account_social.classic_session_events WHERE session_id=$1",match.ID).Scan(&events);e!=nil{t.Fatal(e)}
   if int64(moves)!=current.Sequence-1||int64(events)!=current.Sequence{t.Fatal("missing/duplicate journal entries",moves,events,current.Sequence)}
   t.Logf("BC-1.5 two-account finished: moves=%d, winning seat=%d",moves,*current.WinnerSeat)
   return
  }
  if current.TurnSeat==nil{t.Fatalf("ended unexpectedly at step %d: %s",step,current.Status)}
  turn:=*current.TurnSeat
  actor:=host;if turn==1{actor=peer}
  view:=current
  if current.ViewerSeat!=turn{view=bc15Get(t,h,actor,match.ID)}
  if view.Sequence!=current.Sequence||view.ViewerSeat!=turn{t.Fatal("stale or foreign private turn")}
  move:=bc15Move(t,view)
  if step==0{
   wrong:=peer;if turn==1{wrong=host}
   if w:=bc06Act(t,h,wrong,match.ID,"move",current.Sequence+1,move,bc06ActionID(t));w.Code!=403{
    t.Fatal("opponent impersonated current turn",w.Code)
   }
  }
  actionID:=bc06ActionID(t)
  reply:=bc06Act(t,h,actor,match.ID,"move",current.Sequence+1,move,actionID)
  if reply.Code!=200{t.Fatalf("valid human turn %d error %d: %s",step,reply.Code,reply.Body.String())}
  var completed struct{Session ClassicSessionView}
  if e:=json.Unmarshal(reply.Body.Bytes(),&completed);e!=nil||completed.Session.Sequence!=current.Sequence+1||
    completed.Session.ViewerSeat!=turn||completed.Session.RulesHash!=adapter.hash{
   t.Fatal("invalid server-owned action response",step,e)
  }
  if step==0{
   retried:=bc06Act(t,h,actor,match.ID,"move",current.Sequence+1,move,actionID)
   if retried.Code!=200{t.Fatal("duplicate request did not recover idempotently",retried.Code)}
   var recovered struct{Session ClassicSessionView}
   if e:=json.Unmarshal(retried.Body.Bytes(),&recovered);e!=nil||recovered.Session.Sequence!=current.Sequence+1{t.Fatal("duplicate command executed twice")}
   if w:=bc06Act(t,h,actor,match.ID,"move",current.Sequence+1,move,bc06ActionID(t));w.Code!=409{
    t.Fatal("stale expected sequence accepted",w.Code)
   }
  }
  current=completed.Session
  if step==10{
   resumed,e:=NewClassicSessions(store,h.Rooms,func(game string)ClassicRule{
    if game=="cribbage"{return adapter};return nil
   })
   if e!=nil{t.Fatal(e)}
   h.Sessions=resumed
   if e=resumed.EnableBots(map[string]ClassicBotPolicies{"cribbage":NewCribbageBotPolicies()});e!=nil{t.Fatal(e)}
  }
  if step==10||step%25==0{
   a:=bc15Get(t,h,host,match.ID);b:=bc15Get(t,h,peer,match.ID)
   if a.Sequence!=b.Sequence||a.Sequence!=current.Sequence||a.ViewerSeat!=0||b.ViewerSeat!=1||
     bytes.Equal(a.PrivateView,b.PrivateView){t.Fatal("independent account checkpoint invalid",step)}
   if e:=h.Sessions.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("checkpoint replay",step,e)}
  }
 }
 t.Fatal("two independent 420ID accounts did not complete 121-point Cribbage within 400 legal moves")
}
func TestBC15QualifiedMixed420IDAndComputerSeatPersistence(t *testing.T){
 store,h,host,peer,_:=bc15Fixture(t,"198.51.100.216")
 _=store
 for _,n:=range []int{3,4}{
  room:=bc15Room(t,h,host,peer,n)
  match:=bc06Start(t,h,host,room.ID)
  if match.TurnSeat==nil{t.Fatal("no turn")}
  botMoves:=0
  for step:=0;step<80;step++{
   current:=bc15Get(t,h,host,match.ID)
   if current.Status!="active"{break}
   seat:=*current.TurnSeat
   if seat>=2{
    moved,e:=h.Sessions.RunBotTurn(context.Background(),match.ID)
    if e!=nil||!moved{t.Fatal("registered server AI did not execute",n,seat,e)}
    botMoves++
   }else{
    actor:=host;if seat==1{actor=peer}
    view:=bc15Get(t,h,actor,match.ID)
    move:=bc15Move(t,view)
    reply:=bc06Act(t,h,actor,match.ID,"move",current.Sequence+1,move,bc06ActionID(t))
    if reply.Code!=200{t.Fatalf("human/bot %d seats turn rejected: %d %s",n,reply.Code,reply.Body.String())}
   }
   if step==40{
    // Reopen both seat projections and verify the atomic journal
    // after real mixed bot/user actions.
    a:=bc15Get(t,h,host,match.ID);b:=bc15Get(t,h,peer,match.ID)
    if a.Sequence!=b.Sequence||a.ViewerSeat!=0||b.ViewerSeat!=1||bytes.Equal(a.PrivateView,b.PrivateView){
     t.Fatal("mixed game private view/reconnect failed")
    }
    if e:=h.Sessions.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("AI journal replay",e)}
   }
  }
  if botMoves<3{t.Fatal("unqualified bot activity",n,botMoves)}
  if e:=h.Sessions.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("mixed seat journal",e)}
  if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"");w.Code!=401{t.Fatal("outsider recovered private bot/human match")}
  t.Logf("BC-1.5 %d-seat separate 420ID accounts + %d qualified bot turns",n,botMoves)
 }
}
