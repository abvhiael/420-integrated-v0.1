//go:build account420_integration

package social

import (
 "context"
 "encoding/json"
 "net/http"
 "testing"
 "strings"
 "time"
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

func TestBC42WordSaladTimeoutAndNormalFinish(t *testing.T){
 store,h,a,b:=bc06Fixture(t,"198.51.100.215")
 adapter,e:=NewProductionWordSaladRulesAdapter();if e!=nil{t.Fatal(e)}
 h.Sessions.Rules=func(game string)ClassicRule{if game=="scrabble"{return adapter};return nil}
 reply:=request(h,"POST","/v1/classic-rooms",body(map[string]any{"gameId":"scrabble","visibility":"public","seatCount":2,"format":"17:classic-salad:live"}),a)
 if reply.Code!=201{t.Fatal("create",reply.Code,reply.Body.String())}
 var room struct{Room ClassicRoomView};if e=json.Unmarshal(reply.Body.Bytes(),&room);e!=nil{t.Fatal(e)}
 if status,_:=bc05Change(t,h,b,room.Room.ID,room.Room.Revision,1,"join",nil);status!=200{t.Fatal("join",status)}
 match:=bc06Start(t,h,a,room.Room.ID)
 if match.Deadline==nil{t.Fatal("missing live deadline")}
 ctx:=context.Background()
 // The journal binds the deadline: changing the snapshot alone is corruption.
 // Exercise the real locked transition at a controlled instant, as BC-2.5 does.
 tx,e:=store.DB.BeginTx(ctx,nil);if e!=nil{t.Fatal(e)};defer tx.Rollback()
 var roomStatus string
 if e=tx.QueryRowContext(ctx,"SELECT status FROM bg_account_social.classic_rooms WHERE id=$1 FOR UPDATE",room.Room.ID).Scan(&roomStatus);e!=nil||roomStatus!="in_game"{t.Fatal("room lock",e,roomStatus)}
 rec,e:=scanClassicSession(tx.QueryRowContext(ctx,"SELECT "+classicSessionFields+" FROM bg_account_social.classic_sessions WHERE id=$1 FOR UPDATE",match.ID));if e!=nil{t.Fatal(e)}
 if e=h.Sessions.verifyRulesTx(ctx,tx,rec,adapter);e!=nil{t.Fatal("pre-expiration journal",e)}
 instant:=rec.Deadline.Add(time.Second)
 if e=h.Sessions.expireLocked(ctx,tx,&rec,instant);e!=nil{t.Fatal("expire",e)}
 if rec.Deadline==nil||!rec.Deadline.Equal(instant.Add(120*time.Second)){t.Fatal("next deadline",rec.Deadline)}
 if e=h.Sessions.expireLocked(ctx,tx,&rec,instant);e!=nil{t.Fatal("same instant retry",e)}
 if e=tx.Commit();e!=nil{t.Fatal(e)}
 if e=h.Sessions.Expire(ctx,match.ID);e!=nil{t.Fatal("duplicate expire",e)}
 var seq int64;var turn int;var status string
 if e=store.DB.QueryRowContext(ctx,"SELECT sequence,turn_seat,status FROM bg_account_social.classic_sessions WHERE id=$1",match.ID).Scan(&seq,&turn,&status);e!=nil{t.Fatal(e)}
 if seq!=2||turn==*match.TurnSeat||status!="active"{t.Fatal("timeout did not advance exactly once",seq,turn,status)}
 if e=h.Sessions.VerifyRules(ctx,match.ID);e!=nil{t.Fatal("timeout replay",e)}
 cookies:=[]*http.Cookie{a,b}
 for i:=0;i<5;i++{
  if e=store.DB.QueryRowContext(ctx,"SELECT sequence,turn_seat FROM bg_account_social.classic_sessions WHERE id=$1",match.ID).Scan(&seq,&turn);e!=nil{t.Fatal(e)}
  if w:=bc06Act(t,h,cookies[turn],match.ID,"move",seq+1,map[string]string{"type":"pass"},bc06ActionID(t));w.Code!=200{t.Fatal("pass",w.Code,w.Body.String())}
 }
 if e=store.DB.QueryRowContext(ctx,"SELECT sequence,status FROM bg_account_social.classic_sessions WHERE id=$1",match.ID).Scan(&seq,&status);e!=nil{t.Fatal(e)}
 if seq!=7||status!="finished"{t.Fatal("scoreless finish",seq,status)}
 if e=h.Sessions.VerifyRules(ctx,match.ID);e!=nil{t.Fatal("terminal replay",e)}
 recovered,e:=NewClassicSessions(store,h.Rooms,h.Sessions.Rules);if e!=nil{t.Fatal(e)};h.Sessions=recovered
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",b);w.Code!=200||!strings.Contains(w.Body.String(),"\"status\":\"finished\""){t.Fatal("restart",w.Code,w.Body.String())}
}

