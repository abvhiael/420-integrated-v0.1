//go:build account420_integration

package social

import (
 "context"
 "encoding/json"
 "testing"
)

// BC-2.5: two independent authenticated 420ID principals, fresh consent,
// durable original session, idempotent terminal command and rematch privacy.
func TestBC25LabyrinthHumanInviteResignAndRematch(t *testing.T) {
 store,h,host,peer:=bc06Fixture(t,"198.51.100.229")
 adapter,e:=NewLabyrinthCribbageRulesAdapter()
 if e!=nil{t.Fatal(e)}
 h.Sessions.Rules=func(game string) ClassicRule {
  if game=="labyrinth-cribbage"{return adapter}
  return nil
 }
 h.classicLabyrinthMatchEnabled=true
 t.Cleanup(func(){
  ctx:=context.Background()
  for _,hostID:=range []string{memberA,memberB}{
   scope:="(SELECT id FROM bg_account_social.classic_rooms WHERE host=$1)"
   sessions:="(SELECT id FROM bg_account_social.classic_sessions WHERE room_id IN "+scope+")"
   _,_=h.Rooms.Store.DB.ExecContext(ctx,"DELETE FROM bg_account_social.classic_rule_moves WHERE session_id IN "+sessions,hostID)
   _,_=h.Rooms.Store.DB.ExecContext(ctx,"DELETE FROM bg_account_social.classic_rule_genesis WHERE session_id IN "+sessions,hostID)
   _,_=h.Rooms.Store.DB.ExecContext(ctx,"DELETE FROM bg_account_social.classic_session_commands WHERE session_id IN "+sessions,hostID)
   _,_=h.Rooms.Store.DB.ExecContext(ctx,"DELETE FROM bg_account_social.classic_session_events WHERE session_id IN "+sessions,hostID)
   _,_=h.Rooms.Store.DB.ExecContext(ctx,"DELETE FROM bg_account_social.classic_match_requests WHERE actor=$1",hostID)
   _,_=h.Rooms.Store.DB.ExecContext(ctx,"DELETE FROM bg_account_social.classic_room_presence WHERE room_id IN "+scope,hostID)
   _,_=h.Rooms.Store.DB.ExecContext(ctx,"DELETE FROM bg_account_social.classic_sessions WHERE room_id IN "+scope,hostID)
   _,_=h.Rooms.Store.DB.ExecContext(ctx,"DELETE FROM bg_account_social.classic_room_invites WHERE room_id IN "+scope,hostID)
   _,_=h.Rooms.Store.DB.ExecContext(ctx,"DELETE FROM bg_account_social.classic_room_seats WHERE room_id IN "+scope,hostID)
   _,_=h.Rooms.Store.DB.ExecContext(ctx,"DELETE FROM bg_account_social.classic_rooms WHERE host=$1",hostID)
  }
  _=h.Rooms.Store.Relationship(ctx,memberA,memberB,"follow",false)
  _=h.Rooms.Store.Relationship(ctx,memberB,memberA,"follow",false)
 })
 room:=bc05Create(t,h,host,"labyrinth-cribbage","private",2)
 if room.VariantID!="labyrinth-2p"{t.Fatal("wrong immutable variant")}
 for _,pair:=range [][2]string{{memberA,memberB},{memberB,memberA}}{
  if e:=h.Rooms.Store.Relationship(context.Background(),pair[0],pair[1],"follow",true);e!=nil{t.Fatal(e)}
 }
 // Private room is invisible to non-invited peers; invite explicitly.
 if w:=request(h,"GET","/v1/classic-rooms/"+room.ID,"",peer);w.Code!=404{
  t.Fatal("private lobby exposed to non-invited peer",w.Code)
 }
 code,invited:=bc05Change(t,h,host,room.ID,room.Revision,1,"invite",map[string]any{"target":memberB})
 if code!=200||invited.Seats[1].Controller!="invited"{t.Fatal("invitation failed",code)}
 code,ready:=bc05Change(t,h,peer,room.ID,invited.Revision,1,"accept",nil)
 if code!=200||ready.Status!="ready"{t.Fatal("acceptance failed",code)}
 active:=bc06Start(t,h,host,room.ID)
 if active.RulesVersion!="v2.0"||active.Status!="active"||active.SeatCount!=2{t.Fatal("wrong Labyrinth match",active)}
 if w:=request(h,"GET","/v1/classic-sessions/"+active.ID,"",peer);w.Code!=200{
  t.Fatal("invited account cannot recover authorized game",w.Code)
 }
 if w:=request(h,"POST","/v1/classic-sessions/"+active.ID+"/rematch",body(map[string]any{"requestId":bc06ActionID(t)}),peer);w.Code!=409{
  t.Fatal("premature rematch allowed",w.Code)
 }
 nonce:=bc06ActionID(t)
 if w:=bc06Act(t,h,peer,active.ID,"resign",active.Sequence+1,nil,nonce);w.Code!=200{
  t.Fatal("authorized resignation",w.Code,w.Body.String())
 }
 if w:=bc06Act(t,h,peer,active.ID,"resign",active.Sequence+1,nil,nonce);w.Code!=200{
  t.Fatal("idempotent resignation retry",w.Code,w.Body.String())
 }
 if w:=bc06Act(t,h,host,active.ID,"resign",active.Sequence+1,nil,bc06ActionID(t));w.Code!=409{
  t.Fatal("terminal match accepted second action",w.Code)
 }
 path:="/v1/classic-sessions/"+active.ID+"/rematch"
 rematchNonce:=bc06ActionID(t)
 code,next:=bc16Send(t,h,peer,path,rematchNonce,nil)
 if code!=201||next.GameID!="labyrinth-cribbage"||next.VariantID!="labyrinth-2p"||
 next.Host!=memberB||next.Status!="open"||next.Seats[0].Subject!=memberB||
 next.Seats[1].Subject!=memberA||next.Seats[1].Controller!="invited" {
  t.Fatal("rematch missing fresh consent or variant",code,next)
 }
 if code,same:=bc16Send(t,h,peer,path,rematchNonce,nil);code!=201||same.ID!=next.ID{
  t.Fatal("idempotent rematch failed",code)
 }
 if code,_:=bc16Send(t,h,host,path,bc06ActionID(t),nil);code!=409{
  t.Fatal("duplicate rematch source admitted",code)
 }
 if w:=request(h,"GET","/v1/classic-rooms/"+next.ID,"",host);w.Code!=200{
  t.Fatal("new invitation not visible to old opponent",w.Code)
 }
 code,accepted:=bc05Change(t,h,host,next.ID,next.Revision,1,"accept",nil)
 if code!=200||accepted.Status!="ready"{t.Fatal("rematch acceptance required",code)}
 replay:=bc06Start(t,h,peer,next.ID)
 if replay.RulesHash!=adapter.hash||replay.RulesVersion!="v2.0"||
 replay.ID==active.ID||replay.Status!="active"{t.Fatal("rematch did not start fresh 325-point game",replay)}
 if e=h.Sessions.VerifyRules(context.Background(),replay.ID);e!=nil{
  t.Fatal("rematch canonical replay",e)
 }
 // Database clock, not client time, expires the turn exactly once.
 if _,e:=store.DB.Exec("UPDATE bg_account_social.classic_sessions SET turn_deadline=clock_timestamp()-interval '1 second' WHERE id=$1",replay.ID);e!=nil{t.Fatal(e)}
 first:=request(h,"GET","/v1/classic-sessions/"+replay.ID,"",host)
 if first.Code!=200{t.Fatal("authoritative expiration unavailable",first.Code,first.Body.String())}
 var terminal struct{Session ClassicSessionView}
 if e:=json.Unmarshal(first.Body.Bytes(),&terminal);e!=nil{t.Fatal(e)}
 if terminal.Session.Status!="timed_out"||terminal.Session.Sequence!=replay.Sequence+1||
   terminal.Session.TurnSeat!=nil||terminal.Session.Deadline!=nil{
  t.Fatal("timeout did not commit exactly once",terminal.Session)
 }
 again:=request(h,"GET","/v1/classic-sessions/"+replay.ID,"",peer)
 if again.Code!=200{t.Fatal("peer timeout view",again.Code)}
 var second struct{Session ClassicSessionView}
 if e:=json.Unmarshal(again.Body.Bytes(),&second);e!=nil{t.Fatal(e)}
 if second.Session.Sequence!=terminal.Session.Sequence||second.Session.Status!="timed_out"{
  t.Fatal("timeout raced or double-awarded",second.Session)
 }
 if w:=bc06Act(t,h,host,replay.ID,"resign",terminal.Session.Sequence+1,nil,bc06ActionID(t));w.Code!=409{
  t.Fatal("expired turn accepted a move or resignation",w.Code)
 }
}

