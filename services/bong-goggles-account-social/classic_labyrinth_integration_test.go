//go:build account420_integration

package social

import (
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
