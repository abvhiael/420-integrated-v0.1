package account

import (
 "context"
 "crypto/sha256"
 "database/sql"
 "errors"
 "time"
)

// SessionManager is a trusted server dependency bound to a single approved
// application and exact Auth/RP. No cross-app token exchange or wallet rights.
type SessionManager struct {
 auth *Auth
 app string
}

func NewSessionManager(auth *Auth, app string) (*SessionManager,error) {
 if auth==nil || !auth.store.allowed(app) {return nil,ErrInvalid}
 return &SessionManager{auth:auth,app:app},nil
}

// Session is a public, app-scoped projection. The token is never serialized.
// Session IDs are management references, not authentication secrets.
type Session struct {
 ID string `json:"id"`
 Subject Subject `json:"subject"`
 Method string `json:"method"`
 IssuedAt time.Time `json:"issuedAt"`
 IdleUntil time.Time `json:"idleUntil"`
 ExpiresAt time.Time `json:"expiresAt"`
}
type SessionGrant struct {
 Session Session `json:"session"`
 Token string `json:"-"`
}
type sessionRecord struct {
 Session
 account AccountID
 revision int64
}
const sessionColumns = "s.id,p.app_id,p.subject_id,s.method,s.issued_at,s.idle_until,s.expires_at,s.account_id,s.account_revision"
func scanSession(row interface{Scan(...any) error})(sessionRecord,error){
 var s sessionRecord
 e:=row.Scan(&s.ID,&s.Subject.App,&s.Subject.ID,&s.Method,&s.IssuedAt,&s.IdleUntil,&s.ExpiresAt,&s.account,&s.revision)
 if errors.Is(e,sql.ErrNoRows){e=ErrAuthentication}
 return s,e
}

func (m *SessionManager) lockAccount(ctx context.Context,tx *sql.Tx,id AccountID)(int64,error){
 var revision int64
 e:=tx.QueryRowContext(ctx,"SELECT revision FROM account420.accounts WHERE id=$1 AND status='active' FOR UPDATE",id).Scan(&revision)
 if errors.Is(e,sql.ErrNoRows){e=ErrAuthentication}
 return revision,e
}

// consumeProof is called under the account lock, in the same transaction as
// issuance/recovery. AUTH-2 proofs are ephemeral and can be consumed once even
// if copied by a trusted caller. No browser-supplied proof is accepted.
func (m *SessionManager) consumeProof(ctx context.Context,tx *sql.Tx,p Authentication,revision int64)error{
 if p.issuer!=m.auth||!validID(p.proofID)||!validID(string(p.id))||p.revision!=revision||
  (p.method!="email"&&p.method!="passkey")||p.issued.IsZero()||time.Since(p.issued)<0||time.Since(p.issued)>=5*time.Minute{return ErrAuthentication}
 result,e:=tx.ExecContext(ctx,"INSERT INTO account420.session_proof_uses(proof_id,expires_at) VALUES($1,clock_timestamp()+interval '10 minutes') ON CONFLICT DO NOTHING",p.proofID)
 if e!=nil{return e}
 n,e:=result.RowsAffected();if e!=nil{return e};if n!=1{return ErrAuthentication}
 return nil
}

func tokenDigest(token string)([]byte,error){
 b,e:=decodeToken(token);if e!=nil{return nil,e};d:=sha256.Sum256(b);return d[:],nil
}
func newSessionToken()(string,[]byte,error){
 b,e:=randomBytes();if e!=nil{return "",nil,e};d:=sha256.Sum256(b);return encodeBytes(b),d[:],nil
}

