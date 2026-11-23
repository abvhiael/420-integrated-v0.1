package social

import (
 "bytes"
 "context"
 "crypto/sha256"
 "database/sql"
 "encoding/json"
 "errors"
 "time"
)

// BC-1.6: a request creates a fresh *lobby*, never a match or forced seat.
// Request IDs are immutable and tied to the verified 420ID principal.
type ClassicHistoryMatch struct {
 ClassicSession
 ViewerSeat int `json:"viewerSeat"`
 Scores []int64 `json:"scores"`
}
type ClassicHistoryStats struct {
 SampleSize int `json:"sampleSize"`
 Completed int `json:"completed"`
 Wins int `json:"wins"`
 Losses int `json:"losses"`
}
type ClassicPendingInvitation struct {
 RoomID string `json:"roomId"`
 Seat int `json:"seat"`
 Inviter string `json:"inviter"`
 ExpiresAt string `json:"expiresAt"`
}
type ClassicHistory struct {
 Invitations []ClassicPendingInvitation `json:"invitations"`
 Matches []ClassicHistoryMatch `json:"matches"`
 Stats ClassicHistoryStats `json:"stats"`
}

// History is bounded, per-seat, block-filtered and uses the already-qualified
// full journal verification before extracting *public* scores. No engine
// state, private hands, seeds or journal contents leave the service.
func (s *ClassicSessions) History(ctx context.Context,viewer string)(ClassicHistory,error){
 out:=ClassicHistory{Matches:[]ClassicHistoryMatch{},Invitations:[]ClassicPendingInvitation{}}
 if !uuid.MatchString(viewer){return out,ErrInvalid}
 list,e:=s.List(ctx,viewer);if e!=nil{return out,e}
 for _,summary:=range list{
  if summary.GameID!="cribbage"{continue}
  if len(out.Matches)==20{break}
  v,e:=s.Get(ctx,viewer,summary.ID)
  if errors.Is(e,ErrNotFound){continue} // revoked/blocked between reads
  if e!=nil{return ClassicHistory{},e}
  var visible struct{Scores []int64 `json:"scores"`}
  if json.Unmarshal(v.PrivateView,&visible)!=nil||len(visible.Scores)!=v.SeatCount{
   return ClassicHistory{},ErrUnavailable
  }
  scores:=append([]int64(nil),visible.Scores...)
  for _,score:=range scores{if score<0||score>10000{return ClassicHistory{},ErrUnavailable}}
  out.Matches=append(out.Matches,ClassicHistoryMatch{ClassicSession:v.ClassicSession,ViewerSeat:v.ViewerSeat,Scores:scores})
  if v.Status=="active"{continue}
  out.Stats.SampleSize++
  if v.Status=="finished" {out.Stats.Completed++}
  if v.WinnerSeat!=nil{
   if classicTeam(v.GameID,v.SeatCount,*v.WinnerSeat)==classicTeam(v.GameID,v.SeatCount,v.ViewerSeat){
    out.Stats.Wins++
   }else{out.Stats.Losses++}
  }
 }
 // Only current unexpired 420ID invitations appear; a block revokes
 // visibility even before the invite itself can be cancelled.
 rows,e:=s.Store.DB.QueryContext(ctx,"SELECT i.room_id,i.seat_index,i.inviter,i.expires_at "+
  "FROM bg_account_social.classic_room_invites i JOIN bg_account_social.classic_rooms r ON r.id=i.room_id "+
  "WHERE i.target=$1 AND i.status='pending' AND i.expires_at>clock_timestamp() "+
  "AND r.game_id='cribbage' AND r.status IN ('open','ready') "+
  "AND NOT EXISTS(SELECT 1 FROM bg_account_social.classic_room_seats rs "+
  "JOIN bg_account_social.blocks b ON (b.blocker=$1 AND b.blocked=rs.subject) "+
  "OR (b.blocked=$1 AND b.blocker=rs.subject) "+
  "WHERE rs.room_id=i.room_id AND rs.subject IS NOT NULL) "+
  "ORDER BY i.created_at DESC,i.id DESC LIMIT 20",viewer)
 if e!=nil{return ClassicHistory{},e}
 for rows.Next(){
  var v ClassicPendingInvitation
  var expires time.Time
  if e=rows.Scan(&v.RoomID,&v.Seat,&v.Inviter,&expires);e!=nil{rows.Close();return ClassicHistory{},e}
  v.ExpiresAt=expires.UTC().Format(time.RFC3339Nano)
  out.Invitations=append(out.Invitations,v)
 }
 e=rows.Err();rows.Close();if e!=nil{return ClassicHistory{},e}
 return out,nil
}

