package account

import (
 "context"
 "crypto/rand"
 "crypto/sha256"
 "crypto/subtle"
 "database/sql"
 "encoding/base64"
 "errors"
 "net"
 "net/url"
 "regexp"
 "strings"
 "time"
)

var ErrAuthentication = errors.New("authentication failed")
var localPart = regexp.MustCompile("^[A-Za-z0-9!#$%&'*+/=?^_{|}~.-]+$")
var domainLabel = regexp.MustCompile("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")

func validDomain(s string) bool {
 if len(s)>253 || !strings.Contains(s,".") || net.ParseIP(s)!=nil{return false}
 for _,label:=range strings.Split(s,"."){if !domainLabel.MatchString(label){return false}}
 return true
}
func normalizeEmail(raw string)(string,error){
 raw=strings.TrimSpace(raw)
 if len(raw)>254||strings.Count(raw,"@")!=1{return "",ErrInvalid}
 parts:=strings.Split(raw,"@");local,domain:=parts[0],strings.ToLower(parts[1])
 if len(local)>64||!localPart.MatchString(local)||strings.HasPrefix(local,".")||strings.HasSuffix(local,".")||strings.Contains(local,"..")||!validDomain(domain){return "",ErrInvalid}
 return local+"@"+domain,nil
}
func randomBytes()([]byte,error){b:=make([]byte,32);_,err:=rand.Read(b);return b,err}
func encodeBytes(b []byte)string{return base64.RawURLEncoding.EncodeToString(b)}
func decodeToken(s string)([]byte,error){
 if len(s)!=43{return nil,ErrAuthentication}
 b,err:=base64.RawURLEncoding.Strict().DecodeString(s)
 if err!=nil||len(b)!=32||encodeBytes(b)!=s{return nil,ErrAuthentication};return b,nil
}

// Mailer is a private configured transactional delivery boundary. Never log
// the secret or return it to the initiating browser.
type Mailer interface { SendVerification(context.Context,string,string) error }
type Auth struct {store *Store; mail Mailer; origin,rp string}
func NewAuth(s *Store,m Mailer,origin,rp string)(*Auth,error){
 u,e:=url.Parse(origin)
 if s==nil||m==nil||e!=nil||u.Scheme!="https"||u.User!=nil||u.Host!=rp||u.Path!=""||u.RawQuery!=""||u.ForceQuery||u.Fragment!=""||origin!="https://"+rp||!validDomain(rp){return nil,ErrInvalid}
 return &Auth{s,m,origin,rp},nil
}
// Authentication is an ephemeral server-only result, not a browser token,
// session, recovery credential or financial permission.
type Authentication struct {id AccountID; revision int64; method string; proofID string; issuer *Auth; issued time.Time}
func (p Authentication) AccountID()AccountID{return p.id}
func (p Authentication) Revision()int64{return p.revision}
func (p Authentication) Method()string{return p.method}

