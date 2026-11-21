package account

import (
 "context"
 "crypto/sha256"
 "crypto/subtle"
 "database/sql"
 "errors"
 "net"
 "net/url"
 "regexp"
 "strings"
 "time"
)

// SSO never treats a wallet signature, on-chain identity, or the source
// application's subject as a login to another application. Applications
// receive a fresh, separately revocable app-scoped AUTH-3 session only after
// user consent, short-lived one-use code, PKCE, and confidential authentication.
type SSOClient struct {
 App string `json:"app"`
 Name string `json:"name"`
 RedirectURI string `json:"redirectUri"`
 Secret string `json:"secret"`
}
type ssoClient struct {
 app,name,redirect string
 secretHash [32]byte
}
type SSOManager struct {
 source *SessionManager
 clients map[string]ssoClient
 monetization *MonetizationManager // nil in all AUTH-7 and prior modes
}
type SSORequest struct {
 App string `json:"app"`
 RedirectURI string `json:"redirectUri"`
 State string `json:"state"`
 CodeChallenge string `json:"codeChallenge"`
}
type SSOClientInfo struct {
 App string `json:"app"`
 Name string `json:"name"`
 RedirectURI string `json:"redirectUri"`
}
type SSOAuthorization struct {RedirectURI string `json:"redirectUri"`}
type SSOExchange struct {
 AccessToken string `json:"accessToken"`
 TokenType string `json:"tokenType"`
 Session Session `json:"session"`
}
type SSOIntrospection struct {
 Active bool `json:"active"`
 Subject *Subject `json:"subject,omitempty"`
 ExpiresAt time.Time `json:"expiresAt,omitempty"`
 IdleUntil time.Time `json:"idleUntil,omitempty"`
 Method string `json:"method,omitempty"`
 Monetization *MonetizationStatus `json:"monetization,omitempty"` // only explicit BongGoggles consent; not an entitlement
}
var pkceVerifierPattern=regexp.MustCompile(`^[A-Za-z0-9._~-]{43,128}$`)