func (s *Store) ReadyClassicMatchRequests(ctx context.Context)error{
 var ok bool
 e:=s.DB.QueryRowContext(ctx,`SELECT
 COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_match_requests'),'SELECT'),false)
 AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_match_requests'),'INSERT'),false)
 AND NOT COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_match_requests'),'UPDATE'),false)
 AND NOT COALESCE(has_any_column_privilege(current_user,to_regclass('bg_account_social.classic_match_requests'),'UPDATE'),false)
 AND NOT COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_match_requests'),'DELETE'),false)
 AND NOT COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_match_requests'),'TRUNCATE'),false)`).Scan(&ok)
 if e!=nil{return e};if !ok{return ErrUnavailable};return nil
}

func matchRequestDigest(kind,subject string)[32]byte{
 return sha256.Sum256([]byte("bc-1.6:"+kind+":"+subject))
}
func previousMatchRequest(ctx context.Context,tx *sql.Tx,viewer,requestID string,digest [32]byte)(string,error){
 var roomID string
 var saved []byte
 e:=tx.QueryRowContext(ctx,"SELECT room_id,digest FROM bg_account_social.classic_match_requests WHERE actor=$1 AND request_id=$2",viewer,requestID).Scan(&roomID,&saved)
 if errors.Is(e,sql.ErrNoRows){return "",nil}
 if e!=nil{return "",e}
 if !bytes.Equal(saved,digest[:]){return "",ErrConflict}
 return roomID,nil
}
func newMatchLobby(ctx context.Context,tx *sql.Tx,viewer,requestID string,digest [32]byte,game string,seats []ClassicSeat,source any)(string,error){
 if (game!="cribbage"&&game!="labyrinth-cribbage")||len(seats)<2||len(seats)>4||seats[0].Subject!=viewer||seats[0].Controller!="human"{return "",ErrInvalid}
 format:=""
 if game=="labyrinth-cribbage"&&len(seats)==4&&seats[0].Team!=seats[2].Team{format="individual"}
 if game=="labyrinth-cribbage"&&len(seats)==4&&format==""{format="partnerships"}
 // Match ClassicRooms.Create: serialize the active-room quota across
 // challenge, ordinary create and rematch, even on concurrent workers.
 var host string
 e:=tx.QueryRowContext(ctx,"SELECT subject FROM bg_account_social.members WHERE subject=$1 FOR UPDATE",viewer).Scan(&host)
 if errors.Is(e,sql.ErrNoRows){return "",ErrNotFound};if e!=nil{return "",e}
 var active int
 e=tx.QueryRowContext(ctx,"SELECT count(*) FROM bg_account_social.classic_rooms WHERE host=$1 AND status IN ('open','ready','in_game')",viewer).Scan(&active)
 if e!=nil{return "",e};if active>=10{return "",ErrConflict}
 id,e:=newID();if e!=nil{return "",e}
 _,e=tx.ExecContext(ctx,"INSERT INTO bg_account_social.classic_rooms(id,host,game_id,visibility,seat_count) VALUES($1,$2,$3,'private',$4)",id,viewer,game,len(seats))
 if e!=nil{return "",e}
 for index,seat:=range seats{
  if seat.Index!=index||seat.Team!=classicRoomTeam(game,len(seats),index,format){return "",ErrInvalid}
  var subject,difficulty any
  if seat.Controller=="human"&&index==0&&seat.Subject==viewer{subject=viewer
  }else if seat.Controller=="invited"&&index>0&&uuid.MatchString(seat.Subject){subject=seat.Subject
  }else if seat.Controller=="bot"&&index>0&&map[string]bool{"easy":true,"medium":true,"hard":true}[seat.Difficulty]{
   difficulty=seat.Difficulty
  }else{return "",ErrInvalid}
  _,e=tx.ExecContext(ctx,"INSERT INTO bg_account_social.classic_room_seats(room_id,seat_index,controller,subject,difficulty,team) VALUES($1,$2,$3,$4,$5,$6)",
   id,index,seat.Controller,subject,difficulty,seat.Team)
  if e!=nil{return "",e}
  if seat.Controller=="invited"{
   invite,e:=newID();if e!=nil{return "",e}
   _,e=tx.ExecContext(ctx,"INSERT INTO bg_account_social.classic_room_invites(id,room_id,seat_index,inviter,target,status) VALUES($1,$2,$3,$4,$5,'pending')",
    invite,id,index,viewer,seat.Subject)
   if e!=nil{return "",e}
  }
 }
 // A rematch with only the human host plus qualified bots has no
 // outstanding consent, so it must be immediately startable.
 pending:=false
 for _,seat:=range seats{if seat.Controller=="invited"{pending=true}}
 if !pending{
  _,e=tx.ExecContext(ctx,"UPDATE bg_account_social.classic_rooms SET status='ready',revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",id)
  if e!=nil{return "",e}
 }
 _,e=tx.ExecContext(ctx,"INSERT INTO bg_account_social.classic_match_requests(actor,request_id,room_id,digest,source_session_id) VALUES($1,$2,$3,$4,$5)",viewer,requestID,id,digest[:],source)
 if e!=nil{return "",e}
 return id,nil
}

