package social

import (
 "context"
 "database/sql"
 "encoding/json"
 "errors"
 "regexp"
 "sync"
 "time"
)

// BC-0.6: durable match transport. No unqualified Classic rule engine is
// registered in production; game logic and hidden state belong to BC-0.7.
type ClassicRule interface {
 Identity()(string,string)
 Initial(ClassicRoom,[]ClassicSeat)(json.RawMessage,int,error)
 Apply(json.RawMessage,int,json.RawMessage)(json.RawMessage,int,bool,*int,error)
 View(json.RawMessage,int)(json.RawMessage,error)
}
type ClassicRuleResolver func(string)ClassicRule
type ClassicSessions struct{Store *Store;Rooms *ClassicRooms;Rules ClassicRuleResolver;Bots map[string]ClassicBotPolicies;botMu sync.Mutex}
const classicTurnSeconds=120
const classicMaxStateBytes=16384
const classicMaxActionBytes=4096
var classicRuleHash=regexp.MustCompile("^[0-9a-f]{64}$")
type ClassicSession struct{
 ID string `json:"id"`
 RoomID string `json:"roomId"`
 GameID string `json:"gameId"`
 SeatCount int `json:"seatCount"`
 Status string `json:"status"`
 RulesVersion string `json:"rulesVersion"`
 RulesHash string `json:"rulesHash"`
 Sequence int64 `json:"sequence"`
 TurnSeat *int `json:"turnSeat"`
 Deadline *time.Time `json:"deadline"`
 WinnerSeat *int `json:"winnerSeat"`
 FinishedReason string `json:"finishedReason,omitempty"`
 UpdatedAt time.Time `json:"updatedAt"`
}
type classicSessionRecord struct{ClassicSession;State json.RawMessage}
type ClassicSessionView struct{
 ClassicSession
 ViewerSeat int `json:"viewerSeat"`
 PrivateView json.RawMessage `json:"privateView"`
}
type ClassicSessionEvent struct{
 Sequence int64 `json:"sequence"`
 Kind string `json:"kind"`
 ActorSeat *int `json:"actorSeat"`
 PublicState json.RawMessage `json:"publicState"`
 OccurredAt time.Time `json:"occurredAt"`
}
type ClassicSessionAction struct{
 RequestID string `json:"requestId"`
 Action string `json:"action"`
 ExpectedSequence int64 `json:"expectedSequence"`
 Move json.RawMessage `json:"move,omitempty"`
}
func NewClassicSessions(store *Store,rooms *ClassicRooms,rules ClassicRuleResolver)(*ClassicSessions,error){
 if store==nil||store.DB==nil||rooms==nil||rooms.Store!=store{return nil,ErrInvalid}
 return &ClassicSessions{Store:store,Rooms:rooms,Rules:rules},nil
}
func (s *ClassicSessions) rule(game,version,hash string)(ClassicRule,error){
 if s==nil||s.Rules==nil{return nil,ErrUnavailable}
 impl:=s.Rules(game);if impl==nil{return nil,ErrUnavailable}
 v,h:=impl.Identity()
 if v==""||len(v)>80||!classicRuleHash.MatchString(h){return nil,ErrUnavailable}
 if version!=""&&(v!=version||h!=hash){return nil,ErrUnavailable}
 return impl,nil
}
func validRuleState(b json.RawMessage)bool{return len(b)>0&&len(b)<=classicMaxStateBytes&&json.Valid(b)}
func validViewerState(b json.RawMessage)bool{return len(b)>0&&len(b)<=classicMaxActionBytes&&json.Valid(b)}
const classicSessionFields="id,room_id,game_id,seat_count,status,rules_version,rules_hash,engine_state,sequence,turn_seat,turn_deadline,winner_seat,finished_reason,updated_at"
func scanClassicSession(row interface{Scan(...any)error})(classicSessionRecord,error){
 var r classicSessionRecord
 var turn,winner sql.NullInt64
 var deadline sql.NullTime
 var reason sql.NullString
 e:=row.Scan(&r.ID,&r.RoomID,&r.GameID,&r.SeatCount,&r.Status,&r.RulesVersion,&r.RulesHash,&r.State,&r.Sequence,&turn,&deadline,&winner,&reason,&r.UpdatedAt)
 if e!=nil{return r,e}
 if turn.Valid{v:=int(turn.Int64);r.TurnSeat=&v}
 if winner.Valid{v:=int(winner.Int64);r.WinnerSeat=&v}
 if deadline.Valid{r.Deadline=&deadline.Time}
 r.FinishedReason=reason.String
 return r,nil
}
func (s *Store) ReadyClassicSessions(ctx context.Context)error{
 var allowed bool
 e:=s.DB.QueryRowContext(ctx,"SELECT "+
 "COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_sessions'),'SELECT'),false) "+
 "AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_sessions'),'INSERT'),false) "+
 "AND COALESCE(has_column_privilege(current_user,'bg_account_social.classic_sessions','status','UPDATE'),false) "+
 "AND COALESCE(has_column_privilege(current_user,'bg_account_social.classic_sessions','engine_state','UPDATE'),false) "+
 "AND COALESCE(has_column_privilege(current_user,'bg_account_social.classic_sessions','sequence','UPDATE'),false) "+
 "AND COALESCE(has_column_privilege(current_user,'bg_account_social.classic_sessions','turn_seat','UPDATE'),false) "+
 "AND COALESCE(has_column_privilege(current_user,'bg_account_social.classic_sessions','turn_deadline','UPDATE'),false) "+
 "AND COALESCE(has_column_privilege(current_user,'bg_account_social.classic_sessions','winner_seat','UPDATE'),false) "+
 "AND COALESCE(has_column_privilege(current_user,'bg_account_social.classic_sessions','finished_reason','UPDATE'),false) "+
 "AND COALESCE(has_column_privilege(current_user,'bg_account_social.classic_sessions','updated_at','UPDATE'),false) "+
 "AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_session_events'),'SELECT'),false) "+
 "AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_session_events'),'INSERT'),false) "+
 "AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_session_commands'),'SELECT'),false) "+
 "AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_session_commands'),'INSERT'),false) "+
 "AND NOT COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_sessions'),'DELETE'),false) "+
 "AND NOT COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_session_events'),'DELETE'),false) "+
 "AND NOT COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_session_commands'),'DELETE'),false) "+
 "AND NOT COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_session_events'),'UPDATE'),false) "+
 "AND NOT COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_session_commands'),'UPDATE'),false) "+
 "AND NOT COALESCE(has_column_privilege(current_user,'bg_account_social.classic_sessions','room_id','UPDATE'),false) "+
 "AND NOT COALESCE(has_column_privilege(current_user,'bg_account_social.classic_sessions','rules_hash','UPDATE'),false) "+
 "AND NOT COALESCE(has_column_privilege(current_user,'bg_account_social.classic_sessions','rules_version','UPDATE'),false) "+
 "AND NOT COALESCE(has_column_privilege(current_user,'bg_account_social.classic_sessions','game_id','UPDATE'),false) "+
 "AND NOT COALESCE(has_column_privilege(current_user,'bg_account_social.classic_sessions','seat_count','UPDATE'),false)").Scan(&allowed)
 if e!=nil{return e};if !allowed{return ErrUnavailable};return nil
}
func (s *ClassicSessions) participant(ctx context.Context,q interface{QueryRowContext(context.Context,string,...any)*sql.Row},room,viewer string)(int,error){
 var seat int
 e:=q.QueryRowContext(ctx,"SELECT self.seat_index FROM bg_account_social.classic_room_seats self "+
 "WHERE self.room_id=$1 AND self.subject=$2 AND self.controller='human' "+
 "AND NOT EXISTS(SELECT 1 FROM bg_account_social.classic_room_seats opponent "+
 "JOIN bg_account_social.blocks b ON (b.blocker=$2 AND b.blocked=opponent.subject) "+
 "OR (b.blocked=$2 AND b.blocker=opponent.subject) "+
 "WHERE opponent.room_id=$1 AND opponent.subject IS NOT NULL)",room,viewer).Scan(&seat)
 if errors.Is(e,sql.ErrNoRows){return 0,ErrNotFound}
 return seat,e
}
func (s *ClassicSessions) view(r classicSessionRecord,seat int)(ClassicSessionView,error){
 rule,e:=s.rule(r.GameID,r.RulesVersion,r.RulesHash)
 if e!=nil{return ClassicSessionView{},e}
 data,e:=rule.View(r.State,seat)
 if e!=nil||!validViewerState(data){return ClassicSessionView{},ErrUnavailable}
 return ClassicSessionView{ClassicSession:r.ClassicSession,ViewerSeat:seat,PrivateView:data},nil
}
func (s *ClassicSessions) Get(ctx context.Context,viewer,id string)(ClassicSessionView,error){
 var empty ClassicSessionView
 if !uuid.MatchString(viewer)||!uuid.MatchString(id){return empty,ErrInvalid}
 record,e:=scanClassicSession(s.Store.DB.QueryRowContext(ctx,"SELECT "+classicSessionFields+" FROM bg_account_social.classic_sessions WHERE id=$1",id))
 if errors.Is(e,sql.ErrNoRows){return empty,ErrNotFound};if e!=nil{return empty,e}
 seat,e:=s.participant(ctx,s.Store.DB,record.RoomID,viewer)
 if e!=nil{return empty,e}
 if e=s.Expire(ctx,id);e!=nil{return empty,e}
 tx,e:=s.Store.DB.BeginTx(ctx,&sql.TxOptions{ReadOnly:true,Isolation:sql.LevelRepeatableRead})
 if e!=nil{return empty,e};defer tx.Rollback()
 record,e=scanClassicSession(tx.QueryRowContext(ctx,"SELECT "+classicSessionFields+" FROM bg_account_social.classic_sessions WHERE id=$1",id))
 if e!=nil{return empty,e}
 if _,e=s.participant(ctx,tx,record.RoomID,viewer);e!=nil{return empty,e}
 rule,e:=s.rule(record.GameID,record.RulesVersion,record.RulesHash)
 if e!=nil{return empty,e}
 if adapter,ok:=rule.(*RulesAdapter);ok{
  if e=s.verifyRulesTx(ctx,tx,record,adapter);e!=nil{return empty,ErrUnavailable}
 }
 view,e:=s.view(record,seat);if e!=nil{return empty,e}
 if e=tx.Commit();e!=nil{return empty,e}
 return view,nil
}
func (s *ClassicSessions) List(ctx context.Context,viewer string)([]ClassicSession,error){
 if !uuid.MatchString(viewer){return nil,ErrInvalid}
 rows,e:=s.Store.DB.QueryContext(ctx,"SELECT "+classicSessionFields+" FROM bg_account_social.classic_sessions sess "+
 "WHERE EXISTS(SELECT 1 FROM bg_account_social.classic_room_seats player WHERE player.room_id=sess.room_id "+
 "AND player.controller='human' AND player.subject=$1) "+
 "AND NOT EXISTS(SELECT 1 FROM bg_account_social.classic_room_seats opponent JOIN bg_account_social.blocks b "+
 "ON (b.blocker=$1 AND b.blocked=opponent.subject) OR (b.blocked=$1 AND b.blocker=opponent.subject) "+
 "WHERE opponent.room_id=sess.room_id AND opponent.subject IS NOT NULL) "+
 "ORDER BY sess.updated_at DESC,sess.id DESC LIMIT 50",viewer)
 if e!=nil{return nil,e};defer rows.Close()
 out:=[]ClassicSession{}
 for rows.Next(){r,e:=scanClassicSession(rows);if e!=nil{return nil,e};out=append(out,r.ClassicSession)}
 return out,rows.Err()
}
func (s *ClassicSessions) Events(ctx context.Context,viewer,id string,after int64)([]ClassicSessionEvent,int64,error){
 if !uuid.MatchString(viewer)||!uuid.MatchString(id)||after<0{return nil,0,ErrInvalid}
 r,e:=scanClassicSession(s.Store.DB.QueryRowContext(ctx,"SELECT "+classicSessionFields+" FROM bg_account_social.classic_sessions WHERE id=$1",id))
 if errors.Is(e,sql.ErrNoRows){return nil,0,ErrNotFound};if e!=nil{return nil,0,e}
 if _,e=s.participant(ctx,s.Store.DB,r.RoomID,viewer);e!=nil{return nil,0,e}
 if e=s.Expire(ctx,id);e!=nil{return nil,0,e}
 var max int64
 if e=s.Store.DB.QueryRowContext(ctx,"SELECT sequence FROM bg_account_social.classic_sessions WHERE id=$1",id).Scan(&max);e!=nil{return nil,0,e}
 if after>max||max-after>50{return nil,max,ErrConflict}
 rows,e:=s.Store.DB.QueryContext(ctx,"SELECT sequence,kind,actor_seat,public_state,created_at "+
 "FROM bg_account_social.classic_session_events WHERE session_id=$1 AND sequence>$2 ORDER BY sequence LIMIT 50",id,after)
 if e!=nil{return nil,0,e};defer rows.Close()
 out:=[]ClassicSessionEvent{}
 for rows.Next(){var item ClassicSessionEvent;var actor sql.NullInt64
  if e=rows.Scan(&item.Sequence,&item.Kind,&actor,&item.PublicState,&item.OccurredAt);e!=nil{return nil,0,e}
  if actor.Valid{n:=int(actor.Int64);item.ActorSeat=&n};out=append(out,item)
 }
 return out,max,rows.Err()
}