func validClientRedirect(raw string)bool{
 if len(raw)>512 {return false}
 u,e:=url.Parse(raw)
 if e!=nil||u.Scheme!="https"||u.User!=nil||u.RawQuery!=""||u.ForceQuery||u.Fragment!=""||u.Opaque!=""||
 u.Host==""||u.Port()!=""||u.Path==""||!strings.HasPrefix(u.Path,"/")||u.RawPath!=""||
 net.ParseIP(u.Hostname())!=nil||strings.ToLower(u.Hostname())!=u.Hostname()||
 !strings.HasSuffix(u.Hostname(),".420integrated.org")||u.Hostname()==".420integrated.org"||
 strings.Contains(u.Hostname(),"..")||strings.Contains(u.Path,"//")||strings.Contains(u.Path,"\\")||
 strings.Contains(u.Path,"%")||u.String()!=raw{return false}
 return true
}
func NewSSOManager(source *SessionManager,approved []SSOClient)(*SSOManager,error){
 if source==nil||source.auth==nil||len(approved)==0||len(approved)>20{return nil,ErrInvalid}
 clients:=make(map[string]ssoClient,len(approved))
 usedRedirect:=map[string]bool{}
 usedSecret:=map[[32]byte]bool{}
 for _,c:=range approved{
  secret,e:=decodeToken(c.Secret)
  if e!=nil||!appPattern.MatchString(c.App)||!source.auth.store.allowed(c.App)||
   c.App==source.app||c.Name==""||len(c.Name)>60||strings.TrimSpace(c.Name)!=c.Name||
   strings.ContainsAny(c.Name,"<>\r\n")||!validClientRedirect(c.RedirectURI)||
   usedRedirect[c.RedirectURI]||clients[c.App].app!=""{return nil,ErrInvalid}
  digest:=sha256.Sum256(secret)
  if usedSecret[digest]{return nil,ErrInvalid}
  usedSecret[digest]=true
  clients[c.App]=ssoClient{app:c.App,name:c.Name,redirect:c.RedirectURI,secretHash:digest}
  usedRedirect[c.RedirectURI]=true
 }
 return &SSOManager{source:source,clients:clients},nil
}
func (s *SSOManager) client(app string)(ssoClient,error){
 c,ok:=s.clients[app];if !ok{return ssoClient{},ErrAuthentication};return c,nil
}
func (s *SSOManager) CheckClient(app,secret string)(ssoClient,error){
 c,e:=s.client(app);if e!=nil{return c,e}
 data,e:=decodeToken(secret);if e!=nil{return ssoClient{},ErrAuthentication}
 actual:=sha256.Sum256(data)
 if subtle.ConstantTimeCompare(actual[:],c.secretHash[:])!=1{return ssoClient{},ErrAuthentication}
 return c,nil
}
func (s *SSOManager) ValidateRequest(r SSORequest)(SSOClientInfo,error){
 c,e:=s.client(r.App)
 if e!=nil||r.RedirectURI!=c.redirect{return SSOClientInfo{},ErrInvalid}
 if _,e=decodeToken(r.State);e!=nil{return SSOClientInfo{},ErrInvalid}
 if _,e=decodeToken(r.CodeChallenge);e!=nil{return SSOClientInfo{},ErrInvalid}
 return SSOClientInfo{App:c.app,Name:c.name,RedirectURI:c.redirect},nil
}
func (s *SSOManager) Authorize(ctx context.Context,sourceToken string,r SSORequest,consent bool,browser []byte)(SSOAuthorization,error){
 if !consent||len(browser)!=32{return SSOAuthorization{},ErrInvalid}
 c,e:=s.ValidateRequest(r);if e!=nil{return SSOAuthorization{},e}
 challenge,e:=decodeToken(r.CodeChallenge);if e!=nil{return SSOAuthorization{},ErrInvalid}
 tx,e:=s.source.auth.store.db.BeginTx(ctx,nil);if e!=nil{return SSOAuthorization{},e};defer tx.Rollback()
 owner,e:=s.source.lockedSession(ctx,tx,sourceToken);if e!=nil{return SSOAuthorization{},e}
 if owner.Method=="sso"{return SSOAuthorization{},ErrAuthentication}
 code,e:=randomBytes();if e!=nil{return SSOAuthorization{},e}
 digest:=sha256.Sum256(code)
 // A new explicit consent supersedes any previous outstanding transfer
 // for this source session and application. Account lock serializes races.
 _,e=tx.ExecContext(ctx,`INSERT INTO account420.sso_codes(code_digest,account_id,account_revision,source_session_id,
  client_app,redirect_uri,pkce_digest,browser_digest,expires_at)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp()+interval '90 seconds')
  ON CONFLICT(source_session_id,client_app) DO UPDATE SET
  code_digest=EXCLUDED.code_digest,account_revision=EXCLUDED.account_revision,
  redirect_uri=EXCLUDED.redirect_uri,pkce_digest=EXCLUDED.pkce_digest,
  browser_digest=EXCLUDED.browser_digest,expires_at=EXCLUDED.expires_at`,
  digest[:],owner.account,owner.revision,owner.ID,c.App,c.RedirectURI,challenge,browser)
 if e!=nil{return SSOAuthorization{},e}
 if e=tx.Commit();e!=nil{return SSOAuthorization{},e}
 // Codes carry no account ID, session token or wallet data. The target
 // confidential backend must verify state and exchange with PKCE+secret.
 redirect:=c.RedirectURI+"?code="+url.QueryEscape(encodeBytes(code))+"&state="+url.QueryEscape(r.State)
 return SSOAuthorization{RedirectURI:redirect},nil
}