func (s *ClassicSessions) Challenge(ctx context.Context,viewer,target,requestID string)(ClassicRoomView,error){
 var empty ClassicRoomView
 if !uuid.MatchString(viewer)||!uuid.MatchString(target)||!uuid.MatchString(requestID)||viewer==target{return empty,ErrInvalid}
 if _,e:=s.rule("cribbage","","");e!=nil{return empty,e}
 tx,e:=s.Store.DB.BeginTx(ctx,nil);if e!=nil{return empty,e};defer tx.Rollback()
 digest:=matchRequestDigest("challenge",target)
 // A reused request ID with changed intent must conflict even when the
 // newly supplied target no longer exists. Recheck after the peer lock to
 // serialize still-uncommitted concurrent first submissions.
 prior,e:=previousMatchRequest(ctx,tx,viewer,requestID,digest)
 if e!=nil{return empty,e}
 if prior!=""{_ = tx.Rollback();return s.Rooms.Get(ctx,viewer,prior)}
 if e=lockPeerPair(ctx,tx,viewer,target);e!=nil{return empty,e}
 prior,e=previousMatchRequest(ctx,tx,viewer,requestID,digest)
 if e!=nil{return empty,e}
 if prior!=""{_ = tx.Rollback();return s.Rooms.Get(ctx,viewer,prior)}
 blocked,e:=blockedBetween(ctx,tx,viewer,target)
 if e!=nil{return empty,e};if blocked{return empty,ErrForbidden}
 var mutual bool
 e=tx.QueryRowContext(ctx,"SELECT EXISTS(SELECT 1 FROM bg_account_social.follows a JOIN bg_account_social.follows b ON a.follower=b.followed AND a.followed=b.follower WHERE a.follower=$1 AND a.followed=$2)",viewer,target).Scan(&mutual)
 if e!=nil{return empty,e};if !mutual{return empty,ErrForbidden}
 seats:=[]ClassicSeat{
  {Index:0,Controller:"human",Subject:viewer,Team:0},
  {Index:1,Controller:"invited",Subject:target,Team:1},
 }
 id,e:=newMatchLobby(ctx,tx,viewer,requestID,digest,"cribbage",seats,nil)
 if e!=nil{return empty,e}
 if e=tx.Commit();e!=nil{return empty,e}
 return s.Rooms.Get(ctx,viewer,id)
}