// Four-player partnership and free-for-all rematches must retain their
// immutable, independently validated seat/team semantics.
func TestBC25LabyrinthTeamMapForRematch(t *testing.T){
 for _,tc:=range []struct{format string;teams [4]int}{
  {"partnerships",[4]int{0,1,0,1}},
  {"individual",[4]int{0,1,2,3}},
 }{
  for i,v:=range tc.teams{
   if got:=classicRoomTeam("labyrinth-cribbage",4,i,tc.format);got!=v{
    t.Fatal(tc.format,"wrong rematch team",i,got,v)
   }
  }
 }
}

func TestBC25RematchPreservesFourSeatPartnershipAndIndividualFormats(t *testing.T){
 cases:=[]struct{format,variant string;teams [4]int}{
  {"partnerships","labyrinth-4p-partners",[4]int{0,1,0,1}},
  {"individual","labyrinth-4p-individual",[4]int{0,1,2,3}},
 }
 for i,tc:=range cases{t.Run(tc.format,func(t *testing.T){
  store,h,host,_:=bc06Fixture(t,[]string{"198.51.100.235","198.51.100.236"}[i])
  adapter,e:=NewLabyrinthCribbageRulesAdapter();if e!=nil{t.Fatal(e)}
  h.Sessions.Rules=func(game string)ClassicRule{
   if game=="labyrinth-cribbage"{return adapter}
   return nil
  }
  h.classicLabyrinthMatchEnabled=true
  if e:=h.Sessions.EnableBots(map[string]ClassicBotPolicies{
   "labyrinth-cribbage":NewLabyrinthCribbageBotPolicies(),
  });e!=nil{t.Fatal(e)}
  t.Cleanup(func(){
   _,_=store.DB.Exec("DELETE FROM bg_account_social.classic_match_requests WHERE actor=$1",memberA)
  })
  req:=map[string]any{"gameId":"labyrinth-cribbage","visibility":"private","seatCount":4,"format":tc.format}
  created:=request(h,"POST","/v1/classic-rooms",body(req),host)
  if created.Code!=201{t.Fatal("four seat room",created.Code,created.Body.String())}
  room:=bc05Read(t,created.Body.Bytes())
  for seat:=1;seat<4;seat++{
   code,updated:=bc05Change(t,h,host,room.ID,room.Revision,seat,"bot",map[string]any{"difficulty":[]string{"easy","medium","hard"}[seat-1]})
   if code!=200{t.Fatal("bot consent",code)}
   room=updated
  }
  if room.VariantID!=tc.variant||room.Status!="ready"{t.Fatal("immutable starting team variant",room)}
  match:=bc06Start(t,h,host,room.ID)
  if w:=bc06Act(t,h,host,match.ID,"resign",match.Sequence+1,nil,bc06ActionID(t));w.Code!=200{
   t.Fatal("four seat resignation",w.Code,w.Body.String())
  }
  code,next:=bc16Send(t,h,host,"/v1/classic-sessions/"+match.ID+"/rematch",bc06ActionID(t),nil)
  if code!=201||next.GameID!="labyrinth-cribbage"||next.VariantID!=tc.variant||
    next.SeatCount!=4||next.Status!="ready"{t.Fatal("rematch variant or ready lobby",code,next)}
  for seat,expected:=range tc.teams{
   if next.Seats[seat].Team!=expected{t.Fatal("rematch teams drifted",seat)}
  }
  for seat:=1;seat<4;seat++{
   if next.Seats[seat].Controller!="bot"||next.Seats[seat].Difficulty!=room.Seats[seat].Difficulty{
    t.Fatal("rematch bot difficulty or ownership changed",seat)
   }
  }
  started:=bc06Start(t,h,host,next.ID)
  if started.ID==match.ID||started.RulesHash!=adapter.hash||started.Sequence!=1{
   t.Fatal("rematch was not a fresh authoritative 325-point session",started)
  }
 })}
}