type EmailStart struct {ChallengeID string `json:"challengeId"`}
func (a *Auth) BeginEmail(ctx context.Context,raw string)(EmailStart,error){
 email,e:=normalizeEmail(raw);if e!=nil{return EmailStart{},e}
 id,e:=newID();if e!=nil{return EmailStart{},e};token,e:=randomBytes();if e!=nil{return EmailStart{},e}
 digest:=sha256.Sum256(token)
 tx,e:=a.store.db.BeginTx(ctx,nil);if e!=nil{return EmailStart{},e};defer tx.Rollback()
 var allowed string
 e=tx.QueryRowContext(ctx,"INSERT INTO account420.email_throttle(email,last_sent) VALUES($1,clock_timestamp()) ON CONFLICT(email) DO UPDATE SET last_sent=clock_timestamp() WHERE account420.email_throttle.last_sent < clock_timestamp()-interval '60 seconds' RETURNING email",email).Scan(&allowed)
 if errors.Is(e,sql.ErrNoRows){return EmailStart{},ErrUnavailable};if e!=nil{return EmailStart{},e}
 if _,e=tx.ExecContext(ctx,"UPDATE account420.email_challenges SET consumed=true WHERE email=$1 AND NOT consumed",email);e!=nil{return EmailStart{},e}
 if _,e=tx.ExecContext(ctx,"INSERT INTO account420.email_challenges(id,email,digest,expires_at) VALUES($1,$2,$3,clock_timestamp()+interval '10 minutes')",id,email,digest[:]);e!=nil{return EmailStart{},e}
 if e=tx.Commit();e!=nil{return EmailStart{},e}
 if e=a.mail.SendVerification(ctx,email,encodeBytes(token));e!=nil{
  clean,cancel:=context.WithTimeout(context.WithoutCancel(ctx),3*time.Second);defer cancel()
  _,_=a.store.db.ExecContext(clean,"UPDATE account420.email_challenges SET consumed=true WHERE id=$1",id)
  return EmailStart{},ErrUnavailable
 }
 return EmailStart{id},nil
}
type RegistrationOptions struct {
 ChallengeID string `json:"challengeId"`
 Challenge string `json:"challenge"`
 RPID string `json:"rpId"`
 UserHandle string `json:"userHandle"`
 UserName string `json:"userName"`
}
type EmailResult struct {
 Proof Authentication `json:"-"`
 Registration *RegistrationOptions `json:"registration,omitempty"`
}

// FinishEmail verifies mailbox possession before atomically creating or
// resolving an account and authorizing initial passkey enrollment.
func (a *Auth) FinishEmail(ctx context.Context,id,secret string)(EmailResult,error){
 if !validID(id){return EmailResult{},ErrAuthentication}
 token,e:=decodeToken(secret);if e!=nil{return EmailResult{},e}
 digest:=sha256.Sum256(token)
 tx,e:=a.store.db.BeginTx(ctx,nil);if e!=nil{return EmailResult{},e};defer tx.Rollback()
 var email string
 e=tx.QueryRowContext(ctx,"SELECT email FROM account420.email_challenges WHERE id=$1",id).Scan(&email)
 if errors.Is(e,sql.ErrNoRows){return EmailResult{},ErrAuthentication};if e!=nil{return EmailResult{},e}
 var lock string
 if e=tx.QueryRowContext(ctx,"SELECT email FROM account420.email_throttle WHERE email=$1 FOR UPDATE",email).Scan(&lock);e!=nil{return EmailResult{},e}
 var stored []byte;var attempts int;var live bool
 e=tx.QueryRowContext(ctx,"SELECT digest,attempts,(NOT consumed AND expires_at>clock_timestamp()) FROM account420.email_challenges WHERE id=$1 FOR UPDATE",id).Scan(&stored,&attempts,&live)
 if errors.Is(e,sql.ErrNoRows){return EmailResult{},ErrAuthentication};if e!=nil{return EmailResult{},e}
 if !live||attempts>=5{return EmailResult{},ErrAuthentication}
 if subtle.ConstantTimeCompare(stored,digest[:])!=1{
  if _,e=tx.ExecContext(ctx,"UPDATE account420.email_challenges SET attempts=attempts+1,consumed=(attempts+1>=5) WHERE id=$1",id);e!=nil{return EmailResult{},e}
  if e=tx.Commit();e!=nil{return EmailResult{},e};return EmailResult{},ErrAuthentication
 }
 if _,e=tx.ExecContext(ctx,"UPDATE account420.email_challenges SET consumed=true WHERE id=$1",id);e!=nil{return EmailResult{},e}
 var acc Account;var handle []byte
 e=tx.QueryRowContext(ctx,"SELECT a.id,a.status,a.revision,i.user_handle FROM account420.email_identities i JOIN account420.accounts a ON a.id=i.account_id WHERE i.email=$1 FOR UPDATE OF a",email).Scan(&acc.ID,&acc.Status,&acc.Revision,&handle)
 if errors.Is(e,sql.ErrNoRows){
  newAccount,err:=newID();if err!=nil{return EmailResult{},err};handle,err=randomBytes();if err!=nil{return EmailResult{},err}
  e=tx.QueryRowContext(ctx,"INSERT INTO account420.accounts(id) VALUES($1) RETURNING id,status,revision",newAccount).Scan(&acc.ID,&acc.Status,&acc.Revision);if e!=nil{return EmailResult{},e}
  if _,e=tx.ExecContext(ctx,"INSERT INTO account420.email_identities(email,account_id,user_handle) VALUES($1,$2,$3)",email,acc.ID,handle);e!=nil{return EmailResult{},e}
 } else if e!=nil{return EmailResult{},e}
 if acc.Status!=Active{if e=tx.Commit();e!=nil{return EmailResult{},e};return EmailResult{},ErrAuthentication}
 result:=EmailResult{Proof:Authentication{id:acc.ID,revision:acc.Revision,method:"email",proofID:id,issuer:a,issued:time.Now()}}
 var already bool
 if e=tx.QueryRowContext(ctx,"SELECT EXISTS(SELECT 1 FROM account420.passkeys WHERE account_id=$1 AND rp_id=$2)",acc.ID,a.rp).Scan(&already);e!=nil{return EmailResult{},e}
 if !already{
  cid,err:=newID();if err!=nil{return EmailResult{},err};challenge,err:=randomBytes();if err!=nil{return EmailResult{},err}
  if _,e=tx.ExecContext(ctx,"DELETE FROM account420.passkey_challenges WHERE purpose='register' AND account_id=$1 AND rp_id=$2",acc.ID,a.rp);e!=nil{return EmailResult{},e}
  if _,e=tx.ExecContext(ctx,"INSERT INTO account420.passkey_challenges(id,purpose,challenge,origin,rp_id,account_id,account_revision,expires_at) VALUES($1,'register',$2,$3,$4,$5,$6,clock_timestamp()+interval '5 minutes')",cid,challenge,a.origin,a.rp,acc.ID,acc.Revision);e!=nil{return EmailResult{},e}
  result.Registration=&RegistrationOptions{cid,encodeBytes(challenge),a.rp,encodeBytes(handle),email}
 }
 if e=tx.Commit();e!=nil{return EmailResult{},e};return result,nil
}

