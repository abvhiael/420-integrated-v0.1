package social

import (
 "bytes"
 "context"
 "crypto/sha256"
 "database/sql"
 "encoding/json"
 "errors"
)

// BC-1.6: a request creates a fresh *lobby*, never a match or forced seat.
// Request IDs are immutable and tied to the verified 420ID principal.
type ClassicHistoryMatch struct {
 ClassicSession
 ViewerSeat int @@json:"viewerSeat"@@
 Scores []int64 @@json:"scores"@@
}
type ClassicHistoryStats struct {
 SampleSize int @@json:"sampleSize"@@
 Completed int @@json:"completed"@@
 Wins int @@json:"wins"@@
 Losses int @@json:"losses"@@
}
type ClassicHistory struct {
 Matches []ClassicHistoryMatch @@json:"matches"@@
 Stats ClassicHistoryStats @@json:"stats"@@
}

// History is bounded, per-seat, block-filtered and uses the already-qualified
// full journal verification before extracting *public* scores. No engine
// state, private hands, seeds or journal contents leave the service.
func (s *ClassicSessions) History(ctx context.Context,viewer string)(ClassicHistory,error){
 out:=ClassicHistory{Matches:[]ClassicHistoryMatch{}}
 if !uuid.MatchString(viewer){return out,ErrInvalid}
 list,e:=s.List(ctx,viewer);if e!=nil{return out,e}
 for _,summary:=range list{
  if summary.GameID!="cribbage"{continue}
  if len(out.Matches)==20{break}
  v,e:=s.Get(ctx,viewer,summary.ID)
  if errors.Is(e,ErrNotFound){continue} // revoked/blocked between reads
  if e!=nil{return ClassicHistory{},e}
  var visible struct{Scores []int64 @@json:"scores"@@}
  if json.Unmarshal(v.PrivateView,&visible)!=nil||len(visible.Scores)!=v.SeatCount{
   return ClassicHistory{},ErrUnavailable
  }
  scores:=append([]int64(nil),visible.Scores...)
  for _,score:=range scores{if score<0||score>121{return ClassicHistory{},ErrUnavailable}}
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
 return out,nil
}

func (s *Store) ReadyClassicMatchRequests(ctx context.Context)error{
 var ok bool
 e:=s.DB.QueryRowContext(ctx,`SELECT
 COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_match_requests'),'SELECT'),false)
 AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_match_requests'),'INSERT'),false)
 AND NOT COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_match_requests'),'UPDATE'),false)
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
func newMatchLobby(ctx context.Context,tx *sql.Tx,viewer,requestID string,digest [32]byte,seats []ClassicSeat,source any)(string,error){
 if len(seats)<2||len(seats)>4||seats[0].Subject!=viewer||seats[0].Controller!="human"{return "",ErrInvalid}
 var active int
 e:=tx.QueryRowContext(ctx,"SELECT count(*) FROM bg_account_social.classic_rooms WHERE host=$1 AND status IN ('open','ready','in_game')",viewer).Scan(&active)
 if e!=nil{return "",e};if active>=10{return "",ErrConflict}
 id,e:=newID();if e!=nil{return "",e}
 _,e=tx.ExecContext(ctx,"INSERT INTO bg_account_social.classic_rooms(id,host,game_id,visibility,seat_count) VALUES($1,$2,'cribbage','private',$3)",id,viewer,len(seats))
 if e!=nil{return "",e}
 for index,seat:=range seats{
  if seat.Index!=index||seat.Team!=classicTeam("cribbage",len(seats),index){return "",ErrInvalid}
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
 _,e=tx.ExecContext(ctx,"INSERT INTO bg_account_social.classic_match_requests(actor,request_id,room_id,digest,source_session_id) VALUES($1,$2,$3,$4,$5)",viewer,requestID,id,digest[:],source)
 if e!=nil{return "",e}
 return id,nil
}

func (s *ClassicSessions) Challenge(ctx context.Context,viewer,target,requestID string)(ClassicRoomView,error){
 var empty ClassicRoomView
 if !uuid.MatchString(viewer)||!uuid.MatchString(target)||!uuid.MatchString(requestID)||viewer==target{return empty,ErrInvalid}
 if _,e:=s.rule("cribbage","","");e!=nil{return empty,e}
 if e:=s.Store.ReadyClassicMatchRequests(ctx);e!=nil{return empty,e}
 tx,e:=s.Store.DB.BeginTx(ctx,nil);if e!=nil{return empty,e};defer tx.Rollback()
 if e=lockPeerPair(ctx,tx,viewer,target);e!=nil{return empty,e}
 digest:=matchRequestDigest("challenge",target)
 prior,e:=previousMatchRequest(ctx,tx,viewer,requestID,digest)
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
 id,e:=newMatchLobby(ctx,tx,viewer,requestID,digest,seats,nil)
 if e!=nil{return empty,e}
 if e=tx.Commit();e!=nil{return empty,e}
 return s.Rooms.Get(ctx,viewer,id)
}

func (s *ClassicSessions) Rematch(ctx context.Context,viewer,oldID,requestID string)(ClassicRoomView,error){
 var empty ClassicRoomView
 if !uuid.MatchString(viewer)||!uuid.MatchString(oldID)||!uuid.MatchString(requestID){return empty,ErrInvalid}
 if e:=s.Store.ReadyClassicMatchRequests(ctx);e!=nil{return empty,e}
 previous,e:=s.Get(ctx,viewer,oldID)
 if e!=nil{return empty,e}
 if previous.GameID!="cribbage"||previous.Status!="finished"&&previous.Status!="resigned"&&previous.Status!="timed_out"{
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
 index:=-1
 for i,seat:=range old{
  if seat.Index!=i||seat.Team!=classicTeam("cribbage",rec.SeatCount,i){return empty,ErrUnavailable}
  if seat.Controller=="human"&&seat.Subject==viewer{index=i}
 }
 if index<0{return empty,ErrForbidden}
 seats:=make([]ClassicSeat,rec.SeatCount)
 human:=[]string{}
 for i:=range seats{
  orig:=old[(i+index)%len(old)]
  next:=ClassicSeat{Index:i,Team:classicTeam("cribbage",rec.SeatCount,i),Difficulty:orig.Difficulty}
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
 id,e:=newMatchLobby(ctx,tx,viewer,requestID,digest,seats,oldID)
 if e!=nil{return empty,e}
 if e=tx.Commit();e!=nil{return empty,e}
 return s.Rooms.Get(ctx,viewer,id)
}
