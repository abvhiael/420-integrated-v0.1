package account

import (
 "bytes"
 "context"
 "database/sql"
 "encoding/hex"
 "errors"
 "fmt"
 "strings"
 "time"
)

// WalletLink is private owner-only application data, NEVER an authentication
// principal, payment capability, wallet permission or public profile property.
type WalletLink struct {
 Address string `json:"address"`
 ChainID int64 `json:"chainId"`
 Kind string `json:"kind"`
 LinkedAt time.Time `json:"linkedAt"`
}
type WalletLinkChallenge struct {
 ChallengeID string `json:"challengeId"`
 Address string `json:"address"`
 ChainID int64 `json:"chainId"`
 Kind string `json:"kind"`
 Message string `json:"message"`
 ExpiresAt time.Time `json:"expiresAt"`
}

// ContractSignatureVerifier must verify EIP-1271 at a chain-pinned finalized
// state with real contract code. No fallback to a mock, stale RPC or EOA
// signature when a contract account was requested.
type ContractSignatureVerifier interface {
 VerifyContractSignature(ctx context.Context,chainID int64,address,message,signature string)(bool,error)
}

type WalletLinkManager struct {
 sessions *SessionManager
 chainID int64
 contract ContractSignatureVerifier
}

func NewWalletLinkManager(sessions *SessionManager,chainID int64,contract ContractSignatureVerifier)(*WalletLinkManager,error){
 if sessions==nil||sessions.auth==nil||chainID<=0{return nil,ErrInvalid}
 return &WalletLinkManager{sessions:sessions,chainID:chainID,contract:contract},nil
}

func canonicalWalletAddress(address string)(string,error){
 if len(address)!=42||!strings.HasPrefix(address,"0x"){return "",ErrInvalid}
 decoded,e:=hex.DecodeString(address[2:]);if e!=nil||len(decoded)!=20{return "",ErrInvalid}
 zero:=true;for _,b:=range decoded{if b!=0{zero=false}}
 if zero{return "",ErrInvalid}
 return strings.ToLower(address),nil
}
func validWalletKind(kind string)bool{return kind=="eoa"||kind=="contract"}
func validWalletSignature(kind,sig string)bool{
 if !strings.HasPrefix(sig,"0x")||len(sig)>4098||len(sig)<132||len(sig)%2!=0{return false}
 if kind=="eoa"&&len(sig)!=132{return false}
 _,e:=hex.DecodeString(sig[2:]);return e==nil
}

// This exact message is the sole signable authority. It commits to the
// HTTPS origin, RP, application-scoped subject, session, fixed server chain,
// wallet, short DB-time expiry and nonce. It cannot be reused as a generic
// transaction, login, wallet permission or later challenge.
func walletLinkMessage(s *SessionManager,session sessionRecord,chainID int64,address,kind,nonce string,expires int64)string{
 return fmt.Sprintf("420ID Optional Wallet Link\nVersion: 1\nOrigin: %s\nRP: %s\nApplication: %s\nSubject: %s\nSession: %s\nChain ID: %d\nWallet: %s\nWallet Kind: %s\nNonce: %s\nExpires (Unix): %d\nPurpose: associate this wallet with an existing 420ID account ONLY. No account login, wallet capability, transaction, spending, profile publication, name ownership or on-chain authorization.",s.auth.origin,s.auth.rp,s.app,session.Subject.ID,session.ID,chainID,address,kind,nonce,expires)
}

