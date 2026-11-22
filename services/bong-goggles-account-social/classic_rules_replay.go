package social

import (
 "bytes"
 "context"
 "crypto/sha256"
 "database/sql"
 "encoding/hex"
 "encoding/json"
 "errors"
)

// A per-service, bounded optimization of deterministic replay. This is NOT
// an authentication cache, a source of game state, or a durable checkpoint.
// Every access revalidates the entire public journal, the immutable genesis,
// the complete private move trace/digest, and the current persisted snapshot.
// The cache can supply only a prefix that previously passed a full replay.
type verifiedRulePrefix struct{
 roomID,version,hash,initialHash string
 seatCount,moves int
 seed [32]byte
 digest [32]byte
 state json.RawMessage
}
const maxVerifiedRulePrefixes=128
func ruleTraceDigest(trace []RuleTrace)([32]byte,error){
 encoded,e:=json.Marshal(trace)
 if e!=nil{return [32]byte{},e}
 return sha256.Sum256(encoded),nil
}
func (s *ClassicSessions) verifiedPrefix(id string)(verifiedRulePrefix,bool){
 s.verifiedMu.Lock();defer s.verifiedMu.Unlock()
 v,ok:=s.verifiedPrefixes[id]
 if ok{v.state=append(json.RawMessage(nil),v.state...)}
 return v,ok
}
func (s *ClassicSessions) retainVerifiedPrefix(id string,v verifiedRulePrefix){
 s.verifiedMu.Lock();defer s.verifiedMu.Unlock()
 if s.verifiedPrefixes==nil{s.verifiedPrefixes=make(map[string]verifiedRulePrefix)}
 if _,exists:=s.verifiedPrefixes[id];!exists&&len(s.verifiedPrefixes)>=maxVerifiedRulePrefixes{
  // Never retain an unbounded number of private sessions. Dropping all
  // prefixes is safe: the next read reconstructs from durable genesis.
  clear(s.verifiedPrefixes)
 }
 if prior,ok:=s.verifiedPrefixes[id];ok&&prior.moves>v.moves{return}
 v.state=append(json.RawMessage(nil),v.state...)
 s.verifiedPrefixes[id]=v
}

