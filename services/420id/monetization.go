package account

import (
 "context"
 "database/sql"
 "errors"
)

// AUTH-11 deliberately does not issue paid plans, token rights, transactions,
// reward claims, a points conversion or wallet permissions. Consent permits
// a canonical programme to be reviewed later, never silently activated.
const monetizationApp = "bong-goggles"
type MonetizationStatus struct {
 App string `json:"app"`
 PolicyVersion int `json:"policyVersion"`
 Version int64 `json:"version"`
 RewardOptIn bool `json:"rewardOptIn"`
 CreatorOptIn bool `json:"creatorOptIn"`
 WalletLinked bool `json:"walletLinked"`
 RewardStage string `json:"rewardStage"`
 CreatorStage string `json:"creatorStage"`
 CanClaim bool `json:"canClaim"`
 Paid bool `json:"paid"`
 PaymentAuthorized bool `json:"paymentAuthorized"`
 FinancialAuthority bool `json:"financialAuthority"`
 Source string `json:"source"`
}
type MonetizationManager struct { Sessions *SessionManager }
func NewMonetizationManager(s *SessionManager)(*MonetizationManager,error){
 if s==nil||s.auth==nil||s.app!="420id"{return nil,ErrInvalid}
 return &MonetizationManager{Sessions:s},nil
}
func (m *MonetizationManager) Ready(ctx context.Context)error{
 var read,appendOK,edit bool
 e:=m.Sessions.auth.store.db.QueryRowContext(ctx,`SELECT
 COALESCE(has_table_privilege(current_user,to_regclass('account420.monetization_consents'),'SELECT'),false),
 COALESCE(has_table_privilege(current_user,to_regclass('account420.monetization_consents'),'INSERT'),false),
 COALESCE(has_column_privilege(current_user,'account420.monetization_consents','reward_opt_in','UPDATE'),false)
 AND COALESCE(has_column_privilege(current_user,'account420.monetization_consents','creator_opt_in','UPDATE'),false)
 AND COALESCE(has_column_privilege(current_user,'account420.monetization_consents','revision','UPDATE'),false)
 AND COALESCE(has_column_privilege(current_user,'account420.monetization_consents','updated_at','UPDATE'),false)`).Scan(&read,&appendOK,&edit)
 if e!=nil{return e};if !read||!appendOK||!edit{return ErrUnavailable}
 return nil
}
// ReadyRuntime additionally enforces the documented least-privilege
// separation: owning the table or obtaining DELETE/whole-table UPDATE
// would let a serving credential rewrite other members' consent records.
// Operators may use Ready during migrations; public serving uses this gate.
func (m *MonetizationManager) ReadyRuntime(ctx context.Context)error{
 if e:=m.Ready(ctx);e!=nil{return e}
 var unsafe bool
 e:=m.Sessions.auth.store.db.QueryRowContext(ctx,`SELECT
 COALESCE(has_table_privilege(current_user,to_regclass('account420.monetization_consents'),'UPDATE'),false)
 OR COALESCE(has_table_privilege(current_user,to_regclass('account420.monetization_consents'),'DELETE'),false)
 OR COALESCE(has_table_privilege(current_user,to_regclass('account420.monetization_consents'),'TRUNCATE'),false)
 OR COALESCE(has_column_privilege(current_user,'account420.monetization_consents','account_id','UPDATE'),false)
 OR COALESCE(has_column_privilege(current_user,'account420.monetization_consents','app_id','UPDATE'),false)`).Scan(&unsafe)
 if e!=nil{return e};if unsafe{return ErrUnavailable}
 return nil
}
func (m *MonetizationManager) byAccount(ctx context.Context,q interface{ QueryRowContext(context.Context,string,...any)*sql.Row },id AccountID)(MonetizationStatus,error){
 out:=MonetizationStatus{App:monetizationApp,PolicyVersion:1,Version:0,
  RewardStage:"not_enrolled",CreatorStage:"not_enrolled",Source:"420id-consent-v1"}
 // Read only the authenticated account; the source session is validated
 // independently. No internal account ID or wallet address leaves this method.
 e:=q.QueryRowContext(ctx,`SELECT
 COALESCE(c.reward_opt_in,false),COALESCE(c.creator_opt_in,false),
 COALESCE(c.revision,0),
 EXISTS(SELECT 1 FROM account420.wallet_links w
 WHERE w.account_id=$1 AND w.unlinked_at IS NULL)
 FROM account420.accounts a
 LEFT JOIN account420.monetization_consents c
 ON c.account_id=a.id AND c.app_id='bong-goggles'
 WHERE a.id=$1 AND a.status='active'`,id).
 Scan(&out.RewardOptIn,&out.CreatorOptIn,&out.Version,&out.WalletLinked)
 if errors.Is(e,sql.ErrNoRows){return MonetizationStatus{},ErrAuthentication}
 if e!=nil{return MonetizationStatus{},e}
 if out.RewardOptIn{
  if out.WalletLinked{out.RewardStage="canonical_verification_required"}else{out.RewardStage="wallet_required"}
 }
 if out.CreatorOptIn{
  // No billing/merchant settlement contract is accepted as account proof.
  out.CreatorStage="operator_programme_required"
 }
 return out,nil
}
func (m *MonetizationManager) Current(ctx context.Context,token string)(MonetizationStatus,error){
 return m.currentLocked(ctx,token)
}
func (m *MonetizationManager) currentLocked(ctx context.Context,token string)(MonetizationStatus,error){
 tx,e:=m.Sessions.auth.store.db.BeginTx(ctx,nil);if e!=nil{return MonetizationStatus{},e};defer tx.Rollback()
 s,e:=m.Sessions.lockedSession(ctx,tx,token);if e!=nil{return MonetizationStatus{},e}
 out,e:=m.byAccount(ctx,tx,s.account);if e!=nil{return MonetizationStatus{},e}
 if e=tx.Commit();e!=nil{return MonetizationStatus{},e}
 return out,nil
}
func (m *MonetizationManager) Set(ctx context.Context,token string,reward,creator bool,expected int64)(MonetizationStatus,error){
 if expected<0{return MonetizationStatus{},ErrInvalid}
 tx,e:=m.Sessions.auth.store.db.BeginTx(ctx,nil);if e!=nil{return MonetizationStatus{},e};defer tx.Rollback()
 s,e:=m.Sessions.lockedSession(ctx,tx,token);if e!=nil{return MonetizationStatus{},e}
 var prior int64
 e=tx.QueryRowContext(ctx,`SELECT revision FROM account420.monetization_consents
 WHERE account_id=$1 AND app_id='bong-goggles' FOR UPDATE`,s.account).Scan(&prior)
 if errors.Is(e,sql.ErrNoRows){prior=0}else if e!=nil{return MonetizationStatus{},e}
 if prior!=expected{return MonetizationStatus{},ErrConflict}
 if prior==0{
  _,e=tx.ExecContext(ctx,`INSERT INTO account420.monetization_consents
  (account_id,app_id,reward_opt_in,creator_opt_in,revision)
  VALUES($1,'bong-goggles',$2,$3,1)`,s.account,reward,creator)
 }else{
  _,e=tx.ExecContext(ctx,`UPDATE account420.monetization_consents SET
  reward_opt_in=$2,creator_opt_in=$3,revision=revision+1,
  updated_at=clock_timestamp() WHERE account_id=$1 AND app_id='bong-goggles'`,
   s.account,reward,creator)
 }
 if e!=nil{return MonetizationStatus{},e}
 out,e:=m.byAccount(ctx,tx,s.account);if e!=nil{return MonetizationStatus{},e}
 if e=tx.Commit();e!=nil{return MonetizationStatus{},e}
 return out,nil
}
// Used only by the confidential, authorized BongGoggles SSO introspector.
// The caller has already validated the exact child+parent session and client.
func (m *MonetizationManager) forBongGoggles(ctx context.Context,id AccountID)(MonetizationStatus,error){
 return m.byAccount(ctx,m.Sessions.auth.store.db,id)
}
