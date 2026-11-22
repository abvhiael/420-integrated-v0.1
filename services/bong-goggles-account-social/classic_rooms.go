package social

import (
 "context"
 "database/sql"
 "errors"
 "time"
)

// BC-0.5: durable wallet-free room admission. These are not playable matches;
// BC-0.6 owns authoritative start, turns, timeouts, scoring and results.
type ClassicRooms struct{ Store *Store }
type ClassicRoom struct {
 ID string `json:"id"`
 Host string `json:"host"`
 GameID string `json:"gameId"`
 Visibility string `json:"visibility"`
 SeatCount int `json:"seatCount"`
 Status string `json:"status"`
 Revision int64 `json:"revision"`
 UpdatedAt time.Time `json:"updatedAt"`
}
type ClassicSeat struct {
 Index int `json:"index"`
 Controller string `json:"controller"`
 Subject string `json:"subject,omitempty"`
 Difficulty string `json:"difficulty,omitempty"`
 Team int `json:"team"`
}
type ClassicInvite struct {
 ID string `json:"id"`
 Seat int `json:"seat"`
 Target string `json:"target"`
 Status string `json:"status"`
 ExpiresAt time.Time `json:"expiresAt"`
}
type ClassicRoomView struct {
 ClassicRoom
 Seats []ClassicSeat `json:"seats"`
 Invites []ClassicInvite `json:"invites"`
}
type ClassicFriend struct {
 Subject string `json:"subject"`
 DisplayName string `json:"displayName"`
}
type RoomChange struct {
 Action string `json:"action"`
 ExpectedRevision int64 `json:"expectedRevision"`
 Seat int `json:"seat"`
 Target string `json:"target,omitempty"`
 Difficulty string `json:"difficulty,omitempty"`
}
var classicSeatLimits=map[string][2]int{
 "cribbage":{2,4},"russian-cribbage":{2,2},"chess":{2,2},"scrabble":{2,4},
 "checkers":{2,2},"backgammon":{2,2},"dominoes":{2,4},"crazy-eights":{2,4},
 "euchre":{4,4},"yahtzee":{2,4},"go-fish":{2,4},"hearts":{3,4},
 "go":{2,2},"mahjong":{4,4},"spades":{4,4},"500":{3,4},
 "canasta":{2,4},"tarabish":{4,4},"45s":{2,4},"120s":{4,4},
 "deux-cents":{4,4},"hola":{2,4},"rook":{4,4},"nines":{3,4},"kaiser":{4,4},
}
var classicPartners=map[string]bool{
 "cribbage":true,"euchre":true,"spades":true,"canasta":true,"tarabish":true,"500":true,
 "120s":true,"deux-cents":true,"rook":true,"kaiser":true,
}
func classicSeatsValid(game string,count int)bool{
 rangeSeats,ok:=classicSeatLimits[game]
 return ok&&count>=rangeSeats[0]&&count<=rangeSeats[1]
}
func classicTeam(game string,count,seat int)int{
 if count==4&&classicPartners[game]{return seat%2}
 return seat
}
func NewClassicRooms(store *Store)(*ClassicRooms,error){
 if store==nil||store.DB==nil{return nil,ErrInvalid}
 return &ClassicRooms{Store:store},nil
}
const classicRoomColumns="id,host,game_id,visibility,seat_count,status,revision,updated_at"
func scanClassicRoom(row interface{Scan(...any)error})(ClassicRoom,error){
 var r ClassicRoom
 e:=row.Scan(&r.ID,&r.Host,&r.GameID,&r.Visibility,&r.SeatCount,&r.Status,&r.Revision,&r.UpdatedAt)
 return r,e
}
// This opt-in is independent from the old AUTH-9 games. Runtime is allowed
// column-scoped seat/status changes but cannot alter host, rules or team.
func (s *Store) ReadyClassicRooms(ctx context.Context)error{
 var ok bool
 e:=s.DB.QueryRowContext(ctx,`SELECT
 (COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_rooms'),'SELECT'),false)
 AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_rooms'),'INSERT'),false))
 AND COALESCE(has_column_privilege(current_user,'bg_account_social.classic_rooms','status','UPDATE'),false)
 AND COALESCE(has_column_privilege(current_user,'bg_account_social.classic_rooms','revision','UPDATE'),false)
 AND COALESCE(has_column_privilege(current_user,'bg_account_social.classic_rooms','updated_at','UPDATE'),false)
 AND (COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_room_seats'),'SELECT'),false)
 AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_room_seats'),'INSERT'),false))
 AND COALESCE(has_column_privilege(current_user,'bg_account_social.classic_room_seats','controller','UPDATE'),false)
 AND COALESCE(has_column_privilege(current_user,'bg_account_social.classic_room_seats','subject','UPDATE'),false)
 AND COALESCE(has_column_privilege(current_user,'bg_account_social.classic_room_seats','difficulty','UPDATE'),false)
 AND (COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_room_invites'),'SELECT'),false)
 AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_room_invites'),'INSERT'),false))
 AND COALESCE(has_column_privilege(current_user,'bg_account_social.classic_room_invites','status','UPDATE'),false)
 AND COALESCE(has_column_privilege(current_user,'bg_account_social.classic_room_invites','updated_at','UPDATE'),false)
 AND NOT COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_rooms'),'DELETE'),false)
 AND NOT COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_room_seats'),'DELETE'),false)
 AND NOT COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_room_invites'),'DELETE'),false)
 AND NOT COALESCE(has_column_privilege(current_user,'bg_account_social.classic_rooms','game_id','UPDATE'),false)
 AND NOT COALESCE(has_column_privilege(current_user,'bg_account_social.classic_rooms','host','UPDATE'),false)
 AND NOT COALESCE(has_column_privilege(current_user,'bg_account_social.classic_rooms','visibility','UPDATE'),false)
 AND NOT COALESCE(has_column_privilege(current_user,'bg_account_social.classic_room_seats','team','UPDATE'),false)
 AND NOT COALESCE(has_column_privilege(current_user,'bg_account_social.classic_room_invites','target','UPDATE'),false)`).Scan(&ok)
 if e!=nil{return e};if !ok{return ErrUnavailable}
 return nil
}
func (c *ClassicRooms) Create(ctx context.Context,viewer,game,visibility string,count int)(ClassicRoomView,error){
 var empty ClassicRoomView
 if !uuid.MatchString(viewer)||!classicSeatsValid(game,count)||(visibility!="private"&&visibility!="public"){return empty,ErrInvalid}
 id,e:=newID();if e!=nil{return empty,e}
 tx,e:=c.Store.DB.BeginTx(ctx,nil);if e!=nil{return empty,e};defer tx.Rollback()
 // A single host member lock serializes the 10-active-room quota.
 var host string
 e=tx.QueryRowContext(ctx,"SELECT subject FROM bg_account_social.members WHERE subject=$1 FOR UPDATE",viewer).Scan(&host)
 if errors.Is(e,sql.ErrNoRows){return empty,ErrNotFound};if e!=nil{return empty,e}
 var countActive int
 e=tx.QueryRowContext(ctx,"SELECT count(*) FROM bg_account_social.classic_rooms WHERE host=$1 AND status<>'cancelled'",viewer).Scan(&countActive)
 if e!=nil{return empty,e};if countActive>=10{return empty,ErrConflict}
 _,e=tx.ExecContext(ctx,"INSERT INTO bg_account_social.classic_rooms (id,host,game_id,visibility,seat_count) VALUES($1,$2,$3,$4,$5)",id,viewer,game,visibility,count)
 if e!=nil{return empty,e}
 for seat:=0;seat<count;seat++{
  controller:="empty";var occupant any
  if seat==0{controller="human";occupant=viewer}
  _,e=tx.ExecContext(ctx,"INSERT INTO bg_account_social.classic_room_seats (room_id,seat_index,controller,subject,team) VALUES($1,$2,$3,$4,$5)",id,seat,controller,occupant,classicTeam(game,count,seat))
  if e!=nil{return empty,e}
 }
 if e=tx.Commit();e!=nil{return empty,e}
 return c.Get(ctx,viewer,id)
}
// Identifiers are random; privacy still requires server-side authorization.
// Every account caller has a freshly checked 420ID server cookie in ServeHTTP.
func (c *ClassicRooms) visible(ctx context.Context,viewer string,room ClassicRoom)(bool,error){
 if viewer==room.Host{return true,nil}
 var allowed bool
 e:=c.Store.DB.QueryRowContext(ctx,`SELECT
 ($1='public' OR EXISTS (SELECT 1 FROM bg_account_social.classic_room_seats
 WHERE room_id=$2 AND subject=$3) OR EXISTS (SELECT 1 FROM bg_account_social.classic_room_invites
 WHERE room_id=$2 AND target=$3 AND status='pending' AND expires_at>clock_timestamp()))
 AND NOT EXISTS (SELECT 1 FROM bg_account_social.classic_room_seats s
 JOIN bg_account_social.blocks b ON
  (b.blocker=$3 AND b.blocked=s.subject) OR (b.blocked=$3 AND b.blocker=s.subject)
 WHERE s.room_id=$2 AND s.subject IS NOT NULL)`,room.Visibility,room.ID,viewer).Scan(&allowed)
 return allowed,e
}
func (c *ClassicRooms) List(ctx context.Context,viewer string)([]ClassicRoom,error){
 if !uuid.MatchString(viewer){return nil,ErrInvalid}
 rows,e:=c.Store.DB.QueryContext(ctx,`SELECT `+classicRoomColumns+` FROM bg_account_social.classic_rooms r
 WHERE (r.status<>'cancelled' OR r.host=$1) AND (r.visibility='public' OR r.host=$1
 OR EXISTS(SELECT 1 FROM bg_account_social.classic_room_seats s WHERE s.room_id=r.id AND s.subject=$1)
 OR EXISTS(SELECT 1 FROM bg_account_social.classic_room_invites i WHERE i.room_id=r.id AND i.target=$1 AND i.status='pending' AND i.expires_at>clock_timestamp()))
 AND NOT EXISTS (SELECT 1 FROM bg_account_social.classic_room_seats s
 JOIN bg_account_social.blocks b ON
 (b.blocker=$1 AND b.blocked=s.subject) OR (b.blocked=$1 AND b.blocker=s.subject)
 WHERE s.room_id=r.id AND s.subject IS NOT NULL)
 ORDER BY r.updated_at DESC,r.id DESC LIMIT 50`,viewer)
 if e!=nil{return nil,e};defer rows.Close()
 out:=[]ClassicRoom{}
 for rows.Next(){room,e:=scanClassicRoom(rows);if e!=nil{return nil,e};out=append(out,room)}
 return out,rows.Err()
}
func (c *ClassicRooms) Friends(ctx context.Context,viewer string)([]ClassicFriend,error){
 if !uuid.MatchString(viewer){return nil,ErrInvalid}
 rows,e:=c.Store.DB.QueryContext(ctx,`SELECT m.subject,m.display_name
 FROM bg_account_social.follows a JOIN bg_account_social.follows b
 ON a.follower=b.followed AND a.followed=b.follower
 JOIN bg_account_social.members m ON m.subject=a.followed
 WHERE a.follower=$1 AND NOT EXISTS (SELECT 1 FROM bg_account_social.blocks bl
 WHERE (bl.blocker=$1 AND bl.blocked=m.subject) OR (bl.blocked=$1 AND bl.blocker=m.subject))
 ORDER BY m.display_name,m.subject LIMIT 100`,viewer)
 if e!=nil{return nil,e};defer rows.Close()
 out:=[]ClassicFriend{}
 for rows.Next(){var f ClassicFriend;if e=rows.Scan(&f.Subject,&f.DisplayName);e!=nil{return nil,e};out=append(out,f)}
 return out,rows.Err()
}
func (c *ClassicRooms) Get(ctx context.Context,viewer,id string)(ClassicRoomView,error){
 var out ClassicRoomView
 if !uuid.MatchString(viewer)||!uuid.MatchString(id){return out,ErrInvalid}
 room,e:=scanClassicRoom(c.Store.DB.QueryRowContext(ctx,"SELECT "+classicRoomColumns+" FROM bg_account_social.classic_rooms WHERE id=$1",id))
 if errors.Is(e,sql.ErrNoRows){return out,ErrNotFound};if e!=nil{return out,e}
 allowed,e:=c.visible(ctx,viewer,room);if e!=nil{return out,e};if !allowed{return out,ErrNotFound}
 out.ClassicRoom=room;out.Seats=[]ClassicSeat{};out.Invites=[]ClassicInvite{}
 rows,e:=c.Store.DB.QueryContext(ctx,"SELECT seat_index,controller,subject,difficulty,team FROM bg_account_social.classic_room_seats WHERE room_id=$1 ORDER BY seat_index",id)
 if e!=nil{return ClassicRoomView{},e}
 for rows.Next(){
  var seat ClassicSeat;var subject,difficulty sql.NullString
  if e=rows.Scan(&seat.Index,&seat.Controller,&subject,&difficulty,&seat.Team);e!=nil{rows.Close();return ClassicRoomView{},e}
  seat.Subject=subject.String;seat.Difficulty=difficulty.String
  if seat.Controller=="invited"&&viewer!=room.Host&&viewer!=seat.Subject{seat.Subject=""}
  out.Seats=append(out.Seats,seat)
 }
 e=rows.Err();rows.Close();if e!=nil{return ClassicRoomView{},e}
 inv,e:=c.Store.DB.QueryContext(ctx,`SELECT id,seat_index,target,
 CASE WHEN status='pending' AND expires_at<=clock_timestamp() THEN 'expired' ELSE status END,expires_at
 FROM bg_account_social.classic_room_invites WHERE room_id=$1 AND (target=$2 OR $2=$3)
 ORDER BY created_at DESC LIMIT 30`,id,viewer,room.Host)
 if e!=nil{return ClassicRoomView{},e}
 for inv.Next(){var item ClassicInvite
  if e=inv.Scan(&item.ID,&item.Seat,&item.Target,&item.Status,&item.ExpiresAt);e!=nil{inv.Close();return ClassicRoomView{},e}
  out.Invites=append(out.Invites,item)
 }
 e=inv.Err();inv.Close();if e!=nil{return ClassicRoomView{},e}
 return out,nil
}
