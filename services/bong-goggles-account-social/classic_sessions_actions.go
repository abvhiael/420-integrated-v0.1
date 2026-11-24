package social

import (
 "context"
 "crypto/sha256"
 "database/sql"
 "encoding/json"
 "errors"
 "time"
)

// Public journal contains ONLY lifecycle/turn metadata. Opaque game state and
// per-seat cards remain in the protected snapshot and the qualified adapter.
func classicPublicState(r classicSessionRecord)json.RawMessage{
 b,_:=json.Marshal(map[string]any{
 "status":r.Status,"turnSeat":r.TurnSeat,"deadline":r.Deadline,
 "winnerSeat":r.WinnerSeat,"finishedReason":r.FinishedReason})
 return b
}
func (s *ClassicSessions) publish(ctx context.Context,tx *sql.Tx,r classicSessionRecord,kind string,actor any)error{
 _,e:=tx.ExecContext(ctx,"INSERT INTO bg_account_social.classic_session_events "+
  "(session_id,sequence,kind,actor_seat,public_state) VALUES($1,$2,$3,$4,$5)",
  r.ID,r.Sequence,kind,actor,string(classicPublicState(r)))
 return e
}
func (s *ClassicSessions) Start(ctx context.Context,viewer,roomID string)(ClassicSessionView,error){
 return s.startWithClock(ctx,viewer,roomID,"")
}
func (s *ClassicSessions) startWithClock(ctx context.Context,viewer,roomID,profile string)(ClassicSessionView,error){
 var empty ClassicSessionView
 if !uuid.MatchString(viewer)||!uuid.MatchString(roomID){return empty,ErrInvalid}
 tx,e:=s.Store.DB.BeginTx(ctx,nil);if e!=nil{return empty,e};defer tx.Rollback()
 room,e:=scanClassicRoom(tx.QueryRowContext(ctx,"SELECT "+classicRoomColumns+
  " FROM bg_account_social.classic_rooms WHERE id=$1 FOR UPDATE",roomID))
 if errors.Is(e,sql.ErrNoRows){return empty,ErrNotFound};if e!=nil{return empty,e}
 if viewer!=room.Host{return empty,ErrNotFound}
 if room.Status=="in_game"||room.Status=="completed"{
  var existing string
  e=tx.QueryRowContext(ctx,"SELECT id FROM bg_account_social.classic_sessions WHERE room_id=$1",roomID).Scan(&existing)
  if e==nil{_ = tx.Rollback();return s.Get(ctx,viewer,existing)}
  return empty,ErrConflict
 }
 if room.Status!="ready"{return empty,ErrConflict}
 rule,e:=s.rule(room.GameID,"","");if e!=nil{return empty,e}
 rows,e:=tx.QueryContext(ctx,"SELECT seat_index,controller,subject,difficulty,team FROM "+
  "bg_account_social.classic_room_seats WHERE room_id=$1 ORDER BY seat_index",roomID)
 if e!=nil{return empty,e}
 seats:=[]ClassicSeat{}
 for rows.Next(){
  var seat ClassicSeat;var subj,diff sql.NullString
  if e=rows.Scan(&seat.Index,&seat.Controller,&subj,&diff,&seat.Team);e!=nil{rows.Close();return empty,e}
  seat.Subject=subj.String;seat.Difficulty=diff.String;seats=append(seats,seat)
 }
 e=rows.Err();rows.Close();if e!=nil{return empty,e}
 if len(seats)!=room.SeatCount{return empty,ErrConflict}
 // Only a qualified versioned rules engine and registered three-level AI
 // may start bot-filled rooms. Human identities and block checks remain
 // enforced for every human pair; bots have no 420ID identity.
 for i,seat:=range seats{
  if seat.Index!=i{return empty,ErrUnavailable}
  if seat.Controller=="bot"{
   if seat.Subject!=""{return empty,ErrUnavailable}
   if _,ok:=rule.(*RulesAdapter);!ok{return empty,ErrUnavailable}
   if _,e=s.botPolicy(room.GameID,seat.Difficulty);e!=nil{return empty,ErrUnavailable}
   continue
  }
  if seat.Controller!="human"||!uuid.MatchString(seat.Subject){return empty,ErrUnavailable}
  for j:=0;j<i;j++{
   if seats[j].Controller!="human"{continue}
   if e=lockPeerPair(ctx,tx,seats[j].Subject,seat.Subject);e!=nil{return empty,e}
   blocked,err:=blockedBetween(ctx,tx,seats[j].Subject,seat.Subject)
   if err!=nil{return empty,err};if blocked{return empty,ErrForbidden}
  }
 }
 var state json.RawMessage
 var first int
 var seed [32]byte
 adapter,versioned:=rule.(*RulesAdapter)
 if versioned{
  seed,e=deterministicSeed();if e!=nil{return empty,e}
  state,first,e=adapter.InitialWithSeed(seed,room,seats)
 }else{state,first,e=rule.Initial(room,seats)}
 if e!=nil||!validRuleState(state)||first<0||first>=room.SeatCount{return empty,ErrUnavailable}
 version,hash:=rule.Identity()
 id,e:=newID();if e!=nil{return empty,e}
 var now time.Time
 if e=tx.QueryRowContext(ctx,"SELECT clock_timestamp()").Scan(&now);e!=nil{return empty,e}
 var deadline *time.Time
 if profile!=""&&!isClassicChess(rule){return empty,ErrInvalid}
 if !isClassicChess(rule){d:=now.Add(classicTurnSeconds*time.Second);deadline=&d
 }else if profile!=""&&profile!="untimed"{
  clock,err:=chessClockForProfile(profile);if err!=nil{return empty,err}
  timing:=chessTimedState{Profile:profile,Clock:clock,At:now.UnixMilli()}
  state,err=chessFrameWithTime(adapter,state,&timing);if err!=nil{return empty,err}
  deadline=timing.deadline(first)
 }
 _,e=tx.ExecContext(ctx,"INSERT INTO bg_account_social.classic_sessions "+
  "(id,room_id,game_id,seat_count,status,rules_version,rules_hash,engine_state,sequence,turn_seat,turn_deadline) "+
  "VALUES($1,$2,$3,$4,'active',$5,$6,$7,1,$8,$9)",
  id,roomID,room.GameID,room.SeatCount,version,hash,string(state),first,deadline)
 if e!=nil{return empty,e}
 if versioned{
  if e=s.saveRuleGenesis(ctx,tx,id,adapter,seed,state);e!=nil{return empty,e}
 }
 _,e=tx.ExecContext(ctx,"UPDATE bg_account_social.classic_rooms SET status='in_game',"+
  "revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",roomID)
 if e!=nil{return empty,e}
 rec:=classicSessionRecord{ClassicSession:ClassicSession{
  ID:id,RoomID:roomID,GameID:room.GameID,SeatCount:room.SeatCount,Status:"active",
  RulesVersion:version,RulesHash:hash,Sequence:1,TurnSeat:&first,Deadline:deadline},State:state}
 if e=s.publish(ctx,tx,rec,"started",nil);e!=nil{return empty,e}
 if e=tx.Commit();e!=nil{return empty,e}
 return s.Get(ctx,viewer,id)
}
// Expire is safe across processes and restarts. Every caller first locks the
// room and then the session; committed expiration advances exactly once.
func (s *ClassicSessions) Expire(ctx context.Context,id string)error{
 if !uuid.MatchString(id){return ErrInvalid}
 var roomID string
 e:=s.Store.DB.QueryRowContext(ctx,"SELECT room_id FROM bg_account_social.classic_sessions WHERE id=$1",id).Scan(&roomID)
 if errors.Is(e,sql.ErrNoRows){return ErrNotFound};if e!=nil{return e}
 tx,e:=s.Store.DB.BeginTx(ctx,nil);if e!=nil{return e};defer tx.Rollback()
 var roomStatus string
 e=tx.QueryRowContext(ctx,"SELECT status FROM bg_account_social.classic_rooms WHERE id=$1 FOR UPDATE",roomID).Scan(&roomStatus)
 if e!=nil{return e}
 r,e:=scanClassicSession(tx.QueryRowContext(ctx,"SELECT "+classicSessionFields+
   " FROM bg_account_social.classic_sessions WHERE id=$1 FOR UPDATE",id))
 if e!=nil{return e}
 rule,e:=s.rule(r.GameID,r.RulesVersion,r.RulesHash)
 if e!=nil{return e}
 if a,ok:=rule.(*RulesAdapter);ok{
  if e=s.verifyRulesTx(ctx,tx,r,a);e!=nil{return ErrUnavailable}
 }
 var now time.Time
 if e=tx.QueryRowContext(ctx,"SELECT clock_timestamp()").Scan(&now);e!=nil{return e}
 if e=s.expireLocked(ctx,tx,&r,now);e!=nil{return e}
 return tx.Commit()
}
func (s *ClassicSessions) expireLocked(ctx context.Context,tx *sql.Tx,r *classicSessionRecord,now time.Time)error{
 if r.Status!="active"||r.Deadline==nil||now.Before(*r.Deadline){return nil}
 rule,err:=s.rule(r.GameID,r.RulesVersion,r.RulesHash);if err!=nil{return err}
 if isClassicChess(rule){return s.expireChessLocked(ctx,tx,r,rule.(*RulesAdapter),now)}
 actor:=any(nil)
 if r.TurnSeat!=nil{actor=*r.TurnSeat}
 r.Sequence++;r.Status="timed_out";r.FinishedReason="timed_out";r.TurnSeat=nil;r.Deadline=nil
 _,e:=tx.ExecContext(ctx,"UPDATE bg_account_social.classic_sessions SET status='timed_out',"+
  "sequence=$2,turn_seat=NULL,turn_deadline=NULL,finished_reason='timed_out',updated_at=clock_timestamp() "+
  "WHERE id=$1",r.ID,r.Sequence)
 if e!=nil{return e}
 _,e=tx.ExecContext(ctx,"UPDATE bg_account_social.classic_rooms SET status='completed',"+
  "revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",r.RoomID)
 if e!=nil{return e}
 return s.publish(ctx,tx,*r,"timed_out",actor)
}
func (s *ClassicSessions) Sweep(ctx context.Context)(int,error){
 rows,e:=s.Store.DB.QueryContext(ctx,"SELECT id FROM bg_account_social.classic_sessions "+
  "WHERE status='active' AND turn_deadline<=clock_timestamp() ORDER BY turn_deadline,id LIMIT 32")
 if e!=nil{return 0,e}
 ids:=[]string{}
 for rows.Next(){var id string;if e=rows.Scan(&id);e!=nil{rows.Close();return 0,e};ids=append(ids,id)}
 e=rows.Err();rows.Close();if e!=nil{return 0,e}
 for _,id:=range ids{if e=s.Expire(ctx,id);e!=nil{return 0,e}}
 return len(ids),nil
}
func (s *ClassicSessions) Act(ctx context.Context,viewer,id string,action ClassicSessionAction)(ClassicSessionView,error){
 var empty ClassicSessionView
 if !uuid.MatchString(viewer)||!uuid.MatchString(id)||!uuid.MatchString(action.RequestID)||
   action.ExpectedSequence<2||action.ExpectedSequence>1000000{return empty,ErrInvalid}
 if action.Action!="move"&&action.Action!="resign"&&action.Action!="cancel"{return empty,ErrInvalid}
 if action.Action=="move"&&(!validViewerState(action.Move)||len(action.Move)>classicMaxActionBytes){return empty,ErrInvalid}
 if action.Action!="move"&&len(action.Move)>0{return empty,ErrInvalid}
 canonical,e:=json.Marshal(action);if e!=nil{return empty,ErrInvalid}
 digest:=sha256.Sum256(canonical)
 var roomID string
 e=s.Store.DB.QueryRowContext(ctx,"SELECT room_id FROM bg_account_social.classic_sessions WHERE id=$1",id).Scan(&roomID)
 if errors.Is(e,sql.ErrNoRows){return empty,ErrNotFound};if e!=nil{return empty,e}
 tx,e:=s.Store.DB.BeginTx(ctx,nil);if e!=nil{return empty,e};defer tx.Rollback()
 var room ClassicRoom
 room,e=scanClassicRoom(tx.QueryRowContext(ctx,"SELECT "+classicRoomColumns+
 " FROM bg_account_social.classic_rooms WHERE id=$1 FOR UPDATE",roomID))
 if e!=nil{return empty,e}
 rec,e:=scanClassicSession(tx.QueryRowContext(ctx,"SELECT "+classicSessionFields+
   " FROM bg_account_social.classic_sessions WHERE id=$1 FOR UPDATE",id))
 if e!=nil{return empty,e}
 seat,e:=s.participant(ctx,tx,roomID,viewer)
 if e!=nil{return empty,e}
 // Idempotency is checked BEFORE the current turn/deadline status. A retry
 // can recover its verified, possibly newer, snapshot without executing twice.
 var priorActor string;var priorDigest []byte
 e=tx.QueryRowContext(ctx,"SELECT actor,digest FROM bg_account_social.classic_session_commands "+
 "WHERE session_id=$1 AND request_id=$2",id,action.RequestID).Scan(&priorActor,&priorDigest)
 if e==nil{
  if priorActor!=viewer||len(priorDigest)!=len(digest)||!equalDigest(priorDigest,digest[:]){return empty,ErrConflict}
  tx.Rollback()
  return s.Get(ctx,viewer,id)
 }
 if !errors.Is(e,sql.ErrNoRows){return empty,e}
 var now time.Time
 if e=tx.QueryRowContext(ctx,"SELECT clock_timestamp()").Scan(&now);e!=nil{return empty,e}
 rule,e:=s.rule(rec.GameID,rec.RulesVersion,rec.RulesHash)
 if e!=nil{return empty,e}
 replayAdapter,versioned:=rule.(*RulesAdapter)
 if versioned{
  if e=s.verifyRulesTx(ctx,tx,rec,replayAdapter);e!=nil{return empty,ErrUnavailable}
 }
 if rec.Status=="active"&&rec.Deadline!=nil&&!now.Before(*rec.Deadline){
  if e=s.expireLocked(ctx,tx,&rec,now);e!=nil{return empty,e}
  if e=tx.Commit();e!=nil{return empty,e}
  return empty,ErrConflict
 }
 if rec.Status!="active"||room.Status!="in_game"||action.ExpectedSequence!=rec.Sequence+1{return empty,ErrConflict}
 kind:=action.Action
 actor:=any(seat)
 var next any;var deadline any;var winner any;var reason any
 beforeState:=append(json.RawMessage(nil),rec.State...)
 chess:=isClassicChess(rule)
 if chess&&kind=="cancel"{return empty,ErrConflict}
 ruleAction:=action.Move
 if chess&&kind=="resign"{ruleAction=chessAction("resign","")}
 if kind=="move"||chess&&kind=="resign"{
  if rec.TurnSeat==nil{return empty,ErrUnavailable}
  if *rec.TurnSeat!=seat&&!(chess&&chessNonTurnAction(ruleAction)){return empty,ErrForbidden}
  var state json.RawMessage
  var turn int
  var finished bool
  var won *int
  if chess&&rec.Deadline!=nil{
   event:=chessTimedEvent{At:now.UnixMilli(),Move:ruleAction}
   state,turn,finished,won,e=replayAdapter.applyChessTime(rec.State,seat,event)
   if e==nil{ruleAction,e=json.Marshal(event)}
  }else{state,turn,finished,won,e=rule.Apply(rec.State,seat,ruleAction)}
  if e!=nil{return empty,e}
  if !validRuleState(state){return empty,ErrUnavailable}
  rec.State=state
  if finished{
   if won!=nil&&(*won<0||*won>=rec.SeatCount){return empty,ErrUnavailable}
   rec.Status="finished";rec.FinishedReason="completed";rec.WinnerSeat=won;kind="finished"
   reason="completed";if won!=nil{winner=*won}
  }else{
   if turn<0||turn>=rec.SeatCount{return empty,ErrUnavailable} // qualified rules may award extra turns
   var controller string
   var difficulty sql.NullString
   e=tx.QueryRowContext(ctx,"SELECT controller,difficulty FROM bg_account_social.classic_room_seats WHERE room_id=$1 AND seat_index=$2",roomID,turn).Scan(&controller,&difficulty)
   if e!=nil{return empty,e}
   if controller=="bot"{
    if !difficulty.Valid{return empty,ErrUnavailable}
    if _,e=s.botPolicy(rec.GameID,difficulty.String);e!=nil{return empty,ErrUnavailable}
   }else if controller!="human"{return empty,ErrUnavailable}
   rec.TurnSeat=&turn;next=turn
   if !chess{d:=now.Add(classicTurnSeconds*time.Second);rec.Deadline=&d;deadline=d
   }else if rec.Deadline!=nil{
    frame,err:=replayAdapter.decode(state);if err!=nil{return empty,err}
    data,err:=chessDecode(frame);if err!=nil{return empty,err}
    rec.Deadline=data.Timing.deadline(turn);deadline=rec.Deadline
   }
  }
 }else{
  if kind=="cancel"&&viewer!=room.Host{return empty,ErrForbidden}
  if kind=="resign"{rec.Status="resigned";rec.FinishedReason="resigned";reason="resigned"
   if rec.SeatCount==2{other:=(seat+1)%2;rec.WinnerSeat=&other;winner=other}
   kind="resigned"
  }else{rec.Status="cancelled";rec.FinishedReason="cancelled";reason="cancelled";kind="cancelled"}
 }
 rec.Sequence=action.ExpectedSequence
 if rec.Status!="active"{rec.TurnSeat=nil;rec.Deadline=nil}
 _,e=tx.ExecContext(ctx,"UPDATE bg_account_social.classic_sessions SET engine_state=$2,"+
  "sequence=$3,status=$4,turn_seat=$5,turn_deadline=$6,winner_seat=$7,finished_reason=$8,"+
  "updated_at=clock_timestamp() WHERE id=$1",id,string(rec.State),rec.Sequence,rec.Status,next,deadline,winner,reason)
 if e!=nil{return empty,e}
 if rec.Status!="active"{
  _,e=tx.ExecContext(ctx,"UPDATE bg_account_social.classic_rooms SET status='completed',"+
   "revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",roomID)
  if e!=nil{return empty,e}
 }
 if e=s.publish(ctx,tx,rec,kind,actor);e!=nil{return empty,e}
 if versioned&&len(ruleAction)>0{
  if e=s.saveRuleMove(ctx,tx,id,rec.Sequence,seat,ruleAction,beforeState,rec.State,replayAdapter);e!=nil{return empty,e}
 }
 _,e=tx.ExecContext(ctx,"INSERT INTO bg_account_social.classic_session_commands "+
 "(session_id,request_id,actor,digest,sequence) VALUES($1,$2,$3,$4,$5)",
 id,action.RequestID,viewer,digest[:],rec.Sequence)
 if e!=nil{return empty,e}
 if e=tx.Commit();e!=nil{return empty,e}
 return s.Get(ctx,viewer,id)
}
func equalDigest(a,b []byte)bool{
 if len(a)!=len(b){return false}
 var differ byte
 for i:=range a{differ|=a[i]^b[i]}
 return differ==0
}