func (w *WalletLinkManager) Begin(ctx context.Context,sessionToken,address,kind string,consent bool,browserDigest []byte)(WalletLinkChallenge,error){
 canonical,e:=canonicalWalletAddress(address)
 if e!=nil||!validWalletKind(kind)||!consent||len(browserDigest)!=32{return WalletLinkChallenge{},ErrInvalid}
 if kind=="contract"&&w.contract==nil{return WalletLinkChallenge{},ErrUnavailable}
 db:=w.sessions.auth.store.db
 tx,e:=db.BeginTx(ctx,nil);if e!=nil{return WalletLinkChallenge{},e};defer tx.Rollback()
 session,e:=w.sessions.lockedSession(ctx,tx,sessionToken);if e!=nil{return WalletLinkChallenge{},e}
 var hasActive bool
 e=tx.QueryRowContext(ctx,"SELECT EXISTS(SELECT 1 FROM account420.wallet_links WHERE account_id=$1 AND unlinked_at IS NULL)",session.account).Scan(&hasActive)
 if e!=nil{return WalletLinkChallenge{},e};if hasActive{return WalletLinkChallenge{},ErrConflict}
 id,e:=newID();if e!=nil{return WalletLinkChallenge{},e}
 nonce,e:=randomBytes();if e!=nil{return WalletLinkChallenge{},e}
 var unix int64
 e=tx.QueryRowContext(ctx,"SELECT floor(extract(epoch from clock_timestamp()))::bigint").Scan(&unix)
 if e!=nil{return WalletLinkChallenge{},e}
 expires:=unix+300
 msg:=walletLinkMessage(w.sessions,session,w.chainID,canonical,kind,encodeBytes(nonce),expires)
 // Supersede any earlier challenge for this account+app+RP. A challenge
 // cannot survive replacement by a later user-authorized consent.
 _,e=tx.ExecContext(ctx,`INSERT INTO account420.wallet_link_challenges
 (id,account_id,account_revision,session_id,app_id,rp_id,chain_id,wallet_address,kind,browser_digest,nonce,message,expires_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,to_timestamp($13))
 ON CONFLICT(account_id,app_id,rp_id) DO UPDATE SET id=EXCLUDED.id,account_revision=EXCLUDED.account_revision,
 session_id=EXCLUDED.session_id,chain_id=EXCLUDED.chain_id,wallet_address=EXCLUDED.wallet_address,
 kind=EXCLUDED.kind,browser_digest=EXCLUDED.browser_digest,nonce=EXCLUDED.nonce,
 message=EXCLUDED.message,expires_at=EXCLUDED.expires_at`,
 id,session.account,session.revision,session.ID,w.sessions.app,w.sessions.auth.rp,w.chainID,canonical,kind,browserDigest,nonce,msg,expires)
 if e!=nil{return WalletLinkChallenge{},e}
 if e=tx.Commit();e!=nil{return WalletLinkChallenge{},e}
 return WalletLinkChallenge{ChallengeID:id,Address:canonical,ChainID:w.chainID,Kind:kind,Message:msg,ExpiresAt:time.Unix(expires,0).UTC()},nil
}

type storedWalletChallenge struct{
 id string
 account AccountID
 revision int64
 sessionID string
 address string
 kind string
 msg string
 digest []byte
 expires time.Time
}
func (w *WalletLinkManager) challenge(ctx context.Context,id string)(storedWalletChallenge,error){
 var c storedWalletChallenge
 if !validID(id){return c,ErrAuthentication}
 e:=w.sessions.auth.store.db.QueryRowContext(ctx,`SELECT id,account_id,account_revision,session_id,wallet_address,kind,message,browser_digest,expires_at
 FROM account420.wallet_link_challenges
 WHERE id=$1 AND app_id=$2 AND rp_id=$3 AND chain_id=$4 AND expires_at>clock_timestamp()`,id,w.sessions.app,w.sessions.auth.rp,w.chainID).
 Scan(&c.id,&c.account,&c.revision,&c.sessionID,&c.address,&c.kind,&c.msg,&c.digest,&c.expires)
 if errors.Is(e,sql.ErrNoRows){return c,ErrAuthentication}
 return c,e
}

