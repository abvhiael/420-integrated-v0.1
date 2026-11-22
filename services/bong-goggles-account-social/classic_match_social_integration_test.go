//go:build account420_integration

package social

import (
 "context"
 "encoding/json"
 "net/http"
 "strings"
 "testing"
)
func bc16Fixture(t *testing.T)(*Store,*Handler,*http.Cookie,*http.Cookie){
 t.Helper()
 store,h,a,b:=bc06Fixture(t,"198.51.100.245")
 adapter,e:=NewCribbageRulesAdapter();if e!=nil{t.Fatal(e)}
 h.Sessions.Rules=func(game string)ClassicRule{if game=="cribbage"{return adapter};return nil}
 // Test fixture uses a privileged schema owner; real startup performs the
 // strict runtime grant preflight before enabling these authenticated routes.
 h.classicMatchSocialEnabled=true
 if e=h.Sessions.EnableBots(map[string]ClassicBotPolicies{"cribbage":NewCribbageBotPolicies()});e!=nil{t.Fatal(e)}
 t.Cleanup(func(){
  _,_=store.DB.Exec("DELETE FROM bg_account_social.classic_match_requests WHERE actor IN ($1,$2)",memberA,memberB)
  _,_=store.DB.Exec("DELETE FROM bg_account_social.classic_room_invites WHERE room_id IN (SELECT id FROM bg_account_social.classic_rooms WHERE host=$1)",memberB)
  _,_=store.DB.Exec("DELETE FROM bg_account_social.classic_room_seats WHERE room_id IN (SELECT id FROM bg_account_social.classic_rooms WHERE host=$1)",memberB)
  _,_=store.DB.Exec("DELETE FROM bg_account_social.classic_rooms WHERE host=$1",memberB)
  _=store.Relationship(context.Background(),memberA,memberB,"follow",false)
  _=store.Relationship(context.Background(),memberB,memberA,"follow",false)
  _=store.Relationship(context.Background(),memberA,memberB,"block",false)
  _=store.Relationship(context.Background(),memberB,memberA,"block",false)
 })
 return store,h,a,b
}
func bc16Send(t *testing.T,h *Handler,cookie *http.Cookie,path,nonce string,extra map[string]any)(int,ClassicRoomView){
 t.Helper()
 data:=map[string]any{"requestId":nonce}
 for k,v:=range extra{data[k]=v}
 w:=request(h,"POST",path,body(data),cookie)
 if w.Code!=201{return w.Code,ClassicRoomView{}}
 var result struct{Room ClassicRoomView;OnChain bool;Wager bool;Rewards bool;Playable bool}
 if e:=json.Unmarshal(w.Body.Bytes(),&result);e!=nil{t.Fatal(e)}
 if result.OnChain||result.Wager||result.Rewards||result.Playable||!uuid.MatchString(result.Room.ID){t.Fatal("unsafe invitation response",w.Body.String())}
 return w.Code,result.Room
}
func TestBC16AuthenticatedChallengeHistoryAndRematch(t *testing.T){
 store,h,a,b:=bc16Fixture(t)
 ctx:=context.Background()
 route:="/v1/classic-sessions/challenge"
 h.classicMatchSocialEnabled=false
 if w:=request(h,"GET","/v1/classic-sessions/history","",a);w.Code!=404{t.Fatal("disabled history exposed",w.Code)}
 if w:=request(h,"POST",route,body(map[string]string{"target":memberB,"requestId":bc06ActionID(t)}),a);w.Code!=404{t.Fatal("disabled challenge exposed",w.Code)}
 h.classicMatchSocialEnabled=true
 nonce:=bc06ActionID(t)
 if w:=request(h,"POST",route,body(map[string]any{"requestId":nonce,"target":memberB}));w.Code!=401{t.Fatal("guest challenge",w.Code)}
 if code,_:=bc16Send(t,h,a,route,nonce,map[string]any{"target":memberB});code!=403{t.Fatal("nonfriend challenge",code)}
 for _,pair:=range [][2]string{{memberA,memberB},{memberB,memberA}}{
  if e:=store.Relationship(ctx,pair[0],pair[1],"follow",true);e!=nil{t.Fatal(e)}
 }
 if e:=store.Relationship(ctx,memberB,memberA,"block",true);e!=nil{t.Fatal(e)}
 if code,_:=bc16Send(t,h,a,route,nonce,map[string]any{"target":memberB});code!=403{t.Fatal("blocked challenge",code)}
 if e:=store.Relationship(ctx,memberB,memberA,"block",false);e!=nil{t.Fatal(e)}
 // Blocking intentionally deletes the mutual-friend edge; consent must be
 // explicitly restored by both accounts before another challenge.
 for _,pair:=range [][2]string{{memberA,memberB},{memberB,memberA}}{
  if e:=store.Relationship(ctx,pair[0],pair[1],"follow",true);e!=nil{t.Fatal(e)}
 }
 code,invited:=bc16Send(t,h,a,route,nonce,map[string]any{"target":memberB})
 if code!=201||invited.Host!=memberA||invited.Status!="open"||invited.Visibility!="private"||
  invited.Seats[1].Controller!="invited"||invited.Seats[1].Subject!=memberB||len(invited.Invites)!=1{
  t.Fatal("unverified challenge",code,invited)
 }
 if code,again:=bc16Send(t,h,a,route,nonce,map[string]any{"target":memberB});code!=201||again.ID!=invited.ID{t.Fatal("not idempotent",code)}
 if w:=request(h,"POST",route,body(map[string]any{"target":memberB,"requestId":nonce,"subject":memberB}),a);w.Code!=400{t.Fatal("injected subject",w.Code)}
 if code,_:=bc16Send(t,h,a,route,nonce,map[string]any{"target":extraThird});code!=409{t.Fatal("nonce collision bypass",code)}
 if w:=request(h,"GET","/v1/classic-rooms/"+invited.ID,"",b);w.Code!=200{t.Fatal("recipient invitation unavailable",w.Code)}
 if w:=request(h,"GET","/v1/classic-sessions/history","",b);w.Code!=200||
  !strings.Contains(w.Body.String(),invited.ID)||strings.Contains(w.Body.String(),"privateView"){
  t.Fatal("invitation inbox unsafe",w.Code,w.Body.String())
 }
 status,ready:=bc05Change(t,h,b,invited.ID,invited.Revision,1,"accept",nil)
 if status!=200||ready.Status!="ready"{t.Fatal("no explicit acceptance",status,ready)}
 game:=bc06Start(t,h,a,invited.ID)
 if code,_:=bc16Send(t,h,b,"/v1/classic-sessions/"+game.ID+"/rematch",bc06ActionID(t),nil);code!=409{t.Fatal("premature rematch",code)}
 if w:=bc06Act(t,h,a,game.ID,"resign",game.Sequence+1,nil,bc06ActionID(t));w.Code!=200{t.Fatal("resign",w.Code,w.Body.String())}
 for _,who:=range []*http.Cookie{a,b}{
  w:=request(h,"GET","/v1/classic-sessions/history","",who)
  if w.Code!=200||!strings.Contains(w.Body.String(),game.ID)||
    !strings.Contains(w.Body.String(),"scores")||
    strings.Contains(w.Body.String(),"privateView")||
    strings.Contains(w.Body.String(),"deck")||
    strings.Contains(w.Body.String(),"seed"){
   t.Fatal("history leak/unverified result",w.Code,w.Body.String())
  }
 }
 nonce2:=bc06ActionID(t);path:="/v1/classic-sessions/"+game.ID+"/rematch"
 code,rematch:=bc16Send(t,h,b,path,nonce2,nil)
 if code!=201||rematch.Host!=memberB||rematch.ID==invited.ID||rematch.Seats[0].Subject!=memberB||
  rematch.Seats[1].Subject!=memberA||rematch.Seats[1].Controller!="invited"{
  t.Fatal("no fresh rematch consent",code,rematch)
 }
 if code,retry:=bc16Send(t,h,b,path,nonce2,nil);code!=201||retry.ID!=rematch.ID{t.Fatal("rematch retry",code)}
 if code,_:=bc16Send(t,h,a,path,bc06ActionID(t),nil);code!=409{t.Fatal("second rematch duplicated source",code)}
 status,newReady:=bc05Change(t,h,a,rematch.ID,rematch.Revision,1,"accept",nil)
 if status!=200||newReady.Status!="ready"{t.Fatal("rematch acceptance",status,newReady)}
}
func TestBC16RematchReusesMixedBotSeatsWithoutConsentBypass(t *testing.T){
 _,h,a,b:=bc16Fixture(t)
 room:=bc05Create(t,h,a,"cribbage","public",4)
 code,room:=bc05Change(t,h,b,room.ID,room.Revision,1,"join",nil)
 if code!=200{t.Fatal(code)}
 for i,level:=range []string{"easy","hard"}{
  code,room=bc05Change(t,h,a,room.ID,room.Revision,i+2,"bot",map[string]any{"difficulty":level})
  if code!=200{t.Fatal(code)}
 }
 game:=bc06Start(t,h,a,room.ID)
 if w:=bc06Act(t,h,b,game.ID,"resign",game.Sequence+1,nil,bc06ActionID(t));w.Code!=200{t.Fatal(w.Code)}
 code,replay:=bc16Send(t,h,b,"/v1/classic-sessions/"+game.ID+"/rematch",bc06ActionID(t),nil)
 if code!=201||replay.SeatCount!=4||replay.Seats[0].Subject!=memberB||
  replay.Seats[1].Controller!="bot"||replay.Seats[1].Difficulty!="easy"||
  replay.Seats[2].Controller!="bot"||replay.Seats[2].Difficulty!="hard"||
  replay.Seats[3].Subject!=memberA||replay.Seats[3].Controller!="invited"{
  t.Fatal("mixed roster not preserved",code,replay)
 }
}

