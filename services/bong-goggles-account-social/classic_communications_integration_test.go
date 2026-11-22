//go:build account420_integration

package social

import (
 "context"
 "encoding/json"
 "errors"
 "net/http"
 "strings"
 "testing"
)
func bc10Presence(t *testing.T,h *Handler,id string,who *http.Cookie,renew bool)(int,ClassicPresenceView){
 t.Helper()
 verb:="GET";data:=""
 if renew{verb="POST";data="{}"}
 w:=request(h,verb,"/v1/classic-rooms/"+id+"/presence",data,who)
 if w.Code!=200{return w.Code,ClassicPresenceView{}}
 var response struct{Presence ClassicPresenceView;OnChain bool;Wager bool;Rewards bool;Playable bool}
 if e:=json.Unmarshal(w.Body.Bytes(),&response);e!=nil{t.Fatal(e)}
 if response.OnChain||response.Wager||response.Rewards||response.Playable{t.Fatal("presence implied game or monetary authority")}
 return w.Code,response.Presence
}
func TestBC10ParticipantPresenceLeaseMultiDeviceRestartAndBlock(t *testing.T){
 store,h,a,b:=bc06Fixture(t,"198.51.100.130")
 room:=bc06Room(t,h,a,b)
 if w:=request(h,"POST","/v1/classic-rooms/"+room.ID+"/presence","{}",a);w.Code!=404{
  t.Fatal("presence activated implicitly",w.Code)
 }
 if e:=h.EnableClassicCommunications();e!=nil{t.Fatal(e)}
 if e:=h.EnableClassicCommunications();!errors.Is(e,ErrInvalid){t.Fatal("second activation accepted")}
 if status,v:=bc10Presence(t,h,room.ID,a,false);status!=200||v.Revision!=room.Revision||
  len(v.Seats)!=2||v.Seats[0].Online||v.Seats[1].Online{t.Fatal("unrenewed presence",status,v)}
 if status,v:=bc10Presence(t,h,room.ID,a,true);status!=200||!v.Seats[0].Online||
  v.Seats[1].Online||v.LeaseSeconds!=20{t.Fatal("host presence",status,v)}
 if status,v:=bc10Presence(t,h,room.ID,b,true);status!=200||
  !v.Seats[0].Online||!v.Seats[1].Online{t.Fatal("two-account presence",status,v)}
 if w:=request(h,"POST","/v1/classic-rooms/"+room.ID+"/presence",
  body(map[string]any{"subject":memberB,"online":true}),a);w.Code!=400{t.Fatal("spoof accepted",w.Code)}
 _,e:=store.DB.ExecContext(context.Background(),
  "UPDATE bg_account_social.classic_room_presence SET last_seen=clock_timestamp()-interval '30 seconds' WHERE room_id=$1 AND subject=$2",
  room.ID,memberA)
 if e!=nil{t.Fatal(e)}
 if status,v:=bc10Presence(t,h,room.ID,b,false);status!=200||v.Seats[0].Online||
  !v.Seats[1].Online{t.Fatal("expired lease falsely online",status,v)}
 if status,v:=bc10Presence(t,h,room.ID,a,true);status!=200||!v.Seats[0].Online{
  t.Fatal("cross-device subject lease",status,v)}
 // The presence registry persists through process restarts.
 resumed:=*h
 session,e:=NewClassicSessions(store,h.Rooms,bc06Resolver);if e!=nil{t.Fatal(e)}
 resumed.Sessions=session
 if status,v:=bc10Presence(t,&resumed,room.ID,b,false);status!=200||
  !v.Seats[0].Online||!v.Seats[1].Online{t.Fatal("presence lost over restart",status,v)}
 if e=store.Relationship(context.Background(),memberB,memberA,"block",true);e!=nil{t.Fatal(e)}
 if w:=request(h,"GET","/v1/classic-rooms/"+room.ID+"/presence","",a);w.Code!=404{
  t.Fatal("blocked host read",w.Code)}
 if w:=request(h,"POST","/v1/classic-rooms/"+room.ID+"/presence","{}",b);w.Code!=404{
  t.Fatal("blocked participant renewed",w.Code)}
 if e=store.Relationship(context.Background(),memberB,memberA,"block",false);e!=nil{t.Fatal(e)}
 if w:=request(h,"GET","/v1/classic-rooms/"+room.ID+"/presence","");w.Code!=401{t.Fatal("guest presence",w.Code)}
 if w:=request(h,"GET","/v1/classic-rooms/"+room.ID+"/presence","",&http.Cookie{
  Name:sessionCookieName,Value:"forged"});w.Code!=401{t.Fatal("forged cookie",w.Code)}
 if w:=request(h,"GET","/v1/classic-rooms/"+room.ID+"/presence?subject="+memberB,"",a);w.Code!=400{
  t.Fatal("identity query spoof",w.Code)}
 if w:=request(h,"POST","/v1/classic-rooms/"+room.ID+"/presence","{}",a);w.Code!=200||
  strings.Contains(w.Body.String(),memberA)||strings.Contains(w.Body.String(),memberB){
  t.Fatal("presence disclosed 420ID subjects",w.Code,w.Body.String())
 }
}
func TestBC10DurableEventResumeTurnAndCursorConflict(t *testing.T){
 _,h,a,b:=bc06Fixture(t,"198.51.100.131")
 room:=bc06Room(t,h,a,b)
 if e:=h.EnableClassicCommunications();e!=nil{t.Fatal(e)}
 match:=bc06Start(t,h,a,room.ID)
 start:=request(h,"GET","/v1/classic-sessions/"+match.ID+"/events?after=0","",b)
 if start.Code!=200||!strings.Contains(start.Body.String(),"\"kind\":\"started\""){t.Fatal("initial event missing",start.Code)}
 if w:=bc06Act(t,h,a,match.ID,"move",2,map[string]int{"take":1},bc06ActionID(t));w.Code!=200{
  t.Fatal("first move failed",w.Code)}
 events:=request(h,"GET","/v1/classic-sessions/"+match.ID+"/events?after=1","",b)
 if events.Code!=200||!strings.Contains(events.Body.String(),"\"sequence\":2")||
  !strings.Contains(events.Body.String(),"\"turnSeat\":1")||
  strings.Contains(events.Body.String(),"only-a")||strings.Contains(events.Body.String(),"only-b"){
  t.Fatal("private/non-monotonic event",events.Code,events.Body.String())
 }
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",b);w.Code!=200||
  !strings.Contains(w.Body.String(),"only-b")||strings.Contains(w.Body.String(),"only-a"){
  t.Fatal("private seat restart view",w.Code)}
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID+"/events?after=3","",b);w.Code!=409{
  t.Fatal("forward cursor accepted",w.Code)}
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID+"/events?after=2","",b);w.Code!=200||
  !strings.Contains(w.Body.String(),"\"events\":[]"){t.Fatal("resume cursor failed",w.Code)}
}