// BC-0.7 private immutable seed and action journal, never in public SSE.
func (s *Store) ReadyClassicRules(ctx context.Context)error{
 var allowed bool
 e:=s.DB.QueryRowContext(ctx,`SELECT
  COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_rule_genesis'),'SELECT'),false)
  AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_rule_genesis'),'INSERT'),false)
  AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_rule_moves'),'SELECT'),false)
  AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_rule_moves'),'INSERT'),false)
  AND NOT COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_rule_genesis'),'DELETE'),false)
  AND NOT COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_rule_genesis'),'UPDATE'),false)
  AND NOT COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_rule_moves'),'DELETE'),false)
  AND NOT COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.classic_rule_moves'),'UPDATE'),false)`).Scan(&allowed)
 if e!=nil{return e}
 if !allowed{return ErrUnavailable}
 return nil
}
func (s *ClassicSessions) saveRuleGenesis(ctx context.Context,tx *sql.Tx,id string,adapter *RulesAdapter,seed [32]byte,initial json.RawMessage)error{
 frame,e:=adapter.decode(initial);if e!=nil{return e}
 canonical,e:=adapter.encode(frame);if e!=nil{return e}
 _,e=tx.ExecContext(ctx,`INSERT INTO bg_account_social.classic_rule_genesis
 (session_id,rules_version,rules_hash,seed_hex,initial_state,initial_hash)
 VALUES($1,$2,$3,$4,$5,$6)`,id,adapter.definition.Version,adapter.hash,
 hex.EncodeToString(seed[:]),string(canonical),RuleHash(canonical))
 return e
}
func (s *ClassicSessions) saveRuleMove(ctx context.Context,tx *sql.Tx,id string,seq int64,seat int,action json.RawMessage,before,after json.RawMessage,adapter *RulesAdapter)error{
 canon,e:=canonicalRuleAction(action);if e!=nil{return e}
 prior,e:=adapter.decode(before);if e!=nil{return e}
 priorCanonical,e:=adapter.encode(prior);if e!=nil{return e}
 next,e:=adapter.decode(after);if e!=nil{return e}
 nextCanonical,e:=adapter.encode(next);if e!=nil{return e}
 _,e=tx.ExecContext(ctx,`INSERT INTO bg_account_social.classic_rule_moves
 (session_id,sequence,actor_seat,action,before_hash,after_hash)
 VALUES($1,$2,$3,$4,$5,$6)`,id,seq,seat,string(canon),RuleHash(priorCanonical),RuleHash(nextCanonical))
 return e
}
// A write has already locked the session; reads must use repeatable-read.
// Reconstruct from initial seed + every committed private action. Reject
// missing/extra public move entries, broken digests and invalid state.
func (s *ClassicSessions) verifyRulesTx(ctx context.Context,tx *sql.Tx,rec classicSessionRecord,adapter *RulesAdapter)error{
 if e:=s.verifyClassicJournalTx(ctx,tx,rec);e!=nil{return ErrUnavailable}
 var version,hash,seedText string
 var initial json.RawMessage
 var initialHash string
 e:=tx.QueryRowContext(ctx,`SELECT rules_version,rules_hash,seed_hex,initial_state,initial_hash
 FROM bg_account_social.classic_rule_genesis WHERE session_id=$1`,rec.ID).
 Scan(&version,&hash,&seedText,&initial,&initialHash)
 if e!=nil{return ErrUnavailable}
 if version!=rec.RulesVersion||hash!=rec.RulesHash||version!=adapter.definition.Version||hash!=adapter.hash{return ErrUnavailable}
 seedBytes,e:=hex.DecodeString(seedText)
 if e!=nil||len(seedBytes)!=32{return ErrUnavailable}
 var seed [32]byte;copy(seed[:],seedBytes)
 original,e:=adapter.initial(seed,rec.SeatCount)
 if e!=nil{return ErrUnavailable}
 // PostgreSQL jsonb canonicalizes nested JSON key ordering.
 initialFrame,e:=adapter.decode(initial);if e!=nil{return ErrUnavailable}
 canonicalInitial,e:=adapter.encode(initialFrame)
 if e!=nil||RuleHash(canonicalInitial)!=initialHash||!bytes.Equal(original,canonicalInitial){return ErrUnavailable}
 rows,e:=tx.QueryContext(ctx,`SELECT m.sequence,m.actor_seat,m.action,m.before_hash,m.after_hash,e.kind,e.actor_seat
 FROM bg_account_social.classic_rule_moves m
 JOIN bg_account_social.classic_session_events e
 ON e.session_id=m.session_id AND e.sequence=m.sequence
 WHERE m.session_id=$1 ORDER BY m.sequence LIMIT $2`,rec.ID,adapter.replayLimit()+1)
 if e!=nil{return e}
 trace:=make([]RuleTrace,0)
 for rows.Next(){
  var step RuleTrace
  var action json.RawMessage
  var kind string
  var actor sql.NullInt64
  if e=rows.Scan(&step.Sequence,&step.Seat,&action,&step.BeforeHash,&step.AfterHash,&kind,&actor);e!=nil{rows.Close();return e}
  if (kind!="move"&&kind!="finished")||!actor.Valid||int(actor.Int64)!=step.Seat||step.Sequence>rec.Sequence{
   rows.Close();return ErrUnavailable
  }
  step.Action=action;trace=append(trace,step)
  if len(trace)>adapter.replayLimit(){rows.Close();return ErrUnavailable}
 }
 e=rows.Err();rows.Close();if e!=nil{return e}
 var moveEvents int
 e=tx.QueryRowContext(ctx,`SELECT count(*) FROM bg_account_social.classic_session_events
 WHERE session_id=$1 AND kind IN ('move','finished')`,rec.ID).Scan(&moveEvents)
 if e!=nil||moveEvents!=len(trace){return ErrUnavailable}
 // Cache reuse requires a fresh SHA-256 of every previously verified
 // private move. Modifying, deleting or reordering even one earlier action
 // invalidates the prefix; a cold replay then proves or rejects the history.
 // This also works on a new process with an empty cache.
 var replay json.RawMessage
 cached,found:=s.verifiedPrefix(rec.ID)
 usedPrefix:=false
 if found&&cached.roomID==rec.RoomID&&cached.version==version&&cached.hash==hash&&
  cached.initialHash==initialHash&&cached.seed==seed&&cached.seatCount==rec.SeatCount&&
  cached.moves>=0&&cached.moves<=len(trace){
  fingerprint,err:=ruleTraceDigest(trace[:cached.moves])
  if err==nil&&fingerprint==cached.digest{
   replay,e=adapter.replayFromVerified(cached.state,int64(cached.moves)+1,trace[cached.moves:])
   if e!=nil{return ErrUnavailable}
   usedPrefix=true
  }
 }
 if !usedPrefix{
  replay,e=adapter.Replay(seed,rec.SeatCount,trace)
  if e!=nil{return ErrUnavailable}
 }
 stored,e:=adapter.decode(rec.State)
 if e!=nil{return ErrUnavailable}
 canonicalSaved,e:=adapter.encode(stored)
 if e!=nil||RuleHash(canonicalSaved)!=RuleHash(replay){return ErrUnavailable}
 if rec.Status=="active"{
  if stored.Terminal||rec.TurnSeat==nil||stored.Turn!=*rec.TurnSeat{return ErrUnavailable}
 }else if rec.Status=="finished"{
  if !stored.Terminal||rec.WinnerSeat==nil&&stored.Winner!=nil||
   rec.WinnerSeat!=nil&&stored.Winner==nil||
   rec.WinnerSeat!=nil&&stored.Winner!=nil&&*rec.WinnerSeat!=*stored.Winner{return ErrUnavailable}
 }else if stored.Terminal{return ErrUnavailable}
 digest,e:=ruleTraceDigest(trace)
 if e!=nil{return ErrUnavailable}
 s.retainVerifiedPrefix(rec.ID,verifiedRulePrefix{
  roomID:rec.RoomID,version:version,hash:hash,initialHash:initialHash,
  seatCount:rec.SeatCount,moves:len(trace),seed:seed,digest:digest,state:replay,
 })
 return nil
}
func (s *ClassicSessions) VerifyRules(ctx context.Context,id string)error{
 if !uuid.MatchString(id){return ErrInvalid}
 tx,e:=s.Store.DB.BeginTx(ctx,&sql.TxOptions{ReadOnly:true,Isolation:sql.LevelRepeatableRead})
 if e!=nil{return e};defer tx.Rollback()
 rec,e:=scanClassicSession(tx.QueryRowContext(ctx,"SELECT "+classicSessionFields+
  " FROM bg_account_social.classic_sessions WHERE id=$1",id))
 if errors.Is(e,sql.ErrNoRows){return ErrNotFound};if e!=nil{return e}
 rule,e:=s.rule(rec.GameID,rec.RulesVersion,rec.RulesHash)
 if e!=nil{return e}
 adapter,ok:=rule.(*RulesAdapter);if !ok{return ErrUnavailable}
 if e=s.verifyRulesTx(ctx,tx,rec,adapter);e!=nil{return e}
 return tx.Commit()
}