// Issue consumes a fresh verified AUTH-2 result. Idle limit 24 hours, hard
// lifetime seven days, both enforced by PostgreSQL time. Issuance never accepts
// an account ID, app scope, revision or authority supplied by the browser.
func (m *SessionManager) Issue(ctx context.Context,p Authentication)(SessionGrant,error){
 if p.issuer!=m.auth||!validID(string(p.id)){return SessionGrant{},ErrAuthentication}
 tx,e:=m.auth.store.db.BeginTx(ctx,nil);if e!=nil{return SessionGrant{},e};defer tx.Rollback()
 rev,e:=m.lockAccount(ctx,tx,p.id);if e!=nil{return SessionGrant{},e}
 if e=m.consumeProof(ctx,tx,p,rev);e!=nil{return SessionGrant{},e}
 subject,e:=newID();if e!=nil{return SessionGrant{},e}
 if _,e=tx.ExecContext(ctx,"INSERT INTO account420.app_subjects(account_id,app_id,subject_id) VALUES($1,$2,$3) ON CONFLICT(account_id,app_id) DO NOTHING",p.id,m.app,subject);e!=nil{return SessionGrant{},e}
 id,e:=newID();if e!=nil{return SessionGrant{},e}
 token,digest,e:=newSessionToken();if e!=nil{return SessionGrant{},e}
 s,e:=scanSession(tx.QueryRowContext(ctx,`WITH inserted AS (
 INSERT INTO account420.sessions(id,account_id,app_id,account_revision,token_digest,method,issued_at,idle_until,expires_at)
 VALUES($1,$2,$3,$4,$5,$6,statement_timestamp(),statement_timestamp()+interval '24 hours',statement_timestamp()+interval '7 days') RETURNING *)
 SELECT `+sessionColumns+` FROM inserted s JOIN account420.app_subjects p ON p.account_id=s.account_id AND p.app_id=s.app_id`,id,p.id,m.app,rev,digest,p.method))
 if e!=nil{return SessionGrant{},e};if e=tx.Commit();e!=nil{return SessionGrant{},e}
 return SessionGrant{s.Session,token},nil
}

const liveSession = "s.revoked_at IS NULL AND s.idle_until>clock_timestamp() AND s.expires_at>clock_timestamp() AND a.status='active' AND a.revision=s.account_revision"
const sessionJoin = " FROM account420.sessions s JOIN account420.accounts a ON a.id=s.account_id JOIN account420.app_subjects p ON p.account_id=s.account_id AND p.app_id=s.app_id WHERE s.token_digest=$1 AND s.app_id=$2 AND "+liveSession

// Validate rechecks lifecycle, revision and expiry on every use. The returned
// projection is not a durable grant: consumers must validate each request.
func (m *SessionManager) Validate(ctx context.Context,token string)(Session,error){
 d,e:=tokenDigest(token);if e!=nil{return Session{},e}
 s,e:=scanSession(m.auth.store.db.QueryRowContext(ctx,"SELECT "+sessionColumns+sessionJoin,d,m.app))
 return s.Session,e
}

// Every mutating operation acquires the account lock first, then rereads the
// token row. This serializes issuance, rotation, revocation and recovery with
// lifecycle transitions, even across independent database connections.
func (m *SessionManager) lockedSession(ctx context.Context,tx *sql.Tx,token string)(sessionRecord,error){
 d,e:=tokenDigest(token);if e!=nil{return sessionRecord{},e}
 var id AccountID
 e=tx.QueryRowContext(ctx,"SELECT account_id FROM account420.sessions WHERE token_digest=$1 AND app_id=$2",d,m.app).Scan(&id)
 if errors.Is(e,sql.ErrNoRows){return sessionRecord{},ErrAuthentication};if e!=nil{return sessionRecord{},e}
 if _,e=m.lockAccount(ctx,tx,id);e!=nil{return sessionRecord{},e}
 return scanSession(tx.QueryRowContext(ctx,"SELECT "+sessionColumns+sessionJoin+" FOR UPDATE OF s",d,m.app))
}

