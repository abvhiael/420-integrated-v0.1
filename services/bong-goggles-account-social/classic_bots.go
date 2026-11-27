package social

import (
 "bytes"
 "context"
 "database/sql"
 "encoding/json"
 "errors"
 "fmt"
 "time"
)

// BC-0.8: policies are trusted, compiled Go modules registered per qualified
// game. There is deliberately no universal "good at Chess" fallback.
type ClassicBotPolicies struct {
 Easy RuleDecisionPolicy
 Medium RuleDecisionPolicy
 Hard RuleDecisionPolicy
}

func (p ClassicBotPolicies) policy(level string) (RuleDecisionPolicy, error) {
 var policy RuleDecisionPolicy
 switch level {
 case "easy": policy=p.Easy
 case "medium": policy=p.Medium
 case "hard": policy=p.Hard
 default: return nil, ErrInvalid
 }
 if policy==nil{return nil,ErrUnavailable}
 return policy,nil
}
func (p ClassicBotPolicies) complete() bool {
 return p.Easy!=nil && p.Medium!=nil && p.Hard!=nil
}
func botLimits(level string)(int,time.Duration,error){
 switch level {
 case "easy": return 1000,50*time.Millisecond,nil
 case "medium": return 10000,125*time.Millisecond,nil
 case "hard": return 100000,300*time.Millisecond,nil
 }
 return 0,0,ErrInvalid
}

// EnableBots is an operator-only, startup-time registration method. This
// configuration is never taken from an HTTP request or a user manifest.
// Every game must have its own qualified rules adapter and all three
// strategies; a missing strategy fails closed instead of downgrading play.
func (s *ClassicSessions) EnableBots(policies map[string]ClassicBotPolicies)error{
 if s==nil||s.Store==nil||s.Rules==nil||len(policies)==0{return ErrInvalid}
 next:=make(map[string]ClassicBotPolicies,len(policies))
 for game,p:=range policies{
  if !p.complete(){return ErrInvalid}
  rule,e:=s.rule(game,"","");if e!=nil{return e}
  adapter,ok:=rule.(*RulesAdapter)
  if !ok||adapter.definition.GameID!=game{return ErrUnavailable}
  next[game]=p
 }
 s.Bots=next
 return nil
}
func (s *ClassicSessions) botPolicy(game,level string)(RuleDecisionPolicy,error){
 if s==nil||s.Bots==nil{return nil,ErrUnavailable}
 p,ok:=s.Bots[game];if !ok{return nil,ErrUnavailable}
 return p.policy(level)
}

