//go:build account420_integration

package social

import (
 "context"
 "encoding/json"
 "net/http"
 "testing"
)

// The production resolver stays BC-1 only. This fixture explicitly installs
// BC-2.3 policies on a test service and exercises real 420ID principals,
// immutable PostgreSQL seats, server-owned bot turns, read privacy and replay.
func TestBC23SignedHumanAndOperatorBotTurnsAcrossAllFormats(t *testing.T){
 cases:=[]struct{
  variant,format string
  count int
  levels []string
 }{
  {"labyrinth-2p","",2,[]string{"","easy"}},
  {"labyrinth-3p","",3,[]string{"","","medium"}},
  {"labyrinth-4p-partners","",4,[]string{"","","hard","easy"}},
  {"labyrinth-4p-individual","individual",4,[]string{"","","medium","hard"}},
 }
 for ci,tc:=range cases{t.Run(tc.variant,func(t *testing.T){
  ip:=[]string{"198.51.100.230","198.51.100.231","198.51.100.232","198.51.100.233"}[ci]
  store,h,host,peer:=bc06Fixture(t,ip)
  adapter,e:=NewLabyrinthCribbageRulesAdapter();if e!=nil{t.Fatal(e)}
  resolver:=func(game string)ClassicRule{if game=="labyrinth-cribbage"{return adapter};return nil}
  h.Sessions.Rules=resolver
  if e=h.Sessions.EnableBots(map[string]ClassicBotPolicies{
   "labyrinth-cribbage":NewLabyrinthCribbageBotPolicies(),
  });e!=nil{t.Fatal("test-only policy admission",e)}
  req:=map[string]any{"gameId":"labyrinth-cribbage","visibility":"public","seatCount":tc.count}
  if tc.format!=""{req["format"]=tc.format}
  created:=request(h,"POST","/v1/classic-rooms",body(req),host)
  if created.Code!=201{t.Fatal("create",created.Code,created.Body.String())}
  room:=bc05Read(t,created.Body.Bytes())
  if room.VariantID!=tc.variant{t.Fatal("room does not reflect format",room.VariantID)}
  for seat:=1;seat<tc.count;seat++{
   var status int
   if tc.levels[seat]==""{
    status,room=bc05Change(t,h,peer,room.ID,room.Revision,seat,"join",nil)
   }else{
    status,room=bc05Change(t,h,host,room.ID,room.Revision,seat,"bot",map[string]any{"difficulty":tc.levels[seat]})
   }
   if status!=200{t.Fatal("room seat admission",seat,status)}
  }
  if room.Status!="ready"{t.Fatal("mixed room not ready")}
  match:=bc06Start(t,h,host,room.ID)
  if match.RulesHash!=adapter.hash||match.Sequence!=1{t.Fatal("unqualified Labyrinth session",match)}
  get:=func(who *http.Cookie)ClassicSessionView{
   response:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",who)
   if response.Code!=200{t.Fatalf("authenticated private session read failed: %d %s",response.Code,response.Body.String())}
   var payload struct{Session ClassicSessionView}
   if e:=json.Unmarshal(response.Body.Bytes(),&payload);e!=nil{t.Fatal(e)}
   var visible map[string]json.RawMessage
   if e:=json.Unmarshal(payload.Session.PrivateView,&visible);e!=nil{t.Fatal(e)}
   for _,field:=range []string{"deck","crib","seed","engineState","allHands","opponentHand"}{
    if _,ok:=visible[field];ok{t.Fatal("hidden state leaked through bot session",field)}
   }
   return payload.Session
  }
  botsSeen:=map[int]bool{};humansSeen:=map[int]bool{}
  for step:=0;step<22;step++{
   current:=get(host)
   if current.Status!="active"||current.TurnSeat==nil{t.Fatal("premature mixed match termination",step)}
   seat:=*current.TurnSeat
   before:=current.Sequence
   if tc.levels[seat]!=""{
    committed,e:=h.Sessions.RunBotTurn(context.Background(),match.ID)
    if e!=nil||!committed{t.Fatal("operator bot failed to commit one legal server move",step,e)}
    botsSeen[seat]=true
   }else{
    actor:=host;if seat==1{actor=peer}
    private:=current;if seat!=0{private=get(peer)}
    var view struct{
     Phase string `json:"phase"`
     Hand []int `json:"hand"`
     PegCount int `json:"pegCount"`
     Variant string `json:"variant"`
    }
    if json.Unmarshal(private.PrivateView,&view)!=nil||view.Variant!=tc.variant{
     t.Fatal("private 420ID view missing sealed variant")
    }
    var move map[string]any
    switch view.Phase{
    case "discard":
     need:=len(view.Hand)-6
     if need<1||need>3{t.Fatal("incorrect private discard count",need)}
     move=map[string]any{"type":"discard","cards":view.Hand[:need]}
    case "cut":move=map[string]any{"type":"cut"}
    case "peg":
     move=map[string]any{"type":"go"}
     for _,card:=range view.Hand{
      if cribbagePips(card)+view.PegCount<=31{
       move=map[string]any{"type":"play","card":card};break
      }
     }
    default:t.Fatal("unsupported turn phase",view.Phase)
    }
    result:=bc06Act(t,h,actor,match.ID,"move",before+1,move,bc06ActionID(t))
    if result.Code!=200{t.Fatal("signed human turn failed",seat,result.Code,result.Body.String())}
    humansSeen[seat]=true
   }
   after:=get(host)
   if after.Sequence!=before+1{t.Fatal("bot or human turn not serialized once",after.Sequence,before)}
  }
  if len(botsSeen)==0||len(humansSeen)==0{t.Fatal("incomplete human/bot authoritative exercise",botsSeen,humansSeen)}
  hostView:=get(host)
  if tc.count>2{
   peerView:=get(peer)
   if peerView.ViewerSeat!=1||hostView.Sequence!=peerView.Sequence||
    string(peerView.PrivateView)==string(hostView.PrivateView){
    t.Fatal("two 420ID accounts received identical or divergent game projections")
   }
  }
  if e=h.Sessions.VerifyRules(context.Background(),match.ID);e!=nil{
   t.Fatal("operator bot journal cannot replay",e)
  }
  restarted,e:=NewClassicSessions(store,h.Rooms,resolver);if e!=nil{t.Fatal(e)}
  if e=restarted.EnableBots(map[string]ClassicBotPolicies{
   "labyrinth-cribbage":NewLabyrinthCribbageBotPolicies(),
  });e!=nil{t.Fatal(e)}
  h.Sessions=restarted
  result:=get(host)
  if result.Sequence!=23||result.RulesHash!=adapter.hash{t.Fatal("cold resume lost bot actions")}
  if e=restarted.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("restart journal mismatch",e)}
 })}
}