// Renew rotates the bearer atomically. Old tokens immediately cease to work;
// renewal cannot extend the original hard expiry or revive an expired token.
func (m *SessionManager) Renew(ctx context.Context,token string)(SessionGrant,error){
 tx,e:=m.auth.store.db.BeginTx(ctx,nil);if e!=nil{return SessionGrant{},e};defer tx.Rollback()
 s,e:=m.lockedSession(ctx,tx,token);if e!=nil{return SessionGrant{},e}
 fresh,d,e:=newSessionToken();if e!=nil{return SessionGrant{},e}
 e=tx.QueryRowContext(ctx,"UPDATE account420.sessions SET token_digest=$2,idle_until=LEAST(clock_timestamp()+interval '24 hours',expires_at) WHERE id=$1 AND idle_until>clock_timestamp() AND expires_at>clock_timestamp() RETURNING idle_until",s.ID,d).Scan(&s.IdleUntil)
 if errors.Is(e,sql.ErrNoRows){e=ErrAuthentication};if e!=nil{return SessionGrant{},e}
 if e=tx.Commit();e!=nil{return SessionGrant{},e}
 return SessionGrant{s.Session,fresh},nil
}

// List returns only current sessions of the authenticated account/application.
func (m *SessionManager) List(ctx context.Context,token string)([]Session,error){
 tx,e:=m.auth.store.db.BeginTx(ctx,nil);if e!=nil{return nil,e};defer tx.Rollback()
 s,e:=m.lockedSession(ctx,tx,token);if e!=nil{return nil,e}
 rows,e:=tx.QueryContext(ctx,"SELECT "+sessionColumns+" FROM account420.sessions s JOIN account420.accounts a ON a.id=s.account_id JOIN account420.app_subjects p ON p.account_id=s.account_id AND p.app_id=s.app_id WHERE s.account_id=$1 AND s.app_id=$2 AND "+liveSession+" ORDER BY s.issued_at,s.id LIMIT 100",s.account,m.app)
 if e!=nil{return nil,e};defer rows.Close()
 result:=[]Session{}
 for rows.Next(){v,e:=scanSession(rows);if e!=nil{return nil,e};result=append(result,v.Session)}
 if e=rows.Err();e!=nil{return nil,e};if e=rows.Close();e!=nil{return nil,e}
 if e=tx.Commit();e!=nil{return nil,e};return result,nil
}

// Revoke removes the specified session only within the current account/app.
// Passing the current session ID is logout. RevokeAll signs out the account's
// sessions for this app; it does not grant access to any other application.
func (m *SessionManager) Revoke(ctx context.Context,token,target string)error{
 if !validID(target){return ErrAuthentication}
 return m.revoke(ctx,token,target,false,false)
}
func (m *SessionManager) Logout(ctx context.Context,token string)error{return m.revoke(ctx,token,"",false,true)}
func (m *SessionManager) RevokeAll(ctx context.Context,token string)error{return m.revoke(ctx,token,"",true,false)}
func (m *SessionManager) revoke(ctx context.Context,token,target string,all,self bool)error{
 tx,e:=m.auth.store.db.BeginTx(ctx,nil);if e!=nil{return e};defer tx.Rollback()
 s,e:=m.lockedSession(ctx,tx,token);if e!=nil{return e}
 if self{target=s.ID}
 var r sql.Result
 if all{r,e=tx.ExecContext(ctx,"UPDATE account420.sessions SET revoked_at=clock_timestamp() WHERE account_id=$1 AND app_id=$2 AND revoked_at IS NULL",s.account,m.app)}else{r,e=tx.ExecContext(ctx,"UPDATE account420.sessions SET revoked_at=clock_timestamp() WHERE account_id=$1 AND app_id=$2 AND id=$3 AND revoked_at IS NULL",s.account,m.app,target)}
 if e!=nil{return e};n,e:=r.RowsAffected();if e!=nil{return e};if n==0{return ErrAuthentication};return tx.Commit()
}

func (m *SessionManager) PurgeExpired(ctx context.Context)error{
 tx,e:=m.auth.store.db.BeginTx(ctx,nil);if e!=nil{return e};defer tx.Rollback()
 for _,q:=range []string{
  "DELETE FROM account420.session_proof_uses WHERE expires_at<=clock_timestamp()",
  "DELETE FROM account420.recovery_challenges WHERE expires_at<=clock_timestamp()",
  "DELETE FROM account420.sessions WHERE expires_at<=clock_timestamp() OR idle_until<=clock_timestamp() OR revoked_at IS NOT NULL",
 }{if _,e=tx.ExecContext(ctx,q);e!=nil{return e}}
 return tx.Commit()
}
