package account

import (
 "context"
 "database/sql"
 "errors"
 "regexp"
 "strings"
 "time"
)

// OnChainIdentityDisplay is a freshly checked read-only projection; it grants
// no 420ID login, 420Identity credential, 420Names ownership, wallet
// permission, trust score, legal identity or monetary authority.
type OnChainIdentityDisplay struct {
 IdentityProfileID string `json:"identityProfileId"`
 NameLabelHash string `json:"nameLabelHash,omitempty"`
 ChainID int64 `json:"chainId"`
 WalletAddress string `json:"walletAddress"`
 IdentityActive bool `json:"identityActive"`
 BilateralNameVerified bool `json:"bilateralNameVerified"`
 FinalizedBlockHash string `json:"finalizedBlockHash"`
 VerifiedAt time.Time `json:"verifiedAt"`
}

// Reader must verify contract code identities, protocol versions, finalized
// chain state and all relevant bilateral bindings. Unavailable or inconsistent
// observations always fail closed.
type IdentityNamesReader interface {
 Verify(ctx context.Context,chain int64,wallet,profileID,labelHash string)(OnChainIdentityDisplay,error)
}
type IdentityNamesPreference struct {
 OnChainIdentityDisplay
 Revision int64 `json:"revision"`
}
type IdentityNamesManager struct {
 sessions *SessionManager
 wallet *WalletLinkManager
 reader IdentityNamesReader
}
func NewIdentityNamesManager(s *SessionManager,w *WalletLinkManager,r IdentityNamesReader)(*IdentityNamesManager,error){
 if s==nil||w==nil||w.sessions!=s||r==nil{return nil,ErrInvalid}
 return &IdentityNamesManager{sessions:s,wallet:w,reader:r},nil
}
var bytes32Hex = regexp.MustCompile(`^0x[0-9a-f]{64}$`)
const zero32 = "0x0000000000000000000000000000000000000000000000000000000000000000"
func canonicalBytes32(input string,allowEmpty bool)(string,error){
 if input==""&&allowEmpty{return "",nil}
 v:=strings.ToLower(input)
 if !bytes32Hex.MatchString(v)||v==zero32{return "",ErrInvalid}
 return v,nil
}

// Consent-based preview checks an active wallet link; it does not save an
// Identity420/Names420 assertion or nominate a controller.
func (m *IdentityNamesManager) Preview(ctx context.Context,token,profileID,labelHash string)(OnChainIdentityDisplay,error){
 p,e:=canonicalBytes32(profileID,false);if e!=nil{return OnChainIdentityDisplay{},e}
 label,e:=canonicalBytes32(labelHash,true);if e!=nil{return OnChainIdentityDisplay{},e}
 linked,e:=m.wallet.Current(ctx,token)
 if e!=nil{return OnChainIdentityDisplay{},e}
 if linked==nil||linked.ChainID!=m.wallet.chainID{return OnChainIdentityDisplay{},ErrUnavailable}
 verified,e:=m.reader.Verify(ctx,linked.ChainID,linked.Address,p,label)
 if e!=nil{return OnChainIdentityDisplay{},e}
 if verified.IdentityProfileID!=p||verified.NameLabelHash!=label||verified.ChainID!=linked.ChainID||
  verified.WalletAddress!=linked.Address||!verified.IdentityActive||
  (label!=""&&!verified.BilateralNameVerified)||verified.FinalizedBlockHash==""||verified.VerifiedAt.IsZero(){
  return OnChainIdentityDisplay{},ErrAuthentication
 }
 return verified,nil
}