func TestBC16BotOnlyRematchReadyForAuthorizedHost(t *testing.T){
 _,h,a,_:=bc16Fixture(t)
 room:=bc05Create(t,h,a,"cribbage","private",2)
 code,room:=bc05Change(t,h,a,room.ID,room.Revision,1,"bot",map[string]any{"difficulty":"hard"})
 if code!=200||room.Status!="ready"{t.Fatal("original bot room not ready",code,room)}
 game:=bc06Start(t,h,a,room.ID)
 if w:=bc06Act(t,h,a,game.ID,"resign",game.Sequence+1,nil,bc06ActionID(t));w.Code!=200{
  t.Fatal("resign",w.Code)
 }
 code,rematch:=bc16Send(t,h,a,"/v1/classic-sessions/"+game.ID+"/rematch",bc06ActionID(t),nil)
 if code!=201||rematch.Status!="ready"||rematch.Seats[1].Controller!="bot"||
  rematch.Seats[1].Difficulty!="hard"||len(rematch.Invites)!=0{
  t.Fatal("bot rematch should be ready without human invitations",code,rematch)
 }
 next:=bc06Start(t,h,a,rematch.ID)
 if next.ID==game.ID||next.RulesHash!=game.RulesHash||next.Sequence!=1{
  t.Fatal("new rules-owned session not established",next)
 }
}