// Complete validates real wallet cryptography independently from the
// authenticated 420ID session, then rechecks the entire challenge under the
// account lock and atomically consumes the nonce with the unique link insert.
// Failed verification neither grants access nor replaces an existing link.
func (w *WalletLinkManager) Complete(ctx context.Context,token,challengeID,signature string,browserDigest []byte)(WalletLink,error){
 var empty WalletLink
 if len(browserDigest)!=32||!validID(challengeID){return empty,ErrAuthentication}
 c,e:=w.challenge(ctx,challengeID);if e!=nil{return empty,e}
 if !bytes.Equal(c.digest,browserDigest)||!validWalletSignature(c.kind,signature){return empty,ErrAuthentication}
 valid:=false
 if c.kind=="eoa"{valid=verifyEOAWallet(c.msg,c.address,signature)
 }else if c.kind=="contract"&&w.contract!=nil{
  valid,e=w.contract.VerifyContractSignature(ctx,w.chainID,c.address,c.msg,signature)
  if e!=nil{return empty,ErrUnavailable}
 }
 if !valid{return empty,ErrAuthentication}
 tx,e:=w.sessions.auth.store.db.BeginTx(ctx,nil);if e!=nil{return empty,e};defer tx.Rollback()
 s,e:=w.sessions.lockedSession(ctx,tx,token);if e!=nil{return empty,e}
 if s.account!=c.account||s.ID!=c.sessionID||s.revision!=c.revision{return empty,ErrAuthentication}
 var id string
 // Recheck against the immutable pre-verification snapshot, preventing
 // substituted challenges, concurrent supersession and rollback/replay.
 e=tx.QueryRowContext(ctx,`DELETE FROM account420.wallet_link_challenges
 WHERE id=$1 AND account_id=$2 AND account_revision=$3 AND session_id=$4
 AND app_id=$5 AND rp_id=$6 AND chain_id=$7 AND wallet_address=$8
 AND kind=$9 AND browser_digest=$10 AND message=$11 AND expires_at>clock_timestamp()
 RETURNING id`,c.id,c.account,c.revision,c.sessionID,w.sessions.app,w.sessions.auth.rp,w.chainID,c.address,c.kind,browserDigest,c.msg).Scan(&id)
 if errors.Is(e,sql.ErrNoRows){return empty,ErrAuthentication}
 if e!=nil{return empty,e}
 newID,e:=newID();if e!=nil{return empty,e}
 var result WalletLink
 e=tx.QueryRowContext(ctx,`INSERT INTO account420.wallet_links(id,account_id,chain_id,wallet_address,kind)
 VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING
 RETURNING wallet_address,chain_id,kind,linked_at`,newID,s.account,w.chainID,c.address,c.kind).Scan(&result.Address,&result.ChainID,&result.Kind,&result.LinkedAt)
 if errors.Is(e,sql.ErrNoRows){return empty,ErrConflict}
 if e!=nil{return empty,e}
 if e=tx.Commit();e!=nil{return empty,e}
 return result,nil
}

func (w *WalletLinkManager) Current(ctx context.Context,token string)(*WalletLink,error){
 tx,e:=w.sessions.auth.store.db.BeginTx(ctx,nil);if e!=nil{return nil,e};defer tx.Rollback()
 s,e:=w.sessions.lockedSession(ctx,tx,token);if e!=nil{return nil,e}
 var v WalletLink
 e=tx.QueryRowContext(ctx,`SELECT wallet_address,chain_id,kind,linked_at FROM account420.wallet_links
 WHERE account_id=$1 AND unlinked_at IS NULL`,s.account).Scan(&v.Address,&v.ChainID,&v.Kind,&v.LinkedAt)
 if errors.Is(e,sql.ErrNoRows){if e=tx.Commit();e!=nil{return nil,e};return nil,nil}
 if e!=nil{return nil,e}
 if e=tx.Commit();e!=nil{return nil,e}
 return &v,nil
}

// Unlink is only a 420ID-authenticated removal of an association. It cannot
// revoke a blockchain wallet, alter custody, or remove prior history.
func (w *WalletLinkManager) Unlink(ctx context.Context,token string)error{
 tx,e:=w.sessions.auth.store.db.BeginTx(ctx,nil);if e!=nil{return e};defer tx.Rollback()
 s,e:=w.sessions.lockedSession(ctx,tx,token);if e!=nil{return e}
 var id string
 e=tx.QueryRowContext(ctx,`UPDATE account420.wallet_links SET unlinked_at=clock_timestamp()
 WHERE account_id=$1 AND unlinked_at IS NULL RETURNING id`,s.account).Scan(&id)
 if errors.Is(e,sql.ErrNoRows){return ErrUnavailable}
 if e!=nil{return e}
 if _,e=tx.ExecContext(ctx,"DELETE FROM account420.wallet_link_challenges WHERE account_id=$1",s.account);e!=nil{return e}
 return tx.Commit()
}
func (w *WalletLinkManager) Purge(ctx context.Context)error{
 _,e:=w.sessions.auth.store.db.ExecContext(ctx,"DELETE FROM account420.wallet_link_challenges WHERE expires_at<=clock_timestamp()")
 return e
}
func (w *WalletLinkManager) Ready(ctx context.Context)error{
 var ok bool
 e:=w.sessions.auth.store.db.QueryRowContext(ctx,`SELECT
  COALESCE(has_table_privilege(current_user,to_regclass('account420.wallet_links'),'SELECT,INSERT,UPDATE'),false)
  AND COALESCE(has_table_privilege(current_user,to_regclass('account420.wallet_link_challenges'),'SELECT,INSERT,UPDATE,DELETE'),false)`).Scan(&ok)
 if e!=nil{return e}
 if !ok{return ErrUnavailable}
 return nil
}