func (m *IdentityNamesManager) Save(ctx context.Context,token,profileID,labelHash string,consent bool,expectedRevision int64)(IdentityNamesPreference,error){
 if !consent||expectedRevision<0{return IdentityNamesPreference{},ErrInvalid}
 observed,e:=m.Preview(ctx,token,profileID,labelHash);if e!=nil{return IdentityNamesPreference{},e}
 tx,e:=m.sessions.auth.store.db.BeginTx(ctx,nil);if e!=nil{return IdentityNamesPreference{},e};defer tx.Rollback()
 session,e:=m.sessions.lockedSession(ctx,tx,token);if e!=nil{return IdentityNamesPreference{},e}
 // Concurrency boundary: wallet unlink, session revocation, recovery and
 // account changes serialize on the same account row. A replaced wallet cannot
 // inherit a previous identity/name presentation preference.
 var address string;var chain int64
 e=tx.QueryRowContext(ctx,"SELECT chain_id,wallet_address FROM account420.wallet_links WHERE account_id=$1 AND unlinked_at IS NULL",session.account).Scan(&chain,&address)
 if errors.Is(e,sql.ErrNoRows){return IdentityNamesPreference{},ErrAuthentication}
 if e!=nil{return IdentityNamesPreference{},e}
 if address!=observed.WalletAddress||chain!=observed.ChainID{return IdentityNamesPreference{},ErrAuthentication}
 var revision int64
 e=tx.QueryRowContext(ctx,"SELECT revision FROM account420.identity_names_preferences WHERE account_id=$1",session.account).Scan(&revision)
 if errors.Is(e,sql.ErrNoRows){revision=0;e=nil}
 if e!=nil{return IdentityNamesPreference{},e}
 if revision!=expectedRevision{return IdentityNamesPreference{},ErrConflict}
 if revision==0{
  _,e=tx.ExecContext(ctx,`INSERT INTO account420.identity_names_preferences
   (account_id,chain_id,wallet_address,identity_profile_id,name_label_hash)
   VALUES($1,$2,$3,$4,NULLIF($5,''))`,session.account,chain,address,observed.IdentityProfileID,observed.NameLabelHash)
 }else{
  _,e=tx.ExecContext(ctx,`UPDATE account420.identity_names_preferences SET
   chain_id=$2,wallet_address=$3,identity_profile_id=$4,name_label_hash=NULLIF($5,''),
   revision=revision+1,updated_at=clock_timestamp()
   WHERE account_id=$1 AND revision=$6`,session.account,chain,address,observed.IdentityProfileID,observed.NameLabelHash,revision)
 }
 if e!=nil{return IdentityNamesPreference{},e}
 if e=tx.Commit();e!=nil{return IdentityNamesPreference{},e}
 return IdentityNamesPreference{OnChainIdentityDisplay:observed,Revision:revision+1},nil
}

// Current never treats a cached database preference as authoritative. Every
// read revalidates live linkage and finalized Identity/Names state.
func (m *IdentityNamesManager) Current(ctx context.Context,token string)(*IdentityNamesPreference,error){
 tx,e:=m.sessions.auth.store.db.BeginTx(ctx,nil);if e!=nil{return nil,e};defer tx.Rollback()
 session,e:=m.sessions.lockedSession(ctx,tx,token);if e!=nil{return nil,e}
 var p,label,address string;var chain,revision int64;var nullable sql.NullString
 e=tx.QueryRowContext(ctx,`SELECT chain_id,wallet_address,identity_profile_id,name_label_hash,revision
 FROM account420.identity_names_preferences WHERE account_id=$1`,session.account).Scan(&chain,&address,&p,&nullable,&revision)
 if errors.Is(e,sql.ErrNoRows){if e=tx.Commit();e!=nil{return nil,e};return nil,nil}
 if e!=nil{return nil,e}
 label=nullable.String
 if e=tx.Commit();e!=nil{return nil,e}
 observed,e:=m.Preview(ctx,token,p,label)
 if e!=nil{return nil,e}
 if observed.WalletAddress!=address||observed.ChainID!=chain{return nil,ErrAuthentication}
 return &IdentityNamesPreference{OnChainIdentityDisplay:observed,Revision:revision},nil
}

func (m *IdentityNamesManager) Clear(ctx context.Context,token string)error{
 tx,e:=m.sessions.auth.store.db.BeginTx(ctx,nil);if e!=nil{return e};defer tx.Rollback()
 session,e:=m.sessions.lockedSession(ctx,tx,token);if e!=nil{return e}
 if _,e=tx.ExecContext(ctx,"DELETE FROM account420.identity_names_preferences WHERE account_id=$1",session.account);e!=nil{return e}
 return tx.Commit()
}

func (m *IdentityNamesManager) Ready(ctx context.Context)error{
 var ok bool
 e:=m.sessions.auth.store.db.QueryRowContext(ctx,`SELECT COALESCE(
 has_table_privilege(current_user,to_regclass('account420.identity_names_preferences'),'SELECT,INSERT,UPDATE,DELETE'),false)`).Scan(&ok)
 if e!=nil{return e};if !ok{return ErrUnavailable};return nil
}
