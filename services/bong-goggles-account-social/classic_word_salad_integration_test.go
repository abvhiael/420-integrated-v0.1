//go:build account420_integration

package social

import (
 "context"
 "encoding/json"
 "net/http"
 "testing"
 "strings"
)

func TestBC42WordSaladDurableSession(t *testing.T){
 store,h,a,b:=bc06Fixture(t,"198.51.100.214")
 adapter,e:=NewProductionWordSaladRulesAdapter();if e!=nil{t.Fatal(e)}
 h.Sessions.Rules=func(game string)ClassicRule{if game=="scrabble"{return adapter};return nil}
 reply:=request(h,"POST","/v1/classic-rooms",body(map[string]any{"gameId":"scrabble","visibility":"public","seatCount":2,"format":"19:extra-dank:untimed"}),a)
 if reply.Code!=201{t.Fatal("create",reply.Code,reply.Body.String())}
 var room struct{Room ClassicRoomView};if e=json.Unmarshal(reply.Body.Bytes(),&room);e!=nil{t.Fatal(e)}
 if room.Room.VariantID!="19:extra-dank:untimed"{t.Fatal("variant not persisted",room)}
 if status,_:=bc05Change(t,h,b,room.Room.ID,room.Room.Revision,1,"join",nil);status!=200{t.Fatal("join",status)}
 match:=bc06Start(t,h,a,room.Room.ID)
 if match.Deadline!=nil||!strings.Contains(string(match.PrivateView),"19:extra-dank:untimed"){t.Fatal("wrong genesis",match)}
 cookies:=[]*http.Cookie{a,b};actor:=*match.TurnSeat
 if w:=bc06Act(t,h,cookies[actor],match.ID,"move",2,map[string]string{"type":"timeout"},bc06ActionID(t));w.Code!=400{t.Fatal("client timeout",w.Code,w.Body.String())}
 if w:=bc06Act(t,h,cookies[actor],match.ID,"move",2,map[string]string{"type":"pass"},bc06ActionID(t));w.Code!=200{t.Fatal("pass",w.Code,w.Body.String())}
 if w:=bc06Act(t,h,cookies[actor],match.ID,"resign",3,nil,bc06ActionID(t));w.Code!=200||!strings.Contains(w.Body.String(),"\"status\":\"finished\""){t.Fatal("nonturn resignation",w.Code,w.Body.String())}
 if e=h.Sessions.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("cold replay",e)}
 recovered,e:=NewClassicSessions(store,h.Rooms,h.Sessions.Rules);if e!=nil{t.Fatal(e)};h.Sessions=recovered
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",b);w.Code!=200{t.Fatal("restart",w.Code,w.Body.String())}
}
