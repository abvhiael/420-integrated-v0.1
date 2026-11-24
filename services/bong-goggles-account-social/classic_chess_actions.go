package social

import (
 "context"
 "database/sql"
 "encoding/json"
)

// ChessActions returns the exact authoritative actions at a verified revision.
// No internal position, repetition journal, bot policy or private seed leaves
// the service. A concurrent move makes the requested revision stale.
func (s *ClassicSessions) ChessActions(ctx context.Context,viewer,id string,sequence int64)([]json.RawMessage,error){
 tx,e:=s.Store.DB.BeginTx(ctx,&sql.TxOptions{ReadOnly:true,Isolation:sql.LevelRepeatableRead})
 if e!=nil{return nil,e};defer tx.Rollback()
 rec,e:=scanClassicSession(tx.QueryRowContext(ctx,"SELECT "+classicSessionFields+" FROM bg_account_social.classic_sessions WHERE id=$1",id))
 if e!=nil{return nil,e}
 seat,e:=s.participant(ctx,tx,rec.RoomID,viewer);if e!=nil{return nil,e}
 if rec.GameID!="chess"{return nil,ErrNotFound}
 if rec.Sequence!=sequence{return nil,ErrConflict}
 rule,e:=s.rule(rec.GameID,rec.RulesVersion,rec.RulesHash);if e!=nil{return nil,e}
 a,ok:=rule.(*RulesAdapter);if !ok||!isClassicChess(a){return nil,ErrUnavailable}
 if e=s.verifyRulesTx(ctx,tx,rec,a);e!=nil{return nil,ErrUnavailable}
 out:=[]json.RawMessage{}
 if rec.Status=="active"{
  out,e=a.LegalActions(rec.State,seat);if e!=nil{return nil,e}
 }
 if e=tx.Commit();e!=nil{return nil,e}
 return out,nil
}
