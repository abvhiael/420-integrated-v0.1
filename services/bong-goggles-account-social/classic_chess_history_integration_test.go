//go:build account420_integration

package social

import (
 "context"
 "encoding/json"
 "net/http"
 "strings"
 "testing"
)

func TestBC36ChessHistoryProfileStatistics(t *testing.T){
 store,h,a,b:=bc16Fixture(t)
 ctx:=context.Background()
 adapter,e:=NewChessRulesAdapter();if e!=nil{t.Fatal(e)}
 h.Sessions.Rules=func(game string)ClassicRule{if game=="chess"{return adapter};return nil}
 for _,pair:=range [][2]string{{memberA,memberB},{memberB,memberA}}{if e=store.Relationship(ctx,pair[0],pair[1],"follow",true);e!=nil{t.Fatal(e)}}
 route:="/v1/classic-sessions/history-chess"
 read:=func(c *http.Cookie)ClassicHistory{
  t.Helper()
  w:=request(h,"GET",route,"",c)
  var result struct{History ClassicHistory}
  if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&result)!=nil{t.Fatal(w.Code,w.Body.String())}
  for _,key:=range []string{"privateView","engine_state","board","seed"}{if strings.Contains(w.Body.String(),"\""+key+"\""){t.Fatal("private state leaked",key)}}
  return result.History
 }
 if w:=request(h,"GET",route,"");w.Code!=401{t.Fatal("guest history",w.Code)}
 start:=func()ClassicSessionView{
  t.Helper()
  code,room:=bc16Send(t,h,a,"/v1/classic-sessions/challenge-chess",bc06ActionID(t),map[string]any{"target":memberB})
  if code!=201{t.Fatal(code)}
  inbox:=read(b);found:=false
  for _,i:=range inbox.Invitations{if i.RoomID==room.ID{found=true}}
  if !found{t.Fatal("missing invitation")}
  code,room=bc05Change(t,h,b,room.ID,room.Revision,1,"accept",nil)
  if code!=200{t.Fatal(code)}
  w:=request(h,"POST","/v1/classic-sessions",body(map[string]string{"roomId":room.ID,"clockProfile":"untimed"}),a)
  var p struct{Session ClassicSessionView}
  if w.Code!=201||json.Unmarshal(w.Body.Bytes(),&p)!=nil{t.Fatal(w.Code,w.Body.String())}
  return p.Session
 }
 win:=start()
 if w:=bc06Act(t,h,b,win.ID,"move",2,map[string]string{"type":"resign"},bc06ActionID(t));w.Code!=200{t.Fatal(w.Code,w.Body.String())}
 draw:=start()
 if w:=bc06Act(t,h,a,draw.ID,"move",2,map[string]string{"type":"move-offer","uci":"e2e4"},bc06ActionID(t));w.Code!=200{t.Fatal(w.Code,w.Body.String())}
 if w:=bc06Act(t,h,b,draw.ID,"move",3,map[string]string{"type":"accept-draw"},bc06ActionID(t));w.Code!=200{t.Fatal(w.Code,w.Body.String())}
 active:=start()
 for i,c:=range []*http.Cookie{a,b}{
  history:=read(c);stats:=history.Stats
  if stats.Draws==nil||*stats.Draws!=1||stats.Completed!=2||stats.SampleSize!=2||stats.Wins!=1-i||stats.Losses!=i||len(history.Matches)!=3{t.Fatal("incorrect account statistics",stats,history.Matches)}
  found:=map[string]ClassicHistoryMatch{};for _,m:=range history.Matches{found[m.ID]=m}
  if found[win.ID].ChessReason==""||found[draw.ID].ChessReason==""||found[active.ID].ChessReason!=""||found[active.ID].TurnSeat==nil||*found[active.ID].TurnSeat!=0||found[active.ID].ViewerSeat!=i{t.Fatal("result/turn projection",found)}
  if len(history.Invitations)!=0{t.Fatal("accepted invite remained pending")}
 }
 if e=store.Relationship(ctx,memberA,memberB,"block",true);e!=nil{t.Fatal(e)}
 for _,c:=range []*http.Cookie{a,b}{history:=read(c);if len(history.Matches)!=0||len(history.Invitations)!=0||history.Stats.Completed!=0{t.Fatal("blocked match disclosure",history)}}
}