func (s *ClassicSessions) Rematch(ctx context.Context,viewer,oldID,requestID string)(ClassicRoomView,error){
 var empty ClassicRoomView
 if !uuid.MatchString(viewer)||!uuid.MatchString(oldID)||!uuid.MatchString(requestID){return empty,ErrInvalid}
 previous,e:=s.Get(ctx,viewer,oldID)
 if e!=nil{return empty,e}
 if previous.GameID!="cribbage"&&previous.GameID!="labyrinth-cribbage"||previous.Status!="finished"&&previous.Status!="resigned"&&previous.Status!="timed_out"{
  return empty,ErrConflict
 }
 tx,e:=s.Store.DB.BeginTx(ctx,nil);if e!=nil{return empty,e};defer tx.Rollback()
 // Source room lock serializes competing participant rematch requests, and
 // retains the ordinary room -> session lock order.
 oldRoom,e:=scanClassicRoom(tx.QueryRowContext(ctx,"SELECT "+classicRoomColumns+" FROM bg_account_social.classic_rooms WHERE id=$1 FOR UPDATE",previous.RoomID))
 if e!=nil{return empty,e}
 rec,e:=scanClassicSession(tx.QueryRowContext(ctx,"SELECT "+classicSessionFields+" FROM bg_account_social.classic_sessions WHERE id=$1 FOR UPDATE",oldID))
 if e!=nil{return empty,e}
 if oldRoom.Status!="completed"||rec.Status!=previous.Status||rec.RulesHash!=previous.RulesHash||
  rec.RulesVersion!=previous.RulesVersion||rec.SeatCount!=previous.SeatCount{return empty,ErrConflict}
 if _,e=s.participant(ctx,tx,rec.RoomID,viewer);e!=nil{return empty,e}
 digest:=matchRequestDigest("rematch",oldID)
 prior,e:=previousMatchRequest(ctx,tx,viewer,requestID,digest)
 if e!=nil{return empty,e}
 if prior!=""{_ = tx.Rollback();return s.Rooms.Get(ctx,viewer,prior)}
 var already bool
 e=tx.QueryRowContext(ctx,"SELECT EXISTS(SELECT 1 FROM bg_account_social.classic_match_requests WHERE source_session_id=$1)",oldID).Scan(&already)
 if e!=nil{return empty,e};if already{return empty,ErrConflict}
 rows,e:=tx.QueryContext(ctx,"SELECT seat_index,controller,subject,difficulty,team FROM bg_account_social.classic_room_seats WHERE room_id=$1 ORDER BY seat_index",rec.RoomID)
 if e!=nil{return empty,e}
 old:=[]ClassicSeat{}
 for rows.Next(){
  var seat ClassicSeat;var sub,diff sql.NullString
  if e=rows.Scan(&seat.Index,&seat.Controller,&sub,&diff,&seat.Team);e!=nil{rows.Close();return empty,e}
  seat.Subject=sub.String;seat.Difficulty=diff.String;old=append(old,seat)
 }
 e=rows.Err();rows.Close();if e!=nil{return empty,e}
 if len(old)!=rec.SeatCount{return empty,ErrUnavailable}
 format:=""
 if rec.GameID=="labyrinth-cribbage"&&rec.SeatCount==4{
  if old[0].Team==old[2].Team{format="partnerships"}else{format="individual"}
 }
 index:=-1
 for i,seat:=range old{
  if seat.Index!=i||seat.Team!=classicRoomTeam(rec.GameID,rec.SeatCount,i,format){return empty,ErrUnavailable}
  if seat.Controller=="human"&&seat.Subject==viewer{index=i}
 }
 if index<0{return empty,ErrForbidden}
 seats:=make([]ClassicSeat,rec.SeatCount)
 human:=[]string{}
 for i:=range seats{
  orig:=old[(i+index)%len(old)]
  next:=ClassicSeat{Index:i,Team:classicRoomTeam(rec.GameID,rec.SeatCount,i,format),Difficulty:orig.Difficulty}
  if orig.Controller=="human"&&uuid.MatchString(orig.Subject){
   next.Subject=orig.Subject;next.Controller="invited"
   if i==0{next.Controller="human"}
   human=append(human,next.Subject)
  }else if orig.Controller=="bot"&&map[string]bool{"easy":true,"medium":true,"hard":true}[orig.Difficulty]{
   next.Controller="bot"
  }else{return empty,ErrUnavailable}
  seats[i]=next
 }
 // Preserve the original human roster only; a block created since the
 // first match revokes the right to send a new invitation.
 for i:=range human{for j:=0;j<i;j++{
  if e=lockPeerPair(ctx,tx,human[i],human[j]);e!=nil{return empty,e}
  blocked,err:=blockedBetween(ctx,tx,human[i],human[j])
  if err!=nil{return empty,err};if blocked{return empty,ErrForbidden}
 }}
 id,e:=newMatchLobby(ctx,tx,viewer,requestID,digest,rec.GameID,seats,oldID)
 if e!=nil{return empty,e}
 if e=tx.Commit();e!=nil{return empty,e}
 return s.Rooms.Get(ctx,viewer,id)
}