// RunBotTurn commits at most one server-authorized move. Every process takes
// room -> session row locks in the same order as player actions and timeout
// sweeps. The current seat/controller/difficulty and immutable rules identity
// are re-read from PostgreSQL; no caller supplies a seat, score or move.
// Crashes before commit leave exactly the same decision available on retry.
func (s *ClassicSessions) RunBotTurn(ctx context.Context,id string)(bool,error){
 if s==nil||s.Store==nil||s.Bots==nil||!uuid.MatchString(id){return false,ErrInvalid}
 ctx,cancel:=context.WithTimeout(ctx,5*time.Second);defer cancel()
 var roomID string
 e:=s.Store.DB.QueryRowContext(ctx,
  "SELECT room_id FROM bg_account_social.classic_sessions WHERE id=$1",id).Scan(&roomID)
 if errors.Is(e,sql.ErrNoRows){return false,ErrNotFound}
 if e!=nil{return false,e}
 tx,e:=s.Store.DB.BeginTx(ctx,nil);if e!=nil{return false,e};defer tx.Rollback()
 var roomStatus string
 e=tx.QueryRowContext(ctx,
  "SELECT status FROM bg_account_social.classic_rooms WHERE id=$1 FOR UPDATE",roomID).Scan(&roomStatus)
 if e!=nil{return false,e}
 rec,e:=scanClassicSession(tx.QueryRowContext(ctx,"SELECT "+classicSessionFields+
  " FROM bg_account_social.classic_sessions WHERE id=$1 FOR UPDATE",id))
 if e!=nil{return false,e}
 if rec.Status!="active"||rec.TurnSeat==nil||roomStatus!="in_game"{return false,nil}
 seat:=*rec.TurnSeat
 var controller string
 var difficulty,subject sql.NullString
 e=tx.QueryRowContext(ctx,"SELECT controller,difficulty,subject FROM bg_account_social.classic_room_seats "+
  "WHERE room_id=$1 AND seat_index=$2",roomID,seat).Scan(&controller,&difficulty,&subject)
 if e!=nil{return false,e}
 if controller!="bot"{return false,nil}
 if subject.Valid||!difficulty.Valid{return false,ErrUnavailable}
 policy,e:=s.botPolicy(rec.GameID,difficulty.String);if e!=nil{return false,e}
 rule,e:=s.rule(rec.GameID,rec.RulesVersion,rec.RulesHash);if e!=nil{return false,e}
 adapter,ok:=rule.(*RulesAdapter);if !ok{return false,ErrUnavailable}
 if e=s.verifyRulesTx(ctx,tx,rec,adapter);e!=nil{return false,fmt.Errorf("%w: bot journal verification: %v",ErrUnavailable,e)}
 var now time.Time
 if e=tx.QueryRowContext(ctx,"SELECT clock_timestamp()").Scan(&now);e!=nil{return false,e}
 chess:=isClassicChess(adapter)
 salad:=rec.GameID=="scrabble"
 if rec.Deadline==nil&&!chess&&!salad||rec.Deadline!=nil&&!now.Before(*rec.Deadline){
  if e=s.expireLocked(ctx,tx,&rec,now);e!=nil{return false,e}
  return false,tx.Commit()
 }
 limit,duration,e:=botLimits(difficulty.String);if e!=nil{return false,e}
 move,e:=adapter.ChooseMoveBounded(rec.State,seat,difficulty.String,policy,limit,time.Now().Add(duration))
 if e!=nil{return false,e}
 var next json.RawMessage
 var turn int
 var finished bool
 var won *int
 if chess&&rec.Deadline!=nil{
  event:=chessTimedEvent{At:now.UnixMilli(),Move:move}
  next,turn,finished,won,e=adapter.applyChessTime(rec.State,seat,event)
  if e==nil{move,e=json.Marshal(event)}
 }else{next,turn,finished,won,e=adapter.Apply(rec.State,seat,move)}
 if e!=nil||!validRuleState(next){return false,fmt.Errorf("%w: bot authoritative apply",ErrUnavailable)}
 before:=rec.State
 rec.State=next;rec.Sequence++
 var nextSeat,deadline,winner,reason any
 kind:="move"
 if finished{
  if won!=nil&&(*won<0||*won>=rec.SeatCount){return false,ErrUnavailable}
  rec.Status="finished";rec.FinishedReason="completed";rec.WinnerSeat=won
  rec.TurnSeat=nil;rec.Deadline=nil;kind="finished";reason="completed"
  if won!=nil{winner=*won}
 }else{
  if turn<0||turn>=rec.SeatCount{return false,ErrUnavailable}
  var nextController string
  e=tx.QueryRowContext(ctx,"SELECT controller FROM bg_account_social.classic_room_seats "+
   "WHERE room_id=$1 AND seat_index=$2",roomID,turn).Scan(&nextController)
  if e!=nil{return false,e}
  if nextController!="human"&&nextController!="bot"{return false,ErrUnavailable}
  rec.TurnSeat=&turn;nextSeat=turn
  if salad{frame,err:=adapter.decode(next);if err!=nil{return false,err};rec.Deadline=wordSaladDeadline(frame.Variant,now);deadline=rec.Deadline
  }else if !chess{due:=now.Add(classicTurnSeconds*time.Second);rec.Deadline=&due;deadline=due
  }else if rec.Deadline!=nil{
   frame,err:=adapter.decode(next);if err!=nil{return false,err}
   data,err:=chessDecode(frame);if err!=nil{return false,err}
   rec.Deadline=data.Timing.deadline(turn);deadline=rec.Deadline
  }
 }
 _,e=tx.ExecContext(ctx,"UPDATE bg_account_social.classic_sessions SET engine_state=$2,"+
  "sequence=$3,status=$4,turn_seat=$5,turn_deadline=$6,winner_seat=$7,finished_reason=$8,"+
  "updated_at=clock_timestamp() WHERE id=$1",id,string(rec.State),rec.Sequence,rec.Status,
  nextSeat,deadline,winner,reason)
 if e!=nil{return false,e}
 if finished{
  _,e=tx.ExecContext(ctx,"UPDATE bg_account_social.classic_rooms SET status='completed',"+
   "revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",roomID)
  if e!=nil{return false,e}
 }
 if e=s.publish(ctx,tx,rec,kind,seat);e!=nil{return false,e}
 if e=s.saveRuleMove(ctx,tx,id,rec.Sequence,seat,move,before,rec.State,adapter);e!=nil{return false,e}
 if e=tx.Commit();e!=nil{return false,e}
 return true,nil
}

