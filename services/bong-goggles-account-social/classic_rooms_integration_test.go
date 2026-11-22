//go:build account420_integration

package social

import (
 "context"
 "encoding/json"
 "strings"
 "sync"
 "testing"
 "net/http"
)

func bc05Fixture(t *testing.T)(*Store,*Handler,*http.Cookie,*http.Cookie,*http.Cookie){
 t.Helper()
 store,h,broker,a,b:=extras(t)
 rooms,e:=NewClassicRooms(store);if e!=nil{t.Fatal(e)}
 if e=h.EnableClassicRooms(rooms);e!=nil{t.Fatal(e)}
 third:=login(t,h,broker,extraThird)
 t.Cleanup(func(){
  // Isolate this test's durable rooms from the suite's shared PostgreSQL DB.
  _,_=store.DB.Exec("DELETE FROM bg_account_social.classic_room_invites WHERE room_id IN (SELECT id FROM bg_account_social.classic_rooms WHERE host=$1)",memberA)
  _,_=store.DB.Exec("DELETE FROM bg_account_social.classic_room_seats WHERE room_id IN (SELECT id FROM bg_account_social.classic_rooms WHERE host=$1)",memberA)
  _,_=store.DB.Exec("DELETE FROM bg_account_social.classic_rooms WHERE host=$1",memberA)
  for _,pair:=range [][2]string{{memberA,memberB},{memberA,extraThird},{memberB,extraThird}}{
   for _,actor:=range []string{pair[0],pair[1]}{
    target:=pair[0];if target==actor{target=pair[1]}
    _=store.Relationship(context.Background(),actor,target,"follow",false)
    _=store.Relationship(context.Background(),actor,target,"block",false)
   }
  }
 })
 return store,h,a,b,third
}
func bc05Read(t *testing.T,raw []byte)ClassicRoomView{
 t.Helper();var v struct{Room ClassicRoomView}
 if e:=json.Unmarshal(raw,&v);e!=nil{t.Fatal(e)}
 if !uuid.MatchString(v.Room.ID){t.Fatal("missing room",string(raw))}
 return v.Room
}
func bc05Create(t *testing.T,h *Handler,who *http.Cookie,game,visibility string,seats int)ClassicRoomView{
 t.Helper()
 w:=request(h,"POST","/v1/classic-rooms",body(map[string]any{"gameId":game,"visibility":visibility,"seatCount":seats}),who)
 if w.Code!=201{t.Fatal("create",w.Code,w.Body.String())}
 return bc05Read(t,w.Body.Bytes())
}
func bc05Change(t *testing.T,h *Handler,who *http.Cookie,id string,rev int64,seat int,action string,extras map[string]any)(int,ClassicRoomView){
 t.Helper()
 q:=map[string]any{"action":action,"seat":seat,"expectedRevision":rev}
 for k,v:=range extras{q[k]=v}
 w:=request(h,"POST","/v1/classic-rooms/"+id+"/change",body(q),who)
 if w.Code==200{return w.Code,bc05Read(t,w.Body.Bytes())}
 return w.Code,ClassicRoomView{}
}
func TestBC05PrivateFriendsSeatsDeclineAndCancel(t *testing.T){
 store,h,a,b,third:=bc05Fixture(t)
 ctx:=context.Background()
 if w:=request(h,"GET","/v1/classic-rooms","");w.Code!=401{t.Fatal("guest room access",w.Code)}
 if w:=request(h,"POST","/v1/classic-rooms",body(map[string]any{"gameId":"chess","visibility":"private","seatCount":2,"subject":memberB}),a);w.Code!=400{t.Fatal("subject injection",w.Code)}
 if w:=request(h,"POST","/v1/classic-rooms",body(map[string]any{"gameId":"chess","visibility":"private","seatCount":4}),a);w.Code!=400{t.Fatal("wrong game count",w.Code)}
 if w:=request(h,"POST","/v1/classic-rooms",body(map[string]any{"gameId":"roulette","visibility":"public","seatCount":2}),a);w.Code!=400{t.Fatal("wager game accepted",w.Code)}
 r:=bc05Create(t,h,a,"chess","private",2)
 if r.Revision!=1||r.Status!="open"||r.Seats[0].Subject!=memberA||r.Seats[0].Controller!="human"||r.Seats[1].Controller!="empty"{
  t.Fatal("incorrect room allocation",r)
 }
 if w:=request(h,"GET","/v1/classic-rooms/"+r.ID,"",third);w.Code!=404{t.Fatal("private room leaked to nonfriend",w.Code)}
 if status,_:=bc05Change(t,h,a,r.ID,r.Revision,1,"invite",map[string]any{"target":memberB});status!=403{t.Fatal("nonfriend invitation admitted",status)}
 if e:=store.Relationship(ctx,memberA,memberB,"follow",true);e!=nil{t.Fatal(e)}
 if status,_:=bc05Change(t,h,a,r.ID,r.Revision,1,"invite",map[string]any{"target":memberB});status!=403{t.Fatal("one-way follow admitted",status)}
 if e:=store.Relationship(ctx,memberB,memberA,"follow",true);e!=nil{t.Fatal(e)}
 if w:=request(h,"GET","/v1/classic-rooms/friends","",a);w.Code!=200||!strings.Contains(w.Body.String(),memberB){t.Fatal("mutual friend list",w.Code,w.Body.String())}
 status,invited:=bc05Change(t,h,a,r.ID,r.Revision,1,"invite",map[string]any{"target":memberB})
 if status!=200||invited.Seats[1].Controller!="invited"||len(invited.Invites)!=1{t.Fatal("friend invitation",status,invited)}
 if w:=request(h,"GET","/v1/classic-rooms/"+r.ID,"",b);w.Code!=200{t.Fatal("invited account cannot view room",w.Code)}
 if w:=request(h,"GET","/v1/classic-rooms/"+r.ID,"",third);w.Code!=404{t.Fatal("private invite leaked",w.Code)}
 if status,_:=bc05Change(t,h,b,r.ID,r.Revision,1,"accept",nil);status!=409{t.Fatal("stale invite revision accepted",status)}
 status,declined:=bc05Change(t,h,b,r.ID,invited.Revision,1,"decline",nil)
 if status!=200||len(declined.Seats)!=0||declined.Status!="open"{t.Fatal("private decline metadata",status,declined)}
 if w:=request(h,"GET","/v1/classic-rooms/"+r.ID,"",b);w.Code!=404{t.Fatal("declined account retained private access",w.Code)}
 if w:=request(h,"GET","/v1/classic-rooms/"+r.ID,"",a);w.Code!=200||!strings.Contains(w.Body.String(),`"empty"`){t.Fatal("host seat reset",w.Code)}
 if status,_:=bc05Change(t,h,b,r.ID,declined.Revision,1,"accept",nil);status!=404{t.Fatal("declined seat replay",status)}
 // Re-invitation after a decline uses a new immutable invitation record.
 status,again:=bc05Change(t,h,a,r.ID,declined.Revision,1,"invite",map[string]any{"target":memberB})
 if status!=200||again.Seats[1].Subject!=memberB{t.Fatal("reinvite",status,again)}
 status,ready:=bc05Change(t,h,b,r.ID,again.Revision,1,"accept",nil)
 if status!=200||ready.Status!="ready"||ready.Seats[1].Team!=1{t.Fatal("accepted room not ready",status,ready)}
 if status,_:=bc05Change(t,h,b,r.ID,again.Revision,1,"accept",nil);status!=409{t.Fatal("accept replay accepted",status)}
 status,left:=bc05Change(t,h,b,r.ID,ready.Revision,1,"leave",nil)
 if status!=200||left.Status!="open"{t.Fatal("leave did not reopen",status,left)}
 status,bot:=bc05Change(t,h,a,r.ID,left.Revision,1,"bot",map[string]any{"difficulty":"hard"})
 if status!=200||bot.Status!="ready"||bot.Seats[1].Controller!="bot"||bot.Seats[1].Difficulty!="hard"{
  t.Fatal("mixed lobby missing",status,bot)
 }
 if status,_:=bc05Change(t,h,b,r.ID,bot.Revision,1,"clear-bot",nil);status!=403{t.Fatal("guest removed bot",status)}
 status,empty:=bc05Change(t,h,a,r.ID,bot.Revision,1,"clear-bot",nil)
 if status!=200||empty.Status!="open"{t.Fatal("bot removal",status,empty)}
 if status,_:=bc05Change(t,h,a,r.ID,empty.Revision,1,"bot",map[string]any{"difficulty":"cheat"});status!=400{t.Fatal("invalid bot difficulty",status)}
 if status,_:=bc05Change(t,h,b,r.ID,empty.Revision,0,"cancel-room",nil);status!=404{t.Fatal("outsider cancelled private room",status)}
 status,cancel:=bc05Change(t,h,a,r.ID,empty.Revision,0,"cancel-room",nil)
 if status!=200||cancel.Status!="cancelled"{t.Fatal("room cancellation",status,cancel)}
 if status,_:=bc05Change(t,h,a,r.ID,cancel.Revision,1,"bot",map[string]any{"difficulty":"easy"});status!=409{t.Fatal("cancelled room mutated",status)}
}
func TestBC05PublicJoinTeamsBlocksAndCAS(t *testing.T){
 store,h,a,b,third:=bc05Fixture(t)
 ctx:=context.Background()
 r:=bc05Create(t,h,a,"kaiser","public",4)
 if r.Seats[0].Team!=0||r.Seats[1].Team!=1||r.Seats[2].Team!=0||r.Seats[3].Team!=1{t.Fatal("partnership team assignment",r.Seats)}
 if w:=request(h,"GET","/v1/classic-rooms","",third);w.Code!=200||!strings.Contains(w.Body.String(),r.ID){t.Fatal("public room missing",w.Code)}
 if e:=store.Relationship(ctx,memberB,memberA,"block",true);e!=nil{t.Fatal(e)}
 if status,_:=bc05Change(t,h,b,r.ID,r.Revision,1,"join",nil);status!=403{t.Fatal("blocked public join accepted",status)}
 if w:=request(h,"GET","/v1/classic-rooms/"+r.ID,"",b);w.Code!=404{t.Fatal("blocked public details leaked",w.Code)}
 if e:=store.Relationship(ctx,memberB,memberA,"block",false);e!=nil{t.Fatal(e)}
 status,one:=bc05Change(t,h,b,r.ID,r.Revision,1,"join",nil)
 if status!=200||one.Seats[1].Subject!=memberB{t.Fatal("public join",status,one)}
 if status,_:=bc05Change(t,h,third,r.ID,r.Revision,2,"join",nil);status!=409{t.Fatal("stale public join",status)}
 if status,_:=bc05Change(t,h,b,r.ID,one.Revision,2,"join",nil);status!=409{t.Fatal("double seat",status)}
 status,two:=bc05Change(t,h,third,r.ID,one.Revision,2,"join",nil)
 if status!=200||two.Seats[2].Team!=0{t.Fatal("third player team",status,two)}
 status,ready:=bc05Change(t,h,a,r.ID,two.Revision,3,"bot",map[string]any{"difficulty":"medium"})
 if status!=200||ready.Status!="ready"||ready.Seats[3].Team!=1||ready.Seats[3].Difficulty!="medium"{t.Fatal("human and bot room",status,ready)}
 if w:=request(h,"POST","/v1/classic-rooms/"+r.ID+"/change",body(map[string]any{"action":"start","expectedRevision":ready.Revision,"seat":0,"winner":memberA}),a);w.Code!=400{t.Fatal("unqualified game start accepted",w.Code)}
 if w:=request(h,"GET","/v1/classic-rooms/"+r.ID,"",b);w.Code!=200||!strings.Contains(w.Body.String(),"\"ready\""){t.Fatal("joined public room recovery",w.Code)}
}
func TestBC05ConcurrentSeatAdmissionAndRoomQuota(t *testing.T){
 _,h,a,b,third:=bc05Fixture(t)
 r:=bc05Create(t,h,a,"cribbage","public",2)
 var wg sync.WaitGroup;codes:=make(chan int,2)
 for _,cookie:=range []*http.Cookie{b,third}{
  wg.Add(1);go func(user *http.Cookie){defer wg.Done()
   reply:=request(h,"POST","/v1/classic-rooms/"+r.ID+"/change",
    body(map[string]any{"action":"join","seat":1,"expectedRevision":r.Revision}),user)
   codes<-reply.Code
  }(cookie)
 }
 wg.Wait();close(codes)
 success,conflict:=0,0
 for code:=range codes{if code==200{success++}else if code==409||code==403{conflict++}else{t.Fatal("unexpected concurrent result",code)}}
 if success!=1||conflict!=1{t.Fatal("seat admitted twice",success,conflict)}
 for i:=1;i<10;i++{bc05Create(t,h,a,"chess","private",2)}
 if w:=request(h,"POST","/v1/classic-rooms",body(map[string]any{"gameId":"chess","visibility":"private","seatCount":2}),a);w.Code!=409{t.Fatal("host room quota bypass",w.Code)}
}
