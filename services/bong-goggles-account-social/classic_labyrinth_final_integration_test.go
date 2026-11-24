//go:build account420_integration

package social

import (
 "context"
 "encoding/json"
 "net/http"
 "testing"
)

// BC-2.7: the authoritative 325-point game is completed over the actual
// cookie-authorized HTTP boundary by two distinct 420ID account principals.
// No local scorer or test-only simulated engine can certify this result.
func TestBC27TwoHumanFull325MatchColdRecoveryAndSocialLedger(t *testing.T) {
 store,h,host,peer:=bc06Fixture(t,"198.51.100.239")
 adapter,e:=NewLabyrinthCribbageRulesAdapter()
 if e!=nil{t.Fatal(e)}
 resolver:=func(game string)ClassicRule{
  if game=="labyrinth-cribbage"{return adapter}
  return nil
 }
 h.Sessions.Rules=resolver
 h.classicLabyrinthMatchEnabled=true
 room:=bc05Create(t,h,host,"labyrinth-cribbage","public",2)
 status,ready:=bc05Change(t,h,peer,room.ID,room.Revision,1,"join",nil)
 if status!=200||ready.Status!="ready"{t.Fatal("two human ready-room admission",status)}
 match:=bc06Start(t,h,host,ready.ID)
 if match.Status!="active"||match.RulesVersion!="v2.0"||match.RulesHash!=adapter.hash{
  t.Fatal("invalid frozen starting game",match)
 }
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"");w.Code!=401{
  t.Fatal("unauthenticated client read private game",w.Code)
 }
 read:=func(who *http.Cookie)ClassicSessionView{
  t.Helper()
  result:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",who)
  if result.Code!=200{t.Fatal("verified 420ID room read failed",result.Code,result.Body.String())}
  var p struct{Session ClassicSessionView}
  if e:=json.Unmarshal(result.Body.Bytes(),&p);e!=nil{t.Fatal(e)}
  var projection map[string]json.RawMessage
  if e:=json.Unmarshal(p.Session.PrivateView,&projection);e!=nil{t.Fatal("private JSON",e)}
  for _,key:=range []string{"deck","seed","crib","engineState","allHands","opponentHand","kept","initialState"}{
   if _,ok:=projection[key];ok{t.Fatal("concealed deck leaked to seat",key)}
  }
  return p.Session
 }
 completed:=false
 cutSeen,pegSeen,showSeen,rounds:=false,false,false,map[int]bool{}
 for turn:=0;turn<2200;turn++{
  // Accelerated integration exercises hundreds of authenticated requests in
  // seconds; in real play those turns span minutes. The same BC-1.5 fixture
  // helper rolls ONLY the isolated test DB's social-write rate window forward,
  // never changing application policy, wall-clock deadlines or game journals.
  // The production limiter remains active for every HTTP request.
  if turn>0&&turn%25==0{bc15AdvanceRateWindow(t,store)}
  a:=read(host)
  if a.Status=="finished"{
   completed=true
   if a.WinnerSeat==nil||*a.WinnerSeat<0||*a.WinnerSeat>=2||
    a.TurnSeat!=nil||a.Deadline!=nil||a.FinishedReason!="completed"{
    t.Fatal("terminal match not canonical",a)
   }
   var final struct{Scores []int64 `json:"scores"`;Round int `json:"round"`}
   if e:=json.Unmarshal(a.PrivateView,&final);e!=nil||len(final.Scores)!=2||
    final.Scores[*a.WinnerSeat]<325||len(rounds)<2||!cutSeen||!pegSeen||!showSeen{
    t.Fatal("325-point game not actually played to completion",final,e,len(rounds),cutSeen,pegSeen,showSeen)
   }
   t.Logf("BC-2.7 two-human 325-point match completed in %d moves; scores=%v, winner seat=%d",turn,final.Scores,*a.WinnerSeat)
   break
  }
  if a.Status!="active"||a.TurnSeat==nil{t.Fatal("lost active match before 325",turn,a.Status)}
  actor:=host;other:=peer
  if *a.TurnSeat==1{actor=peer;other=host}
  seat:=read(actor)
  if seat.ViewerSeat!=*a.TurnSeat||seat.Sequence!=a.Sequence||seat.RulesHash!=adapter.hash{
   t.Fatal("server selected wrong human principal",turn)
  }
  var view struct{
   Phase string `json:"phase"`
   Hand []int `json:"hand"`
   PegCount int `json:"pegCount"`
   Round int `json:"round"`
   Variant string `json:"variant"`
   Scores []int64 `json:"scores"`
  }
  if e:=json.Unmarshal(seat.PrivateView,&view);e!=nil||view.Variant!="labyrinth-2p"||len(view.Scores)!=2{
   t.Fatal("invalid private 325-point phase",turn,e)
  }
  rounds[view.Round]=true
  var move map[string]any
  switch view.Phase{
  case "discard":
   if len(view.Hand)!=9{t.Fatal("wrong deal",turn,len(view.Hand))}
   move=map[string]any{"type":"discard","cards":view.Hand[:3]}
  case "cut":
   cutSeen=true;move=map[string]any{"type":"cut"}
  case "peg":
   pegSeen=true;move=map[string]any{"type":"go"}
   for _,card:=range view.Hand{
    if cribbagePips(card)+view.PegCount<=31{
     move=map[string]any{"type":"play","card":card};break
    }
   }
  default:t.Fatal("unexpected phase",turn,view.Phase)
  }
  // Starter/last-show actions are recorded by the server; a later
  // canonical frame with scores gained across multiple rounds covers show.
  if len(rounds)>1{showSeen=true}
  if turn==0{
   if w:=bc06Act(t,h,other,match.ID,"move",seat.Sequence+1,move,bc06ActionID(t));w.Code!=403{
    t.Fatal("opponent submitted another seat's move",w.Code)
   }
   if w:=bc06Act(t,h,actor,match.ID,"move",seat.Sequence+2,move,bc06ActionID(t));w.Code!=409{
    t.Fatal("future action sequence accepted",w.Code)
   }
  }
  nonce:=bc06ActionID(t)
  w:=bc06Act(t,h,actor,match.ID,"move",seat.Sequence+1,move,nonce)
  if w.Code!=200{t.Fatalf("server rejected valid authenticated move %d: HTTP %d %s",turn,w.Code,w.Body.String())}
  if turn==0{
   if retry:=bc06Act(t,h,actor,match.ID,"move",seat.Sequence+1,move,nonce);retry.Code!=200{
    t.Fatal("replayed same nonce not idempotent",retry.Code)
   }
   if replay:=bc06Act(t,h,actor,match.ID,"move",seat.Sequence+1,map[string]any{"type":"cut"},nonce);replay.Code!=409{
    t.Fatal("tampered nonce replay accepted",replay.Code)
   }
  }
  if turn==80{
   if e=h.Sessions.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("warm replay at forced restart",e)}
   restarted,e:=NewClassicSessions(store,h.Rooms,resolver)
   if e!=nil{t.Fatal("cold restart",e)}
   h.Sessions=restarted
   if x:=read(peer);x.Sequence!=seat.Sequence+1||x.RulesHash!=adapter.hash{
    t.Fatal("cold 420ID recovery lost turn",x.Sequence)
   }
   if e=restarted.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("cold rule replay mismatch",e)}
  }
 }
 if !completed{t.Fatal("2-account match never finished by canonical 325-point winner within bounded replay")}
 if e=h.Sessions.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("complete persisted rules replay",e)}
 for _,cookie:=range []*http.Cookie{host,peer}{
  history:=request(h,"GET","/v1/classic-sessions/history-labyrinth","",cookie)
  if history.Code!=200{t.Fatal("finished history",history.Code,history.Body.String())}
  var body struct{History ClassicHistory}
  if e:=json.Unmarshal(history.Body.Bytes(),&body);e!=nil{t.Fatal(e)}
  found:=false
  for _,m:=range body.History.Matches{
   if m.ID!=match.ID{continue}
   found=true
   if m.Status!="finished"||m.VariantID!="labyrinth-2p"||m.WinnerSeat==nil||
    m.Scores[*m.WinnerSeat]<325{t.Fatal("verified history did not reflect score",m)}
  }
  if !found||body.History.Stats.Completed<1{t.Fatal("completed match missing from per-seat history")}
 }
 nonce:=bc06ActionID(t)
 code,rematch:=bc16Send(t,h,peer,"/v1/classic-sessions/"+match.ID+"/rematch",nonce,nil)
 if code!=201||rematch.GameID!="labyrinth-cribbage"||rematch.Host!=memberB||
  rematch.Status!="open"||rematch.Seats[1].Controller!="invited"||
  rematch.Seats[1].Subject!=memberA{t.Fatal("completed full match rematch did not require fresh consent",code,rematch)}
 if code,again:=bc16Send(t,h,peer,"/v1/classic-sessions/"+match.ID+"/rematch",nonce,nil);code!=201||again.ID!=rematch.ID{
  t.Fatal("completed rematch duplicated under same nonce",code)
 }
 if e=h.Sessions.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("source game replay changed on rematch",e)}
}