// Exchange atomically consumes the code under the original account lock,
// revalidates the initiating source session and creates a different opaque
// bearer and subject for the registered receiving app. No token is placed in
// the browser callback, code, state, or query string.
func (s *SSOManager) Exchange(ctx context.Context,c ssoClient,code,verifier,redirect string)(SSOExchange,error){
 var none SSOExchange
 if c.app==""||redirect!=c.redirect||!pkceVerifierPattern.MatchString(verifier){return none,ErrAuthentication}
 b,e:=decodeToken(code);if e!=nil{return none,ErrAuthentication}
 digest:=sha256.Sum256(b);pkce:=sha256.Sum256([]byte(verifier))
 tx,e:=s.source.auth.store.db.BeginTx(ctx,nil);if e!=nil{return none,e};defer tx.Rollback()
 var accountID AccountID
 e=tx.QueryRowContext(ctx,"SELECT account_id FROM account420.sso_codes WHERE code_digest=$1 AND client_app=$2",digest[:],c.app).Scan(&accountID)
 if errors.Is(e,sql.ErrNoRows){return none,ErrAuthentication};if e!=nil{return none,e}
 revision,e:=s.source.lockAccount(ctx,tx,accountID);if e!=nil{return none,e}
 var originalID,sourceApp,sourceRP string
 var sourceRevision int64
 var storedPKCE []byte
 e=tx.QueryRowContext(ctx,`DELETE FROM account420.sso_codes
  WHERE code_digest=$1 AND account_id=$2 AND client_app=$3 AND redirect_uri=$4
  AND expires_at>clock_timestamp()
  RETURNING source_session_id,account_revision,pkce_digest`,
  digest[:],accountID,c.app,c.redirect).Scan(&originalID,&sourceRevision,&storedPKCE)
 if errors.Is(e,sql.ErrNoRows){return none,ErrAuthentication};if e!=nil{return none,e}
 if revision!=sourceRevision||subtle.ConstantTimeCompare(storedPKCE,pkce[:])!=1{return none,ErrAuthentication}
 // Revoking/expiring the original session invalidates both outstanding codes
 // and previously issued SSO sessions; the parent is checked on each use.
 e=tx.QueryRowContext(ctx,`SELECT app_id,rp_id FROM account420.sessions
  WHERE id=$1 AND account_id=$2 AND account_revision=$3 AND method IN ('email','passkey')
  AND revoked_at IS NULL AND idle_until>clock_timestamp() AND expires_at>clock_timestamp()
  FOR UPDATE`,originalID,accountID,revision).Scan(&sourceApp,&sourceRP)
 if errors.Is(e,sql.ErrNoRows){return none,ErrAuthentication};if e!=nil{return none,e}
 if sourceApp!=s.source.app||sourceRP!=s.source.auth.rp{return none,ErrAuthentication}
 var active int
 e=tx.QueryRowContext(ctx,`SELECT count(*) FROM account420.sessions child WHERE child.account_id=$1
  AND child.app_id=$2 AND child.rp_id=$3 AND child.revoked_at IS NULL
  AND child.idle_until>clock_timestamp() AND child.expires_at>clock_timestamp()
  AND (child.method<>'sso' OR EXISTS (
    SELECT 1 FROM account420.sessions parent WHERE parent.id=child.sso_source_id
    AND parent.account_id=child.account_id AND parent.account_revision=child.account_revision
    AND parent.revoked_at IS NULL AND parent.idle_until>clock_timestamp()
    AND parent.expires_at>clock_timestamp()))`,accountID,c.app,s.source.auth.rp).Scan(&active)
 if e!=nil{return none,e};if active>=100{return none,ErrUnavailable}
 subjectID,e:=newID();if e!=nil{return none,e}
 _,e=tx.ExecContext(ctx,`INSERT INTO account420.app_subjects(account_id,app_id,subject_id)
 VALUES($1,$2,$3) ON CONFLICT(account_id,app_id) DO NOTHING`,accountID,c.app,subjectID)
 if e!=nil{return none,e}
 id,e:=newID();if e!=nil{return none,e}
 token,tokenHash,e:=newSessionToken();if e!=nil{return none,e}
 var grant sessionRecord
 grant,e=scanSession(tx.QueryRowContext(ctx,`WITH inserted AS (
  INSERT INTO account420.sessions(id,account_id,app_id,rp_id,account_revision,token_digest,method,
   issued_at,idle_until,expires_at,sso_source_id)
  VALUES($1,$2,$3,$4,$5,$6,'sso',statement_timestamp(),
   LEAST(statement_timestamp()+interval '24 hours',(SELECT idle_until FROM account420.sessions WHERE id=$7)),
   LEAST(statement_timestamp()+interval '7 days',(SELECT expires_at FROM account420.sessions WHERE id=$7)),$7)
  RETURNING *)
  SELECT `+sessionColumns+` FROM inserted s
  JOIN account420.app_subjects p ON p.account_id=s.account_id AND p.app_id=s.app_id`,
  id,accountID,c.app,s.source.auth.rp,revision,tokenHash,originalID))
 if e!=nil{return none,e}
 if e=tx.Commit();e!=nil{return none,e}
 return SSOExchange{AccessToken:token,TokenType:"Bearer",Session:grant.Session},nil
}