// SweepBots is a single in-process worker; database locks guarantee exactly
// one committed move even with several service replicas. It processes at
// most eight turns per wake-up and never spins on consecutive bot seats.
func (s *ClassicSessions) SweepBots(ctx context.Context)(int,error){
 if s==nil||s.Store==nil{return 0,ErrInvalid}
 if len(s.Bots)==0{return 0,nil}
 s.botMu.Lock();defer s.botMu.Unlock()
 rows,e:=s.Store.DB.QueryContext(ctx,"SELECT sess.id FROM bg_account_social.classic_sessions sess "+
  "JOIN bg_account_social.classic_room_seats seat ON seat.room_id=sess.room_id "+
  "AND seat.seat_index=sess.turn_seat WHERE sess.status='active' AND seat.controller='bot' "+
  "ORDER BY sess.updated_at,sess.id LIMIT 8")
 if e!=nil{return 0,e}
 ids:=[]string{}
 for rows.Next(){var id string;if e=rows.Scan(&id);e!=nil{rows.Close();return 0,e};ids=append(ids,id)}
 e=rows.Err();rows.Close();if e!=nil{return 0,e}
 processed:=0
 var first error
 for _,id:=range ids{
  if ctx.Err()!=nil{return processed,ctx.Err()}
  moved,err:=s.RunBotTurn(ctx,id)
  if err!=nil{if first==nil{first=err};continue}
  if moved{processed++}
 }
 return processed,first
}

// BotMatchResult is an offline qualification artifact, not a user match,
// leaderboard result or an on-chain outcome.
type BotMatchResult struct {
 State json.RawMessage
 Trace []RuleTrace
 Winner *int
 Scores []int64
}

// QualifyBotMatch exercises genuine rules and seat-limited AI decisions with
// a reproducible seed and an exact replay. It requires game-specific policies;
// a test-only fixture must never be registered as a playable production game.
func QualifyBotMatch(adapter *RulesAdapter,seed [32]byte,levels []string,p ClassicBotPolicies)(BotMatchResult,error){
 var result BotMatchResult
 if adapter==nil||!p.complete()||!classicSeatsValid(adapter.definition.GameID,len(levels))||
  len(levels)>4{return result,ErrInvalid}
 seats:=make([]ClassicSeat,len(levels))
 for i,level:=range levels{
  if _,e:=p.policy(level);e!=nil{return result,e}
  seats[i]=ClassicSeat{Index:i,Controller:"bot",Difficulty:level,Team:classicTeam(adapter.definition.GameID,len(levels),i)}
 }
 state,_,e:=adapter.InitialWithSeed(seed,ClassicRoom{GameID:adapter.definition.GameID,SeatCount:len(seats)},seats)
 if e!=nil{return result,e}
 trace:=make([]RuleTrace,0,32)
 for i:=0;i<=adapter.replayLimit();i++{
  frame,e:=adapter.decode(state);if e!=nil{return result,e}
  if frame.Terminal{
   replay,e:=adapter.Replay(seed,len(levels),trace)
   if e!=nil||!bytes.Equal(state,replay){return result,ErrUnavailable}
   result.State=state;result.Trace=trace;result.Winner=frame.Winner
   result.Scores=append([]int64(nil),frame.Scores...)
   return result,nil
  }
  if i==adapter.replayLimit(){return result,ErrUnavailable}
  level:=levels[frame.Turn];policy,e:=p.policy(level);if e!=nil{return result,e}
  limit,duration,e:=botLimits(level);if e!=nil{return result,e}
  move,e:=adapter.ChooseMoveBounded(state,frame.Turn,level,policy,limit,time.Now().Add(duration))
  if e!=nil{return result,e}
  next,_,_,_,e:=adapter.Apply(state,frame.Turn,move);if e!=nil{return result,e}
  trace=append(trace,RuleTrace{Sequence:int64(i+2),Seat:frame.Turn,
   Action:append(json.RawMessage(nil),move...),BeforeHash:RuleHash(state),AfterHash:RuleHash(next)})
  state=next
 }
 return result,ErrUnavailable
}
