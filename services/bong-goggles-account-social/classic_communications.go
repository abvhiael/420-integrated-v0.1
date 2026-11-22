package social

import (
 "context"
 "database/sql"
 "errors"
 "time"
)

// BC-0.10: account-bound, cross-process presence; only server-controlled
// timestamps and established human participants may renew a lease.
const classicPresenceLease=20*time.Second
type ClassicPresenceSeat struct {
 Seat int `json:"seat"`
 Online bool `json:"online"`
}
type ClassicPresenceView struct {
 RoomID string `json:"roomId"`
 Revision int64 `json:"revision"`
 Seats []ClassicPresenceSeat `json:"seats"`
 LeaseSeconds int `json:"leaseSeconds"`
}

// The opt-in is verified with a serving role, not the operator/migration role.
func (s *Store) ReadyClassicCommunications(ctx context.Context)error{
 var allowed bool
 e:=s.DB.QueryRowContext(ctx,`SELECT
 COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_room_presence'),'SELECT'),false)
 AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_room_presence'),'INSERT'),false)
 AND COALESCE(has_column_privilege(current_user,'bg_account_social.classic_room_presence','last_seen','UPDATE'),false)
 AND NOT COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_room_presence'),'DELETE'),false)
 AND NOT COALESCE(has_column_privilege(current_user,'bg_account_social.classic_room_presence','subject','UPDATE'),false)
 AND NOT COALESCE(has_column_privilege(current_user,'bg_account_social.classic_room_presence','room_id','UPDATE'),false)`).Scan(&allowed)
 if e!=nil{return e};if !allowed{return ErrUnavailable}
 return nil
}
func (h *Handler) EnableClassicCommunications()error{
 if h==nil||h.Rooms==nil||h.Sessions==nil||h.ClassicCommunicationsEnabled{return ErrInvalid}
 h.ClassicCommunicationsEnabled=true
 return nil
}
func (c *ClassicRooms) Presence(ctx context.Context,viewer,id string,renew bool)(ClassicPresenceView,error){
 var out ClassicPresenceView
 if c==nil||c.Store==nil||!uuid.MatchString(viewer)||!uuid.MatchString(id){return out,ErrInvalid}
 tx,e:=c.Store.DB.BeginTx(ctx,&sql.TxOptions{Isolation:sql.LevelRepeatableRead})
 if e!=nil{return out,e};defer tx.Rollback()
 room,e:=scanClassicRoom(tx.QueryRowContext(ctx,"SELECT "+classicRoomColumns+" FROM bg_account_social.classic_rooms WHERE id=$1",id))
 if errors.Is(e,sql.ErrNoRows){return out,ErrNotFound};if e!=nil{return out,e}
 if room.Status=="cancelled"{return out,ErrNotFound}
 // Unlike public lobby browsing, presence requires an occupied human seat.
 // Recheck blocks on every heartbeat and presence read.
 var ownSeat int
 e=tx.QueryRowContext(ctx,`SELECT own.seat_index FROM bg_account_social.classic_room_seats own
 WHERE own.room_id=$1 AND own.subject=$2 AND own.controller='human'
 AND NOT EXISTS(SELECT 1 FROM bg_account_social.classic_room_seats other
 JOIN bg_account_social.blocks blocked ON
 (blocked.blocker=$2 AND blocked.blocked=other.subject) OR
 (blocked.blocked=$2 AND blocked.blocker=other.subject)
 WHERE other.room_id=$1 AND other.subject IS NOT NULL)`,id,viewer).Scan(&ownSeat)
 if errors.Is(e,sql.ErrNoRows){return out,ErrNotFound};if e!=nil{return out,e}
 if renew{
  result,e:=tx.ExecContext(ctx,`INSERT INTO bg_account_social.classic_room_presence(room_id,subject,last_seen)
 VALUES($1,$2,clock_timestamp()) ON CONFLICT(room_id,subject)
 DO UPDATE SET last_seen=EXCLUDED.last_seen`,id,viewer)
  if e!=nil{return out,e}
  rows,e:=result.RowsAffected();if e!=nil||rows!=1{return out,ErrUnavailable}
 }
 rows,e:=tx.QueryContext(ctx,`SELECT seat.seat_index,
 COALESCE(p.last_seen>clock_timestamp()-interval '20 seconds',false)
 FROM bg_account_social.classic_room_seats seat
 LEFT JOIN bg_account_social.classic_room_presence p ON
 (p.room_id=seat.room_id AND p.subject=seat.subject)
 WHERE seat.room_id=$1 AND seat.controller='human'
 ORDER BY seat.seat_index`,id)
 if e!=nil{return out,e}
 out=ClassicPresenceView{RoomID:id,Revision:room.Revision,Seats:[]ClassicPresenceSeat{},LeaseSeconds:int(classicPresenceLease.Seconds())}
 for rows.Next(){
  var seat ClassicPresenceSeat
  if e=rows.Scan(&seat.Seat,&seat.Online);e!=nil{rows.Close();return ClassicPresenceView{},e}
  out.Seats=append(out.Seats,seat)
 }
 e=rows.Err();rows.Close();if e!=nil{return ClassicPresenceView{},e}
 if len(out.Seats)>room.SeatCount||ownSeat>=room.SeatCount{return ClassicPresenceView{},ErrUnavailable}
 if e=tx.Commit();e!=nil{return ClassicPresenceView{},e}
 return out,nil
}