// Introspect is the ONLY trusted consuming-app validation surface. It
// enforces the current account revision, target app, and currently active
// parent session in the SAME SELECT. It returns no internal account ID,
// source app subject, email, passkey or wallet association.
func (s *SSOManager) Introspect(ctx context.Context,c ssoClient,token string)(SSOIntrospection,error){
 none:=SSOIntrospection{Active:false}
 if c.app==""{return none,ErrAuthentication}
 digest,e:=tokenDigest(token);if e!=nil{return none,nil}
 var subject Subject;var expires,idle time.Time;var method string;var accountID AccountID
 e=s.source.auth.store.db.QueryRowContext(ctx,`SELECT p.app_id,p.subject_id,t.expires_at,t.idle_until,t.method,t.account_id
 FROM account420.sessions t
 JOIN account420.sessions parent ON parent.id=t.sso_source_id
 JOIN account420.accounts a ON a.id=t.account_id AND a.id=parent.account_id
 JOIN account420.app_subjects p ON p.account_id=t.account_id AND p.app_id=t.app_id
 WHERE t.token_digest=$1 AND t.app_id=$2 AND t.rp_id=$3
 AND t.method='sso' AND t.revoked_at IS NULL AND t.idle_until>clock_timestamp()
 AND t.expires_at>clock_timestamp() AND a.status='active'
 AND a.revision=t.account_revision AND a.revision=parent.account_revision
 AND parent.app_id=$4 AND parent.rp_id=$3 AND parent.method IN ('email','passkey')
 AND parent.revoked_at IS NULL AND parent.idle_until>clock_timestamp()
 AND parent.expires_at>clock_timestamp()`,
 digest,c.app,s.source.auth.rp,s.source.app).Scan(&subject.App,&subject.ID,&expires,&idle,&method,&accountID)
 if errors.Is(e,sql.ErrNoRows){return none,nil}
 if e!=nil{return none,e}
 out:=SSOIntrospection{Active:true,Subject:&subject,ExpiresAt:expires,IdleUntil:idle,Method:method}
 // Only the exact approved BongGoggles confidential backend can see an
 // owner-consented readiness snapshot. No wallet address, payout authority,
 // account identifier, XP balance or private 420ID token is shared.
 if s.monetization!=nil&&c.app==monetizationApp{
  status,e:=s.monetization.forBongGoggles(ctx,accountID)
  if e!=nil{return none,e}
  // Without consent, do not reveal even whether a wallet is associated.
  if !status.RewardOptIn&&!status.CreatorOptIn{status.WalletLinked=false}
  out.Monetization=&status
 }
 return out,nil
}
func (s *SSOManager) Revoke(ctx context.Context,c ssoClient,token string)error{
 if c.app==""{return ErrAuthentication}
 // A backend client is authorized only to its own app-scoped session.
 manager,e:=NewSessionManager(s.source.auth,c.app);if e!=nil{return e}
 return manager.Logout(ctx,token)
}
func (s *SSOManager) LogoutAll(ctx context.Context,sourceToken string)error{
 tx,e:=s.source.auth.store.db.BeginTx(ctx,nil);if e!=nil{return e};defer tx.Rollback()
 owner,e:=s.source.lockedSession(ctx,tx,sourceToken);if e!=nil{return e}
 if _,e=tx.ExecContext(ctx,"DELETE FROM account420.sso_codes WHERE account_id=$1",owner.account);e!=nil{return e}
 if _,e=tx.ExecContext(ctx,"UPDATE account420.sessions SET revoked_at=clock_timestamp() WHERE account_id=$1 AND revoked_at IS NULL",owner.account);e!=nil{return e}
 return tx.Commit()
}
func (s *SSOManager) Ready(ctx context.Context)error{
 var ready bool
 e:=s.source.auth.store.db.QueryRowContext(ctx,`SELECT
  COALESCE(has_table_privilege(current_user,to_regclass('account420.sso_codes'),'SELECT,INSERT,UPDATE,DELETE'),false)
  AND COALESCE(has_column_privilege(current_user,'account420.sessions','sso_source_id','INSERT,SELECT'),false)`).Scan(&ready)
 if e!=nil{return e}
 if !ready{return ErrUnavailable}
 return nil
}
func (s *SSOManager) Purge(ctx context.Context)error{
 _,e:=s.source.auth.store.db.ExecContext(ctx,"DELETE FROM account420.sso_codes WHERE expires_at<=clock_timestamp()")
 return e
}
