//go:build account420_integration

package social

import (
 "context"
 "encoding/json"
 "errors"
 "testing"
)

func TestBC34ChessHumanActionsAndRecovery(t *testing.T){
 store,h,white,black:=bc06Fixture(t,"198.51.100.203")
 a,e:=NewChessRulesAdapter();if e!=nil{t.Fatal(e)}
 h.Sessions.Rules=func(game string)ClassicRule{if game=="chess"{return a};return nil}
 room:=bc06Room(t,h,white,black)
 r:=request(h,"POST","/v1/classic-sessions",body(map[string]string{"roomId":room.ID,"clockProfile":"untimed"}),white)
 if r.Code!=201{t.Fatal("start",r.Code,r.Body.String())}
 var payload struct{Session ClassicSessionView}
 if e=json.Unmarshal(r.Body.Bytes(),&payload);e!=nil{t.Fatal(e)}
 id:=payload.Session.ID
 path:="/v1/classic-sessions/"+id+"/chess-actions"
 get:=func(cookieIsWhite bool,seq int64,uci string){
  cookie:=black;if cookieIsWhite{cookie=white}
  reply:=request(h,"GET",path,"",cookie);if reply.Code!=200{t.Fatal(reply.Code,reply.Body.String())}
  var p struct{Sequence int64;Actions []json.RawMessage}
  if e:=json.Unmarshal(reply.Body.Bytes(),&p);e!=nil||p.Sequence!=seq||len(p.Actions)==0{t.Fatal("revision/action projection",e,p)}
  found:=false
  for _,raw:=range p.Actions{var cmd chessCommand;if !strictRuleJSON(raw,&cmd){t.Fatal("invalid action",string(raw))}
   if cmd.Type=="move"{if uci==""{t.Fatal("nonturn move leaked")};if cmd.UCI==uci{found=true}}
  }
  if uci!=""&&!found{t.Fatal("expected legal move missing",uci)}
 }
 get(true,1,"e2e4");get(false,1,"")
 if r:=request(h,"GET",path,"");r.Code!=401{t.Fatal("guest actions",r.Code)}
 if r:=bc06Act(t,h,black,id,"move",2,map[string]string{"type":"move","uci":"e7e5"},bc06ActionID(t));r.Code==200{t.Fatal("wrong-turn command accepted")}
 if r:=bc06Act(t,h,white,id,"move",2,map[string]string{"type":"move","uci":"e2e5"},bc06ActionID(t));r.Code==200{t.Fatal("illegal move accepted")}
 for i,uci:=range []string{"e2e4","e7e5","g1f3","b8c6"}{
  cookie:=white;if i%2==1{cookie=black}
  r:=bc06Act(t,h,cookie,id,"move",int64(i+2),map[string]string{"type":"move","uci":uci},bc06ActionID(t))
  if r.Code!=200{t.Fatal(i,r.Code,r.Body.String())}
 }
 if _,e=h.Sessions.ChessActions(context.Background(),memberA,id,1);!errors.Is(e,ErrConflict){t.Fatal("stale revision",e)}
 get(true,5,"f1c4");get(false,5,"")
 restarted,e:=NewClassicSessions(store,h.Rooms,h.Sessions.Rules);if e!=nil{t.Fatal(e)}
 h.Sessions=restarted
 if e=restarted.VerifyRules(context.Background(),id);e!=nil{t.Fatal(e)}
 get(true,5,"f1c4")
 r=bc06Act(t,h,black,id,"move",6,map[string]string{"type":"resign"},bc06ActionID(t))
 if r.Code!=200{t.Fatal("resign",r.Code,r.Body.String())}
 r=request(h,"GET",path,"",white)
 if r.Code!=200{t.Fatal("finished",r.Code,r.Body.String())}
 var ended struct{Sequence int64;Actions []json.RawMessage}
 if e=json.Unmarshal(r.Body.Bytes(),&ended);e!=nil||ended.Sequence!=6||len(ended.Actions)!=0{t.Fatal("terminal actions",e,ended)}
}
