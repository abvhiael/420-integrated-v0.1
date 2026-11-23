//go:build account420_integration

package social

import (
 "context"
 "encoding/json"
 "net/http"
 "testing"
)

// BC-2.2: real authenticated room API + PostgreSQL-persisted immutable seat
// mapping. This intentionally does not register or activate live matches.
func TestBC22RoomFormatPersistsAcrossAPIReads(t *testing.T){
 _,h,host,_,_:=bc05Fixture(t)
 create:=func(format string)ClassicRoomView{
  req:=map[string]any{"gameId":"labyrinth-cribbage","visibility":"public","seatCount":4}
  if format!=""{req["format"]=format}
  w:=request(h,"POST","/v1/classic-rooms",body(req),host)
  if w.Code!=201{t.Fatal("create Labyrinth format",format,w.Code,w.Body.String())}
  return bc05Read(t,w.Body.Bytes())
 }
 for _,tc:=range []struct{format,id string;teams []int}{
  {"","labyrinth-4p-partners",[]int{0,1,0,1}},
  {"individual","labyrinth-4p-individual",[]int{0,1,2,3}},
 }{
  room:=create(tc.format)
  if room.VariantID!=tc.id{t.Fatal("wrong returned variant",room.VariantID)}
  for i,seat:=range room.Seats{if seat.Team!=tc.teams[i]{t.Fatal("wrong persisted team",room.ID,i,seat.Team)}}
  r:=request(h,"GET","/v1/classic-rooms/"+room.ID,"",host)
  if r.Code!=200{t.Fatal("GET persisted room",r.Code)}
  restored:=bc05Read(t,r.Body.Bytes())
  if restored.VariantID!=tc.id{t.Fatal("variant not durable",restored.VariantID)}
  for i,seat:=range restored.Seats{if seat.Team!=tc.teams[i]{t.Fatal("team changed on read",i)}}
 }
 for _,req:=range []map[string]any{
  {"gameId":"labyrinth-cribbage","visibility":"public","seatCount":4,"format":"unknown"},
  {"gameId":"labyrinth-cribbage","visibility":"public","seatCount":3,"format":"partnerships"},
  {"gameId":"cribbage","visibility":"public","seatCount":4,"format":"individual"},
  {"gameId":"russian-cribbage","visibility":"public","seatCount":2},
 }{
  r:=request(h,"POST","/v1/classic-rooms",body(req),host)
  if r.Code!=400{t.Fatal("invalid/legacy room admitted",r.Code,r.Body.String())}
 }
}

func TestBC22AuthenticatedTwoAccountEngineAndColdResume(t *testing.T){
 store,h,host,peer:=bc06Fixture(t,"198.51.100.226")
 adapter,e:=NewLabyrinthCribbageRulesAdapter();if e!=nil{t.Fatal(e)}
 resolver:=func(game string)ClassicRule{if game=="labyrinth-cribbage"{return adapter};return nil}
 // Test-only registration: production remains restricted to qualified BC-1.
 h.Sessions.Rules=resolver
 room:=bc05Create(t,h,host,"labyrinth-cribbage","public",2)
 if room.VariantID!="labyrinth-2p"{t.Fatal("wrong 2-seat format")}
 code,joined:=bc05Change(t,h,peer,room.ID,room.Revision,1,"join",nil)
 if code!=200||joined.Status!="ready"{t.Fatal("opponent admission",code)}
 match:=bc06Start(t,h,host,joined.ID)
 if match.RulesHash!=adapter.hash||match.RulesVersion!="v2.0"||
  match.Status!="active"||match.Sequence!=1{t.Fatal("wrong server identity",match)}
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"");w.Code!=401{t.Fatal("guest gained access")}
 read:=func(who *http.Cookie)ClassicSessionView{
  response:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",who)
  if response.Code!=200{t.Fatalf("authenticated read failed %d: %s",response.Code,response.Body.String())}
  var value struct{Session ClassicSessionView}
  if json.Unmarshal(response.Body.Bytes(),&value)!=nil{t.Fatal("invalid projection")}
  var fields map[string]json.RawMessage
  if e:=json.Unmarshal(value.Session.PrivateView,&fields);e!=nil{t.Fatal("invalid seat-view JSON",e)}
  for _,hidden:=range []string{"deck","seed","crib","kept","allHands","engineState","opponentHand","initialState"}{
   if _,exists:=fields[hidden];exists{t.Fatal("hidden engine field leaked",hidden)}
  }
  return value.Session
 }
 step:=0
 for ;step<16;step++{
  owner:=read(host)
  if owner.Status!="active"||owner.TurnSeat==nil{t.Fatal("match ended before server round exercised")}
  actor:=host;other:=peer
  if *owner.TurnSeat==1{actor=peer;other=host}
  current:=read(actor)
  if current.Sequence!=owner.Sequence||current.ViewerSeat!=*owner.TurnSeat{t.Fatal("server turn/view mismatch")}
  var view struct{
   Phase string `json:"phase"`
   Hand []int `json:"hand"`
   PegCount int `json:"pegCount"`
   Variant string `json:"variant"`
  }
  if e=json.Unmarshal(current.PrivateView,&view);e!=nil||view.Variant!="labyrinth-2p"{t.Fatal("incorrect private variant",e)}
  var move map[string]any
  switch view.Phase{
  case "discard":
   if len(view.Hand)!=9{t.Fatal("invalid 9-card hand",len(view.Hand))}
   move=map[string]any{"type":"discard","cards":view.Hand[:3]}
  case "cut":move=map[string]any{"type":"cut"}
  case "peg":
   move=map[string]any{"type":"go"}
   for _,card:=range view.Hand{if cribbagePips(card)+view.PegCount<=31{
    move=map[string]any{"type":"play","card":card};break
   }}
  default:t.Fatal("unexpected stage",view.Phase)
  }
  id:=bc06ActionID(t)
  if step==0{
   if w:=bc06Act(t,h,other,match.ID,"move",owner.Sequence+1,move,bc06ActionID(t));w.Code!=403{
    t.Fatal("wrong account played",w.Code)
   }
  }
  result:=bc06Act(t,h,actor,match.ID,"move",owner.Sequence+1,move,id)
  if result.Code!=200{t.Fatalf("auth move %d failed %d: %s",step,result.Code,result.Body.String())}
  if step==0{
   retry:=bc06Act(t,h,actor,match.ID,"move",owner.Sequence+1,move,id)
   if retry.Code!=200{t.Fatal("idempotent retry failed",retry.Code)}
   conflict:=bc06Act(t,h,actor,match.ID,"move",owner.Sequence+1,map[string]any{"type":"cut"},id)
   if conflict.Code!=409{t.Fatal("changed request id replay admitted",conflict.Code)}
  }
 }
 if step!=16{t.Fatal("insufficient authorized transitions")}
 if e=h.Sessions.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("database journal replay",e)}
 recovered,e:=NewClassicSessions(store,h.Rooms,resolver);if e!=nil{t.Fatal(e)}
 h.Sessions=recovered
 restored:=read(peer)
 if restored.Sequence!=int64(step+1)||restored.RulesHash!=adapter.hash||restored.RulesVersion!="v2.0"{
  t.Fatal("cold restart changed authenticated match identity",restored)
 }
 if e=recovered.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("cold recovery replay",e)}
}