type LoginOptions struct {ChallengeID string `json:"challengeId"`;Challenge string `json:"challenge"`;RPID string `json:"rpId"`}
func (a *Auth) BeginPasskeyLogin(ctx context.Context)(LoginOptions,error){
 id,e:=newID();if e!=nil{return LoginOptions{},e};challenge,e:=randomBytes();if e!=nil{return LoginOptions{},e}
 _,e=a.store.db.ExecContext(ctx,"INSERT INTO account420.passkey_challenges(id,purpose,challenge,origin,rp_id,expires_at) VALUES($1,'login',$2,$3,$4,clock_timestamp()+interval '5 minutes')",id,challenge,a.origin,a.rp)
 if e!=nil{return LoginOptions{},e};return LoginOptions{id,encodeBytes(challenge),a.rp},nil
}
type ceremony struct{challenge []byte;account AccountID;revision int64}
func (a *Auth) take(ctx context.Context,id,purpose string)(ceremony,error){
 if !validID(id){return ceremony{},ErrAuthentication}
 var c ceremony;var account sql.NullString;var revision sql.NullInt64
 e:=a.store.db.QueryRowContext(ctx,"DELETE FROM account420.passkey_challenges WHERE id=$1 AND purpose=$2 AND origin=$3 AND rp_id=$4 AND expires_at>clock_timestamp() RETURNING challenge,account_id,account_revision",id,purpose,a.origin,a.rp).Scan(&c.challenge,&account,&revision)
 if errors.Is(e,sql.ErrNoRows){return ceremony{},ErrAuthentication};if e!=nil{return ceremony{},e}
 c.account=AccountID(account.String);c.revision=revision.Int64;return c,nil
}
type RegistrationResponse struct {CredentialID,ClientDataJSON,AttestationObject []byte}
func (a *Auth) FinishPasskeyRegistration(ctx context.Context,id string,r RegistrationResponse)error{
 c,e:=a.take(ctx,id,"register");if e!=nil{return e}
 key,count,backup,e:=verifyRegistration(a.origin,a.rp,c.challenge,r);if e!=nil{return e}
 tx,e:=a.store.db.BeginTx(ctx,nil);if e!=nil{return e};defer tx.Rollback()
 var status Status;var revision int64
 e=tx.QueryRowContext(ctx,"SELECT status,revision FROM account420.accounts WHERE id=$1 FOR UPDATE",c.account).Scan(&status,&revision)
 if errors.Is(e,sql.ErrNoRows)||e==nil&&(status!=Active||revision!=c.revision){return ErrAuthentication};if e!=nil{return e}
 result,e:=tx.ExecContext(ctx,"INSERT INTO account420.passkeys(credential_id,account_id,rp_id,public_key,sign_count,backup_eligible) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",r.CredentialID,c.account,a.rp,key,int64(count),backup)
 if e!=nil{return e};n,e:=result.RowsAffected();if e!=nil{return e};if n!=1{return ErrAuthentication}
 return tx.Commit()
}
type AssertionResponse struct {CredentialID,ClientDataJSON,AuthenticatorData,Signature,UserHandle []byte}
func (a *Auth) FinishPasskeyLogin(ctx context.Context,id string,r AssertionResponse)(Authentication,error){
 c,e:=a.take(ctx,id,"login");if e!=nil{return Authentication{},e}
 if len(r.CredentialID)==0||len(r.CredentialID)>1023||len(r.UserHandle)!=32{return Authentication{},ErrAuthentication}
 tx,e:=a.store.db.BeginTx(ctx,nil);if e!=nil{return Authentication{},e};defer tx.Rollback()
 var acc Account;var handle,key []byte;var count int64;var backup bool
 e=tx.QueryRowContext(ctx,"SELECT a.id,a.status,a.revision,i.user_handle,p.public_key,p.sign_count,p.backup_eligible FROM account420.passkeys p JOIN account420.accounts a ON a.id=p.account_id JOIN account420.email_identities i ON i.account_id=a.id WHERE p.credential_id=$1 AND p.rp_id=$2 FOR UPDATE OF a,p",r.CredentialID,a.rp).Scan(&acc.ID,&acc.Status,&acc.Revision,&handle,&key,&count,&backup)
 if errors.Is(e,sql.ErrNoRows)||e==nil&&(acc.Status!=Active||subtle.ConstantTimeCompare(handle,r.UserHandle)!=1){return Authentication{},ErrAuthentication};if e!=nil{return Authentication{},e}
 next,e:=verifyAssertion(a.origin,a.rp,c.challenge,r,key,uint32(count),backup);if e!=nil{return Authentication{},e}
 if _,e=tx.ExecContext(ctx,"UPDATE account420.passkeys SET sign_count=$2 WHERE credential_id=$1",r.CredentialID,int64(next));e!=nil{return Authentication{},e}
 if e=tx.Commit();e!=nil{return Authentication{},e};return Authentication{id:acc.ID,revision:acc.Revision,method:"passkey",proofID:id,issuer:a,issued:time.Now()},nil
}

// PurgeExpired is an internal operator job; no account or credential deleted.
func (a *Auth) PurgeExpired(ctx context.Context)error{
 tx,e:=a.store.db.BeginTx(ctx,nil);if e!=nil{return e};defer tx.Rollback()
 for _,q:=range []string{
 "DELETE FROM account420.email_challenges WHERE expires_at<=clock_timestamp()",
 "DELETE FROM account420.passkey_challenges WHERE expires_at<=clock_timestamp()",
 "DELETE FROM account420.email_throttle t WHERE t.last_sent<clock_timestamp()-interval '1 day' AND NOT EXISTS(SELECT 1 FROM account420.email_challenges c WHERE c.email=t.email)",
 }{if _,e=tx.ExecContext(ctx,q);e!=nil{return e}}
 return tx.Commit()
}
