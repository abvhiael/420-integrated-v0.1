package social

import (
 "context"
 "database/sql"
 "errors"
 "time"
)

// All lobby mutations take one room row lock plus an expected revision.
// A client cannot promote a room to active, choose teams, assign a human
// identity, or submit game turns through this interface.
func (c *ClassicRooms) Change(ctx context.Context,viewer,id string,x RoomChange)(ClassicRoomView,error){
 var empty ClassicRoomView
 if !uuid.MatchString(viewer)||!uuid.MatchString(id)||x.ExpectedRevision<1||x.Seat<0||x.Seat>3{return empty,ErrInvalid}
 tx,e:=c.Store.DB.BeginTx(ctx,nil);if e!=nil{return empty,e};defer tx.Rollback()
 r,e:=scanClassicRoom(tx.QueryRowContext(ctx,"SELECT "+classicRoomColumns+" FROM bg_account_social.classic_rooms WHERE id=$1 FOR UPDATE",id))
 if errors.Is(e,sql.ErrNoRows){return empty,ErrNotFound};if e!=nil{return empty,e}
 if (r.Status!="open"&&r.Status!="ready")||r.Revision!=x.ExpectedRevision{return empty,ErrConflict}
 if x.Seat>=r.SeatCount{return empty,ErrInvalid}
 var seat ClassicSeat;var occupant,difficulty sql.NullString
 e=tx.QueryRowContext(ctx,`SELECT seat_index,controller,subject,difficulty,team
 FROM bg_account_social.classic_room_seats WHERE room_id=$1 AND seat_index=$2 FOR UPDATE`,id,x.Seat).
  Scan(&seat.Index,&seat.Controller,&occupant,&difficulty,&seat.Team)
 if e!=nil{return empty,e}
 seat.Subject=occupant.String;seat.Difficulty=difficulty.String
 host:=r.Host==viewer
 // Uninvited people cannot learn whether a private room exists, even by
 // probing a random UUID at a mutation endpoint.
 if !host&&r.Visibility=="private"{
  var member bool
  e=tx.QueryRowContext(ctx,`SELECT EXISTS(SELECT 1 FROM bg_account_social.classic_room_seats
 WHERE room_id=$1 AND subject=$2)`,id,viewer).Scan(&member)
  if e!=nil{return empty,e};if !member{return empty,ErrNotFound}
 }
 set:=func(controller string,subject,diff any)error{
  _,err:=tx.ExecContext(ctx,`UPDATE bg_account_social.classic_room_seats SET controller=$3,subject=$4,difficulty=$5
 WHERE room_id=$1 AND seat_index=$2`,id,x.Seat,controller,subject,diff)
  return err
 }
 // Lock the actual member pair before inspecting blocks and follows, just as
 // the account games and social relationship endpoints already do.
 checkPeers:=func(target string,friendsOnly bool)error{
  if !uuid.MatchString(target)||target==r.Host{return ErrInvalid}
  rows,e:=tx.QueryContext(ctx,`SELECT subject FROM bg_account_social.classic_room_seats
 WHERE room_id=$1 AND subject IS NOT NULL AND subject<>$2 ORDER BY subject`,id,target)
  if e!=nil{return e}
  peers:=[]string{}
  for rows.Next(){var other string;if e=rows.Scan(&other);e!=nil{rows.Close();return e};peers=append(peers,other)}
  e=rows.Err();rows.Close();if e!=nil{return e}
  for _,other:=range peers{
   if e=lockPeerPair(ctx,tx,other,target);e!=nil{return e}
   blocked,e:=blockedBetween(ctx,tx,other,target)
   if e!=nil{return e};if blocked{return ErrForbidden}
  }
  if friendsOnly{
   var mutual bool
   e=tx.QueryRowContext(ctx,`SELECT EXISTS(SELECT 1 FROM bg_account_social.follows a
 JOIN bg_account_social.follows b ON a.follower=b.followed AND a.followed=b.follower
 WHERE a.follower=$1 AND a.followed=$2)`,r.Host,target).Scan(&mutual)
   if e!=nil{return e};if !mutual{return ErrForbidden}
  }
  return nil
 }
 switch x.Action{
 case "invite":
  if !host||x.Seat==0||seat.Controller!="empty"||!uuid.MatchString(x.Target)||x.Target==viewer{return empty,ErrForbidden}
  var already bool
  e=tx.QueryRowContext(ctx,"SELECT EXISTS(SELECT 1 FROM bg_account_social.classic_room_seats WHERE room_id=$1 AND subject=$2)",id,x.Target).Scan(&already)
  if e!=nil{return empty,e};if already{return empty,ErrConflict}
  if e=checkPeers(x.Target,true);e!=nil{return empty,e}
  inviteID,e:=newID();if e!=nil{return empty,e}
  _,e=tx.ExecContext(ctx,`INSERT INTO bg_account_social.classic_room_invites
 (id,room_id,seat_index,inviter,target,status) VALUES($1,$2,$3,$4,$5,'pending')`,
   inviteID,id,x.Seat,viewer,x.Target)
  if e!=nil{return empty,ErrConflict}
  if e=set("invited",x.Target,nil);e!=nil{return empty,e}
 case "accept","decline":
  if seat.Controller!="invited"||seat.Subject!=viewer{return empty,ErrNotFound}
  var state string;var expiry time.Time
  e=tx.QueryRowContext(ctx,`SELECT status,expires_at FROM bg_account_social.classic_room_invites
 WHERE room_id=$1 AND seat_index=$2 AND target=$3 AND status='pending' FOR UPDATE`,
  id,x.Seat,viewer).Scan(&state,&expiry)
  if errors.Is(e,sql.ErrNoRows){return empty,ErrConflict};if e!=nil{return empty,e}
  if !expiry.After(time.Now()){return empty,ErrConflict}
  if x.Action=="accept"{
   if e=checkPeers(viewer,true);e!=nil{return empty,e}
   if e=set("human",viewer,nil);e!=nil{return empty,e}
   state="accepted"
  }else{
   if e=set("empty",nil,nil);e!=nil{return empty,e}
   state="declined"
  }
  _,e=tx.ExecContext(ctx,`UPDATE bg_account_social.classic_room_invites SET status=$4,updated_at=clock_timestamp()
 WHERE room_id=$1 AND seat_index=$2 AND target=$3 AND status='pending'`,id,x.Seat,viewer,state)
  if e!=nil{return empty,e}
 case "cancel-invite":
  if !host||x.Seat==0||seat.Controller!="invited"{return empty,ErrForbidden}
  if e=set("empty",nil,nil);e!=nil{return empty,e}
  _,e=tx.ExecContext(ctx,`UPDATE bg_account_social.classic_room_invites SET
 status=CASE WHEN expires_at<=clock_timestamp() THEN 'expired' ELSE 'cancelled' END,
 updated_at=clock_timestamp() WHERE room_id=$1 AND seat_index=$2 AND status='pending'`,id,x.Seat)
  if e!=nil{return empty,e}
 case "join":
  if r.Visibility!="public"||x.Seat==0||seat.Controller!="empty"{return empty,ErrForbidden}
  if viewer==r.Host{return empty,ErrConflict}
  var already bool
  e=tx.QueryRowContext(ctx,"SELECT EXISTS(SELECT 1 FROM bg_account_social.classic_room_seats WHERE room_id=$1 AND subject=$2)",id,viewer).Scan(&already)
  if e!=nil{return empty,e};if already{return empty,ErrConflict}
  if e=checkPeers(viewer,false);e!=nil{return empty,e}
  if e=set("human",viewer,nil);e!=nil{return empty,e}
 case "leave":
  if x.Seat==0||seat.Controller!="human"||seat.Subject!=viewer{return empty,ErrForbidden}
  if e=set("empty",nil,nil);e!=nil{return empty,e}
 case "bot":
  if !host||x.Seat==0||(seat.Controller!="empty"&&seat.Controller!="bot")||
   !map[string]bool{"easy":true,"medium":true,"hard":true}[x.Difficulty]{return empty,ErrInvalid}
  if e=set("bot",nil,x.Difficulty);e!=nil{return empty,e}
 case "clear-bot":
  if !host||x.Seat==0||seat.Controller!="bot"{return empty,ErrForbidden}
  if e=set("empty",nil,nil);e!=nil{return empty,e}
 case "cancel-room":
  if !host||x.Seat!=0{return empty,ErrForbidden}
  _,e=tx.ExecContext(ctx,`UPDATE bg_account_social.classic_room_invites SET
 status='cancelled',updated_at=clock_timestamp() WHERE room_id=$1 AND status='pending'`,id)
  if e!=nil{return empty,e}
 default:return empty,ErrInvalid
 }
 status:="open"
 if x.Action=="cancel-room"{status="cancelled"}else{
  var ready int
  e=tx.QueryRowContext(ctx,`SELECT count(*) FROM bg_account_social.classic_room_seats
 WHERE room_id=$1 AND controller IN ('human','bot')`,id).Scan(&ready)
  if e!=nil{return empty,e}
  if ready==r.SeatCount{status="ready"}
 }
 _,e=tx.ExecContext(ctx,`UPDATE bg_account_social.classic_rooms
 SET status=$2,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1`,id,status)
 if e!=nil{return empty,e}
 if e=tx.Commit();e!=nil{return empty,e}
 if x.Action=="decline"||x.Action=="leave"{
  // The caller has just relinquished admission. Do not regrant room detail
  // access solely to make an API response; return only safe lifecycle metadata.
  r.Revision++;r.Status=status
  return ClassicRoomView{ClassicRoom:r,Seats:[]ClassicSeat{},Invites:[]ClassicInvite{}},nil
 }
 return c.Get(ctx,viewer,id)
}
