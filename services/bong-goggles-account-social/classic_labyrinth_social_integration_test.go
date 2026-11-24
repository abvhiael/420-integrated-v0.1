//go:build account420_integration

package social

import (
 "context"
 "encoding/json"
 "net/http"
 "strings"
 "testing"
)

func bc26Fixture(t *testing.T)(*Store,*Handler,*http.Cookie,*http.Cookie){
 t.Helper()
 store,h,a,b:=bc06Fixture(t,"198.51.100.242")
 adapter,e:=NewLabyrinthCribbageRulesAdapter();if e!=nil{t.Fatal(e)}
 h.Sessions.Rules=func(game string)ClassicRule{
  if game=="labyrinth-cribbage"{return adapter}
  return nil
 }
 h.classicLabyrinthMatchEnabled=true
 t.Cleanup(func(){
  _,_=store.DB.Exec("DELETE FROM bg_account_social.classic_match_requests WHERE actor IN ($1,$2)",memberA,memberB)
  _=store.Relationship(context.Background(),memberA,memberB,"follow",false)
  _=store.Relationship(context.Background(),memberB,memberA,"follow",false)
  _=store.Relationship(context.Background(),memberA,memberB,"block",false)
  _=store.Relationship(context.Background(),memberB,memberA,"block",false)
 })
 return store,h,a,b
}
func TestBC26LabyrinthChallengeAndHistoryArePrivateAndGameBound(t *testing.T){
 store,h,host,friend:=bc26Fixture(t)
 history:="/v1/classic-sessions/history-labyrinth"
 challenge:="/v1/classic-sessions/challenge-labyrinth"
 if w:=request(h,"GET",history,"");w.Code!=401{t.Fatal("anonymous history",w.Code)}
 h.classicLabyrinthMatchEnabled=false
 if w:=request(h,"GET",history,"",host);w.Code!=404{t.Fatal("unqualified history enabled",w.Code)}
 if w:=request(h,"POST",challenge,body(map[string]any{"target":memberB,"requestId":bc06ActionID(t)}),host);w.Code!=404{t.Fatal("unqualified challenge enabled",w.Code)}
 h.classicLabyrinthMatchEnabled=true
 if code,_:=bc16Send(t,h,host,challenge,bc06ActionID(t),map[string]any{"target":memberB});code!=403{t.Fatal("nonfriend challenged",code)}
 for _,pair:=range [][2]string{{memberA,memberB},{memberB,memberA}}{
  if e:=store.Relationship(context.Background(),pair[0],pair[1],"follow",true);e!=nil{t.Fatal(e)}
 }
 nonce:=bc06ActionID(t)
 code,invited:=bc16Send(t,h,host,challenge,nonce,map[string]any{"target":memberB})
 if code!=201||invited.GameID!="labyrinth-cribbage"||invited.Visibility!="private"||
  invited.VariantID!="labyrinth-2p"||invited.Status!="open"||
  invited.Seats[1].Controller!="invited"||invited.Seats[1].Subject!=memberB{
  t.Fatal("invalid Labyrinth friend invitation",code,invited)
 }
 if code,again:=bc16Send(t,h,host,challenge,nonce,map[string]any{"target":memberB});code!=201||again.ID!=invited.ID{
  t.Fatal("idempotent challenge failed",code,again)
 }
 if code,_:=bc16Send(t,h,host,challenge,nonce,map[string]any{"target":extraThird});code!=409{
  t.Fatal("request ID replay changed participant",code)
 }
 inbox:=request(h,"GET",history,"",friend)
 if inbox.Code!=200||!strings.Contains(inbox.Body.String(),invited.ID)||
  strings.Contains(inbox.Body.String(),"privateView")||strings.Contains(inbox.Body.String(),"deck"){
  t.Fatal("Labyrinth inbox missing or leaking private hand",inbox.Code,inbox.Body.String())
 }
 if w:=request(h,"GET","/v1/classic-sessions/history","",friend);w.Code!=404{
  t.Fatal("Labyrinth social should not enable standard Cribbage",w.Code)
 }
 code,ready:=bc05Change(t,h,friend,invited.ID,invited.Revision,1,"accept",nil)
 if code!=200||ready.Status!="ready"{t.Fatal("explicit invitation acceptance missing",code)}
 match:=bc06Start(t,h,host,invited.ID)
 if w:=bc06Act(t,h,host,match.ID,"resign",match.Sequence+1,nil,bc06ActionID(t));w.Code!=200{
  t.Fatal("Labyrinth terminal result not committed",w.Code,w.Body.String())
 }
 for _,cookie:=range []*http.Cookie{host,friend}{
  r:=request(h,"GET",history,"",cookie)
  if r.Code!=200{t.Fatal("verified history",r.Code,r.Body.String())}
  var v struct{History ClassicHistory}
  if e:=json.Unmarshal(r.Body.Bytes(),&v);e!=nil{t.Fatal(e)}
  if len(v.History.Matches)!=1||v.History.Matches[0].ID!=match.ID||
    v.History.Matches[0].VariantID!="labyrinth-2p"||
    len(v.History.Matches[0].Scores)!=2||
    v.History.Stats.SampleSize!=1{t.Fatal("unverified history/stats",v.History)}
  if strings.Contains(r.Body.String(),"privateView")||strings.Contains(r.Body.String(),"seed")||
   strings.Contains(r.Body.String(),"opponentHand"){t.Fatal("hidden rules state leaked",r.Body.String())}
 }
 // Blocking after a match revokes social visibility and per-seat history.
 if e:=store.Relationship(context.Background(),memberA,memberB,"block",true);e!=nil{t.Fatal(e)}
 blocked:=request(h,"GET",history,"",friend)
 if blocked.Code!=200{t.Fatal("blocked history request",blocked.Code)}
 if strings.Contains(blocked.Body.String(),match.ID){t.Fatal("blocked opponent match leaked into history")}
}
func TestBC26LabyrinthHistoryStatsIndividualVsPartnership(t *testing.T){
 for _,tc:=range []struct{format,variant string;teams [4]int}{
  {"individual","labyrinth-4p-individual",[4]int{0,1,2,3}},
  {"partnerships","labyrinth-4p-partners",[4]int{0,1,0,1}},
 }{
  t.Run(tc.format,func(t *testing.T){
   for i:=0;i<4;i++{
    if got:=classicRoomTeam("labyrinth-cribbage",4,i,tc.format);got!=tc.teams[i]{
     t.Fatal("verified winner/statistics format mismatch",tc.format,i,got)
    }
   }
  })
 }
}