func TestBC42WordSaladPersistedMoves(t *testing.T){
 store,h,a,b:=bc06Fixture(t,"198.51.100.216")
 adapter,e:=NewProductionWordSaladRulesAdapter();if e!=nil{t.Fatal(e)}
 h.Sessions.Rules=func(game string)ClassicRule{if game=="scrabble"{return adapter};return nil}
 reply:=request(h,"POST","/v1/classic-rooms",body(map[string]any{"gameId":"scrabble","visibility":"public","seatCount":2,"format":"17:classic-salad:untimed"}),a)
 if reply.Code!=201{t.Fatal("create",reply.Code,reply.Body.String())}
 room:=bc05Read(t,reply.Body.Bytes())
 if code,_:=bc05Change(t,h,b,room.ID,room.Revision,1,"join",nil);code!=200{t.Fatal("join",code)}
 match:=bc06Start(t,h,a,room.ID)
 ctx:=context.Background()
 snapshot:=func()classicSessionRecord{
  t.Helper()
  rec,err:=scanClassicSession(store.DB.QueryRowContext(ctx,"SELECT "+classicSessionFields+" FROM bg_account_social.classic_sessions WHERE id=$1",match.ID));if err!=nil{t.Fatal(err)}
  return rec
 }
 initial:=snapshot()
 frame,e:=adapter.decode(initial.State);if e!=nil{t.Fatal(e)}
 d,e:=saladDecode(frame);if e!=nil{t.Fatal(e)}
 p,_,e:=saladVariant(frame.Variant,frame.SeatCount);if e!=nil{t.Fatal(e)}
 pack:=saladPack(p);actor:=frame.Turn
 cookies:=[]*http.Cookie{a,b}
 // Search the actual dealt rack for a legal opening using the production lexicon.
 // Include three physical tiles and blank assignments; no fabricated rack or seed.
 var chosen json.RawMessage
 var search func([]map[string]any,map[int]bool,int)
 search=func(tiles []map[string]any,used map[int]bool,depth int){
  if chosen!=nil{return}
  if len(tiles)>=2{raw,_:=json.Marshal(map[string]any{"type":"place","tiles":tiles});if _,_,_,_,err:=adapter.Apply(initial.State,actor,raw);err==nil{chosen=raw;return}}
  if depth==0{return}
  for _,id:=range d.Racks[actor]{if used[id]{continue};used[id]=true
   cell:=map[string]any{"row":p.size/2,"col":p.size/2+len(tiles),"id":id}
   if pack[id]==41{for ch:='A';ch<='Z';ch++{cell["blank"]=string(ch);search(append(tiles,cell),used,depth-1);if chosen!=nil{break}}}else{search(append(tiles,cell),used,depth-1)}
   delete(used,id);if chosen!=nil{return}
  }
 }
 search(nil,map[int]bool{},4)
 if chosen==nil{t.Fatal("no legal opening in dealt rack")}
 unchanged:=func(before classicSessionRecord){t.Helper();after:=snapshot();if after.Sequence!=before.Sequence||string(after.State)!=string(before.State)||after.Status!=before.Status{t.Fatal("rejected command mutated state")}}
 if w:=bc06Act(t,h,cookies[1-actor],match.ID,"move",2,chosen,bc06ActionID(t));w.Code!=403{t.Fatal("wrong actor",w.Code,w.Body.String())};unchanged(initial)
 if w:=bc06Act(t,h,cookies[actor],match.ID,"move",2,map[string]any{"type":"place","tiles":[]any{}},bc06ActionID(t));w.Code!=400{t.Fatal("illegal placement",w.Code,w.Body.String())};unchanged(initial)
 if w:=request(h,"POST","/v1/classic-sessions/"+match.ID+"/action",body(map[string]any{"requestId":bc06ActionID(t),"action":"move","expectedSequence":2,"move":chosen}));w.Code!=401{t.Fatal("unauthenticated",w.Code)};unchanged(initial)
 nonce:=bc06ActionID(t)
 if w:=bc06Act(t,h,cookies[actor],match.ID,"move",2,chosen,nonce);w.Code!=200{t.Fatal("legal placement",w.Code,w.Body.String())}
 after:=snapshot();if after.Sequence!=2{t.Fatal("placement sequence",after.Sequence)}
 if w:=bc06Act(t,h,cookies[actor],match.ID,"move",2,chosen,nonce);w.Code!=200{t.Fatal("duplicate",w.Code)};unchanged(after)
 if w:=bc06Act(t,h,cookies[1-actor],match.ID,"move",2,map[string]string{"type":"pass"},bc06ActionID(t));w.Code!=409{t.Fatal("stale",w.Code)};unchanged(after)
 f,e:=adapter.decode(after.State);if e!=nil{t.Fatal(e)};data,e:=saladDecode(f);if e!=nil{t.Fatal(e)}
 if len(data.Board)<2{t.Fatal("placement not persisted")}
 exchange:=map[string]any{"type":"exchange","ids":[]int{data.Racks[f.Turn][0]}}
 if w:=bc06Act(t,h,cookies[f.Turn],match.ID,"move",3,exchange,bc06ActionID(t));w.Code!=200{t.Fatal("exchange",w.Code,w.Body.String())}
 after=snapshot();if after.Sequence!=3{t.Fatal("exchange sequence")}
 if e=h.Sessions.VerifyRules(ctx,match.ID);e!=nil{t.Fatal("cold replay",e)}
 recovered,e:=NewClassicSessions(store,h.Rooms,h.Sessions.Rules);if e!=nil{t.Fatal(e)};h.Sessions=recovered
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",a);w.Code!=200{t.Fatal("active restart",w.Code,w.Body.String())};unchanged(after)
 if w:=bc06Act(t,h,cookies[*after.TurnSeat],match.ID,"resign",4,nil,bc06ActionID(t));w.Code!=200{t.Fatal("finish",w.Code,w.Body.String())}
 if e=h.Sessions.VerifyRules(ctx,match.ID);e!=nil{t.Fatal("terminal replay",e)}
 terminal:=snapshot();if terminal.Status!="finished"{t.Fatal("not terminal")}
 if w:=bc06Act(t,h,a,match.ID,"move",5,map[string]string{"type":"pass"},bc06ActionID(t));w.Code!=409{t.Fatal("terminal mutation",w.Code)};unchanged(terminal)
 var events,moves int
 if e=store.DB.QueryRowContext(ctx,"SELECT (SELECT count(*) FROM bg_account_social.classic_session_events WHERE session_id=$1),(SELECT count(*) FROM bg_account_social.classic_rule_moves WHERE session_id=$1)",match.ID).Scan(&events,&moves);e!=nil||events!=4||moves!=3{t.Fatal("journal cardinality",events,moves,e)}
}
