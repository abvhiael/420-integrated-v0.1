package account

import (
 "bytes"
 "context"
 "crypto/hmac"
 "crypto/sha256"
 "database/sql"
 "embed"
 "encoding/json"
 "errors"
 "io"
 "mime"
 "net"
 "net/http"
 "strings"
 "time"
)

//go:embed browser.mjs acceptance.html acceptance.mjs acceptance.css session.html session.mjs profile.html profile-session.mjs profile-ui.mjs wallet.html wallet-session.mjs wallet-ui.mjs identity.html identity-session.mjs identity-ui.mjs sso.html sso-session.mjs sso-ui.mjs
var acceptanceAssets embed.FS

// AcceptanceConfig deliberately enables only named test mailboxes. The
// public authentication journey is not an authenticated application session.
type AcceptanceConfig struct {
 Emails []string
 RateKey []byte
 SessionApp string // empty preserves AUTH-2; nonempty explicitly enables restricted AUTH-3
 ProfileMode bool // only in explicit profile-acceptance mode with an approved SessionApp
 WalletMode bool // only in explicitly configured wallet-acceptance mode
 WalletChainID int64 // positive, server-pinned chain ID
 ContractVerifier ContractSignatureVerifier // optional verified finalized-chain EIP-1271 client
 IdentityMode bool // only explicit identity-acceptance with wallet mode
 IdentityReader IdentityNamesReader // independent pinned-finalized contract verifier
 SSOClients []SSOClient // explicit confidential cross-application clients; nil disables SSO
 TrustedTLSProxy bool // only for a TLS-terminating, non-bypassable trusted ingress
}
type AcceptanceHandler struct {
 auth *Auth
 emails map[string]bool
 rateKey []byte
 proxy bool
 sessions *SessionManager
 profiles bool
 wallet *WalletLinkManager
 identity *IdentityNamesManager
 sso *SSOManager
}
func NewAcceptanceHandler(auth *Auth,c AcceptanceConfig)(*AcceptanceHandler,error){
 if auth==nil||len(c.Emails)==0||len(c.Emails)>50||len(c.RateKey)!=32{return nil,ErrInvalid}
 h:=&AcceptanceHandler{auth:auth,emails:map[string]bool{},rateKey:append([]byte{},c.RateKey...),proxy:c.TrustedTLSProxy}
 for _,email:=range c.Emails{
  normalized,e:=normalizeEmail(email);if e!=nil||h.emails[normalized]{return nil,ErrInvalid};h.emails[normalized]=true
 }
 if c.SessionApp!=""{var e error;h.sessions,e=NewSessionManager(auth,c.SessionApp);if e!=nil{return nil,e}}
 if c.ProfileMode&&h.sessions==nil{return nil,ErrInvalid}
 h.profiles=c.ProfileMode
 if c.WalletMode{
  if !h.profiles||h.sessions==nil||c.WalletChainID<=0{return nil,ErrInvalid}
  var err error;h.wallet,err=NewWalletLinkManager(h.sessions,c.WalletChainID,c.ContractVerifier)
  if err!=nil{return nil,err}
 }
 if c.IdentityMode{
  if h.wallet==nil||c.IdentityReader==nil{return nil,ErrInvalid}
  var err error;h.identity,err=NewIdentityNamesManager(h.sessions,h.wallet,c.IdentityReader)
  if err!=nil{return nil,err}
 }
 if len(c.SSOClients)>0{
  if h.sessions==nil{return nil,ErrInvalid}
  var err error;h.sso,err=NewSSOManager(h.sessions,c.SSOClients)
  if err!=nil{return nil,err}
 }
 return h,nil
}

const flowCookie="__Host-420id-acceptance"
const maxRequest=32*1024
var errLimited=errors.New("rate limited")

func securityHeaders(w http.ResponseWriter){
 w.Header().Set("Cache-Control","no-store")
 w.Header().Set("X-Content-Type-Options","nosniff")
 w.Header().Set("X-Frame-Options","DENY")
 w.Header().Set("Referrer-Policy","no-referrer")
 w.Header().Set("X-Robots-Tag","noindex, nofollow")
 w.Header().Set("Permissions-Policy","camera=(), microphone=(), geolocation=(), payment=(), publickey-credentials-create=(self), publickey-credentials-get=(self)")
 w.Header().Set("Content-Security-Policy","default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
 w.Header().Set("Strict-Transport-Security","max-age=31536000")
}
func reply(w http.ResponseWriter,status int,v any){
 w.Header().Set("Content-Type","application/json; charset=utf-8")
 w.WriteHeader(status);_ = json.NewEncoder(w).Encode(v)
}
func deny(w http.ResponseWriter,status int){
 message:="Request could not be completed."
 if status==http.StatusTooManyRequests{message="Too many requests. Try again later.";w.Header().Set("Retry-After","60")}
 reply(w,status,map[string]string{"error":message})
}
func (h *AcceptanceHandler) secure(r *http.Request)bool{
 return r.Host==h.auth.rp&&(r.TLS!=nil||h.proxy&&len(r.Header.Values("X-Forwarded-Proto"))==1&&r.Header.Get("X-Forwarded-Proto")=="https")
}
func browserDigest(r *http.Request)([]byte,error){
 var found *http.Cookie
 for _,cookie:=range r.Cookies(){if cookie.Name==flowCookie{if found!=nil{return nil,ErrAuthentication};found=cookie}}
 if found==nil{return nil,ErrAuthentication}
 token,e:=decodeToken(found.Value);if e!=nil{return nil,e};d:=sha256.Sum256(token);return d[:],nil
}
func (h *AcceptanceHandler) serveAsset(w http.ResponseWriter,r *http.Request,file,content string){
 if file=="acceptance.html"||file=="session.html"||file=="profile.html"||file=="wallet.html"||file=="identity.html"||file=="sso.html"{
  if _,e:=browserDigest(r);e!=nil{
   token,err:=randomBytes();if err!=nil{deny(w,503);return}
   http.SetCookie(w,&http.Cookie{Name:flowCookie,Value:encodeBytes(token),Path:"/",Secure:true,HttpOnly:true,SameSite:http.SameSiteStrictMode,MaxAge:1800})
  }
 }
 raw,e:=acceptanceAssets.ReadFile(file);if e!=nil{deny(w,503);return}
 w.Header().Set("Content-Type",content);_,_=w.Write(raw)
}
func (h *AcceptanceHandler) ServeHTTP(w http.ResponseWriter,r *http.Request){
 securityHeaders(w)
 if (r.URL.RawQuery!=""||r.URL.ForceQuery||r.URL.RawPath!="") &&
 !(h.sso!=nil&&r.Method=="GET"&&r.URL.Path=="/sso/authorize"){deny(w,400);return}
 // A minimal load-balancer probe exposes no application or credential data.
 if r.URL.Path=="/healthz"&&r.Method=="GET"{
  ctx,cancel:=context.WithTimeout(r.Context(),2*time.Second);defer cancel()
  if h.auth.store.db.PingContext(ctx)!=nil{deny(w,503);return};reply(w,200,map[string]bool{"ready":true});return
 }
 if !h.secure(r){deny(w,403);return}
 if h.sso!=nil&&r.Method=="GET"&&r.URL.Path=="/sso/authorize"{
  if r.URL.RawPath!=""||r.URL.ForceQuery{deny(w,400);return}
  req,e:=parseSSOQuery(r.URL.RawQuery)
  if e!=nil{deny(w,400);return}
  if _,e=h.sso.ValidateRequest(req);e!=nil{deny(w,400);return}
  h.serveAsset(w,r,"sso.html","text/html; charset=utf-8");return
 }
 if h.sso!=nil&&r.Method=="POST"&&
 (r.URL.Path=="/v1/sso/token"||r.URL.Path=="/v1/sso/introspect"||r.URL.Path=="/v1/sso/revoke"){
  h.ssoBackendRoute(w,r);return
 }
 if r.Method=="GET"{
  switch r.URL.Path{
  case "/":if h.identity!=nil{h.serveAsset(w,r,"identity.html","text/html; charset=utf-8")}else if h.wallet!=nil{h.serveAsset(w,r,"wallet.html","text/html; charset=utf-8")}else if h.profiles{h.serveAsset(w,r,"profile.html","text/html; charset=utf-8")}else if h.sessions!=nil{h.serveAsset(w,r,"session.html","text/html; charset=utf-8")}else{h.serveAsset(w,r,"acceptance.html","text/html; charset=utf-8")}
  case "/session.mjs":if h.sessions==nil{deny(w,404);return};h.serveAsset(w,r,"session.mjs","text/javascript; charset=utf-8")
  case "/profile-session.mjs":if !h.profiles{deny(w,404);return};h.serveAsset(w,r,"profile-session.mjs","text/javascript; charset=utf-8")
  case "/profile-ui.mjs":if !h.profiles{deny(w,404);return};h.serveAsset(w,r,"profile-ui.mjs","text/javascript; charset=utf-8")
  case "/wallet-session.mjs":if h.wallet==nil{deny(w,404);return};h.serveAsset(w,r,"wallet-session.mjs","text/javascript; charset=utf-8")
  case "/wallet-ui.mjs":if h.wallet==nil{deny(w,404);return};h.serveAsset(w,r,"wallet-ui.mjs","text/javascript; charset=utf-8")
  case "/identity-session.mjs":if h.identity==nil{deny(w,404);return};h.serveAsset(w,r,"identity-session.mjs","text/javascript; charset=utf-8")
  case "/identity-ui.mjs":if h.identity==nil{deny(w,404);return};h.serveAsset(w,r,"identity-ui.mjs","text/javascript; charset=utf-8")
  case "/sso-session.mjs":if h.sso==nil{deny(w,404);return};h.serveAsset(w,r,"sso-session.mjs","text/javascript; charset=utf-8")
  case "/sso-ui.mjs":if h.sso==nil{deny(w,404);return};h.serveAsset(w,r,"sso-ui.mjs","text/javascript; charset=utf-8")
  case "/acceptance.mjs":h.serveAsset(w,r,"acceptance.mjs","text/javascript; charset=utf-8")
  case "/browser.mjs":h.serveAsset(w,r,"browser.mjs","text/javascript; charset=utf-8")
  case "/acceptance.css":h.serveAsset(w,r,"acceptance.css","text/css; charset=utf-8")
  default:deny(w,404)
  };return
 }
 if r.Method!="POST"{deny(w,405);return}
 switch r.URL.Path{case "/v1/email/start","/v1/email/finish","/v1/passkey/register","/v1/passkey/start","/v1/passkey/finish":
 case "/v1/session/status","/v1/session/renew","/v1/session/list","/v1/session/logout","/v1/session/revoke","/v1/session/revoke-all","/v1/recovery/finish":if h.sessions==nil{deny(w,404);return}
 case "/v1/profile/me","/v1/profile/update","/v1/profile/lookup":if !h.profiles{deny(w,404);return}
 case "/v1/wallet/current","/v1/wallet/start","/v1/wallet/finish","/v1/wallet/unlink":if h.wallet==nil{deny(w,404);return}
 case "/v1/identity/preview","/v1/identity/save","/v1/identity/current","/v1/identity/clear":if h.identity==nil{deny(w,404);return}
 case "/v1/sso/prepare","/v1/sso/authorize","/v1/sso/logout-all":if h.sso==nil{deny(w,404);return}
 default:deny(w,404);return}
 // Exact Origin, no credentialed CORS, no alternate host or cross-site POST.
 if len(r.Header.Values("Origin"))!=1||r.Header.Get("Origin")!=h.auth.origin||r.Header.Get("Sec-Fetch-Site")!=""&&r.Header.Get("Sec-Fetch-Site")!="same-origin"{deny(w,403);return}
 typ,params,e:=mime.ParseMediaType(r.Header.Get("Content-Type"));if e!=nil||typ!="application/json"||len(params)!=0&&!(len(params)==1&&strings.EqualFold(params["charset"],"utf-8"))||r.Header.Get("Content-Encoding")!=""{deny(w,415);return}
 digest,e:=browserDigest(r);if e!=nil{deny(w,403);return}
 ctx,cancel:=context.WithTimeout(r.Context(),15*time.Second);defer cancel()
 if e=h.limit(ctx,digest,r.RemoteAddr,r.URL.Path=="/v1/email/start");e!=nil{if errors.Is(e,errLimited){deny(w,429)}else{deny(w,503)};return}
 if r.ContentLength>maxRequest{deny(w,413);return}
 raw,e:=io.ReadAll(http.MaxBytesReader(w,r.Body,maxRequest));if e!=nil{deny(w,413);return}
 if !uniqueObject(raw){deny(w,400);return}
 if h.sso!=nil&&strings.HasPrefix(r.URL.Path,"/v1/sso/"){h.ssoBrowserRoute(ctx,w,r,raw,digest);return}
 if h.identity!=nil&&strings.HasPrefix(r.URL.Path,"/v1/identity/"){h.identityRoute(ctx,w,r,raw);return}
 if h.wallet!=nil&&strings.HasPrefix(r.URL.Path,"/v1/wallet/"){h.walletRoute(ctx,w,r,raw,digest);return}
 if h.profiles&&strings.HasPrefix(r.URL.Path,"/v1/profile/"){h.profileRoute(ctx,w,r,raw);return}
 if h.sessions!=nil&&(strings.HasPrefix(r.URL.Path,"/v1/session/")||r.URL.Path=="/v1/recovery/finish"){h.sessionRoute(ctx,w,r,raw,digest);return}
 switch r.URL.Path{
 case "/v1/email/start":
  var body struct{Email string};if !decodeRequest(raw,&body){deny(w,400);return}
  email,e:=normalizeEmail(body.Email)
  // Do not advertise whether a mailbox is approved, registered or throttled.
  id,err:=newID();if err!=nil{deny(w,503);return}
  if e==nil&&h.emails[email]{
   result,e:=h.auth.BeginEmail(ctx,email)
   if e==nil{if h.bind(ctx,result.ChallengeID,"email",digest,10)!=nil{deny(w,503);return};id=result.ChallengeID}
  }
  reply(w,200,EmailStart{id})
 case "/v1/email/finish":
  var body struct{ChallengeID string;Secret string;Recover *bool};if !decodeRequest(raw,&body)||h.sessions==nil&&body.Recover!=nil{deny(w,400);return}
  if h.sessions!=nil&&!h.canLogin(ctx,w,r){return}
  if !h.bound(ctx,body.ChallengeID,"email",digest){deny(w,401);return}
  result,e:=h.auth.finishEmail(ctx,body.ChallengeID,body.Secret,body.Recover!=nil&&*body.Recover)
  if e!=nil||!h.approved(ctx,result.Proof.AccountID()){deny(w,401);return}
  if result.Registration!=nil&&h.bind(ctx,result.Registration.ChallengeID,"register",digest,5)!=nil{deny(w,503);return}
  receipt,e:=h.receipt(ctx,"email_verified");if e!=nil{deny(w,503);return}
  response:=map[string]any{"verified":true,"registration":result.Registration,"receipt":receipt}
  if h.sessions!=nil{
   if body.Recover!=nil&&*body.Recover{
    // A new account can use its initial registration; recovery itself requires
    // an existing credential. Do not issue a session on a recovery proof.
    if result.Registration!=nil{deny(w,401);return}
    options,e:=h.sessions.BeginRecovery(ctx,result.Proof,digest);if e!=nil{deny(w,401);return}
    response["recovery"]=options
   }else{
    grant,e:=h.sessions.Issue(ctx,result.Proof);if e!=nil{deny(w,503);return}
    setSessionCookie(w,grant);response["session"]=grant.Session
   }
  }
  reply(w,200,response)
 case "/v1/passkey/register":
  var body struct{ChallengeID string;RegistrationResponse};if !decodeRequest(raw,&body){deny(w,400);return}
  if !h.bound(ctx,body.ChallengeID,"register",digest)||!h.registrationApproved(ctx,body.ChallengeID){deny(w,401);return}
  if e=h.auth.FinishPasskeyRegistration(ctx,body.ChallengeID,body.RegistrationResponse);e!=nil{deny(w,401);return}
  receipt,e:=h.receipt(ctx,"passkey_registered");if e!=nil{deny(w,503);return};reply(w,200,map[string]any{"registered":true,"receipt":receipt})
 case "/v1/passkey/start":
  if !decodeRequest(raw,&struct{}{}){deny(w,400);return}
  options,e:=h.auth.BeginPasskeyLogin(ctx);if e!=nil{deny(w,503);return}
  if h.bind(ctx,options.ChallengeID,"login",digest,5)!=nil{deny(w,503);return};reply(w,200,options)
 case "/v1/passkey/finish":
  var body struct{ChallengeID string;AssertionResponse};if !decodeRequest(raw,&body){deny(w,400);return}
  if h.sessions!=nil&&!h.canLogin(ctx,w,r){return}
  if !h.bound(ctx,body.ChallengeID,"login",digest){deny(w,401);return}
  result,e:=h.auth.FinishPasskeyLogin(ctx,body.ChallengeID,body.AssertionResponse)
  if e!=nil||!h.approved(ctx,result.AccountID()){deny(w,401);return}
  receipt,e:=h.receipt(ctx,"passkey_verified");if e!=nil{deny(w,503);return};response:=map[string]any{"verified":true,"receipt":receipt}
  if h.sessions!=nil{grant,e:=h.sessions.Issue(ctx,result);if e!=nil{deny(w,503);return};setSessionCookie(w,grant);response["session"]=grant.Session}
  reply(w,200,response)
 }
}
// Flat request objects have no ambiguous duplicate fields, even with Go's
// case-insensitive field matching. Nested values are rejected by typed decode.
func uniqueObject(raw []byte)bool{
 d:=json.NewDecoder(bytes.NewReader(raw));t,e:=d.Token();if e!=nil||t!=json.Delim('{'){return false}
 seen:=map[string]bool{}
 for d.More(){k,e:=d.Token();s,ok:=k.(string);s=strings.ToLower(s);if e!=nil||!ok||seen[s]{return false};seen[s]=true;var v json.RawMessage;if d.Decode(&v)!=nil{return false}}
 end,e:=d.Token();if e!=nil||end!=json.Delim('}'){return false};_,e=d.Token();return e==io.EOF
}
func decodeRequest(raw []byte,target any)bool{d:=json.NewDecoder(bytes.NewReader(raw));d.DisallowUnknownFields();return d.Decode(target)==nil}
func (h *AcceptanceHandler) bind(ctx context.Context,id,kind string,digest []byte,minutes int)error{
 _,e:=h.auth.store.db.ExecContext(ctx,"INSERT INTO account420.acceptance_flows(challenge_id,kind,browser_digest,expires_at) VALUES($1,$2,$3,clock_timestamp()+$4*interval '1 minute')",id,kind,digest,minutes);return e
}
func (h *AcceptanceHandler) bound(ctx context.Context,id,kind string,digest []byte)bool{
 if !validID(id){return false}
 var ok bool;e:=h.auth.store.db.QueryRowContext(ctx,"SELECT EXISTS(SELECT 1 FROM account420.acceptance_flows WHERE challenge_id=$1 AND kind=$2 AND browser_digest=$3 AND expires_at>clock_timestamp())",id,kind,digest).Scan(&ok);return e==nil&&ok
}
func (h *AcceptanceHandler) registrationApproved(ctx context.Context,id string)bool{
 var email string;e:=h.auth.store.db.QueryRowContext(ctx,"SELECT i.email FROM account420.passkey_challenges c JOIN account420.email_identities i ON i.account_id=c.account_id JOIN account420.accounts a ON a.id=i.account_id WHERE c.id=$1 AND c.purpose='register' AND c.rp_id=$2 AND a.status='active'",id,h.auth.rp).Scan(&email);return e==nil&&h.emails[email]
}
func (h *AcceptanceHandler) approved(ctx context.Context,id AccountID)bool{
 if !validID(string(id)){return false}
 var email string;e:=h.auth.store.db.QueryRowContext(ctx,"SELECT i.email FROM account420.email_identities i JOIN account420.accounts a ON a.id=i.account_id WHERE a.id=$1 AND a.status='active'",id).Scan(&email);return e==nil&&h.emails[email]
}
func (h *AcceptanceHandler) receipt(ctx context.Context,kind string)(string,error){
 id,e:=newID();if e!=nil{return "",e};_,e=h.auth.store.db.ExecContext(ctx,"INSERT INTO account420.acceptance_receipts(id,kind) VALUES($1,$2)",id,kind);return id,e
}
func (h *AcceptanceHandler) scopedHash(v string)string{mac:=hmac.New(sha256.New,h.rateKey);_,_=mac.Write([]byte(v));return encodeBytes(mac.Sum(nil))}
func (h *AcceptanceHandler) limit(ctx context.Context,digest []byte,remote string,mail bool)error{
 host,_,e:=net.SplitHostPort(remote);if e!=nil||net.ParseIP(host)==nil{return ErrInvalid}
 // Never trust browser-supplied X-Forwarded-For. A load balancer's address may
 // be shared; global limits remain in force even if proxy peers rotate.
 tx,e:=h.auth.store.db.BeginTx(ctx,nil);if e!=nil{return e};defer tx.Rollback()
 var minute int64
 if e=tx.QueryRowContext(ctx,"SELECT floor(extract(epoch from clock_timestamp())/60)::bigint").Scan(&minute);e!=nil{return e}
 type item struct{scope string;bucket int64;max int}
 limits:=[]item{{"global",minute,120},{"peer:"+h.scopedHash(host),minute,60},{"browser:"+encodeBytes(digest),minute,30}}
 if mail{limits=append(limits,item{"mail-global-hour",minute/60,30},item{"mail-global-day",minute/1440,90})}
 for _,v:=range limits{
  var count int
  e=tx.QueryRowContext(ctx,"INSERT INTO account420.acceptance_rate(scope,bucket,count) VALUES($1,$2,1) ON CONFLICT(scope,bucket) DO UPDATE SET count=account420.acceptance_rate.count+1 WHERE account420.acceptance_rate.count<$3 RETURNING count",v.scope,v.bucket,v.max).Scan(&count)
  if errors.Is(e,sql.ErrNoRows){return errLimited};if e!=nil{return e}
 }
 return tx.Commit()
}
func (h *AcceptanceHandler) Purge(ctx context.Context)error{
 if h.profiles{if e:=h.profileReady(ctx);e!=nil{return e}}
 if h.wallet!=nil{if e:=h.wallet.Ready(ctx);e!=nil{return e};if e:=h.wallet.Purge(ctx);e!=nil{return e}}
 if h.identity!=nil{if e:=h.identity.Ready(ctx);e!=nil{return e}}
 if h.sso!=nil{if e:=h.sso.Ready(ctx);e!=nil{return e};if e:=h.sso.Purge(ctx);e!=nil{return e}}
 if h.sessions!=nil{if e:=h.sessions.PurgeExpired(ctx);e!=nil{return e}}
 if e:=h.auth.PurgeExpired(ctx);e!=nil{return e}
 for _,q:=range []string{
 "DELETE FROM account420.acceptance_flows WHERE expires_at<=clock_timestamp()",
 "DELETE FROM account420.acceptance_rate WHERE (scope='mail-global-hour' AND bucket<floor(extract(epoch from clock_timestamp())/3600)-1) OR (scope='mail-global-day' AND bucket<floor(extract(epoch from clock_timestamp())/86400)-1) OR (scope NOT IN ('mail-global-hour','mail-global-day') AND bucket<floor(extract(epoch from clock_timestamp())/60)-1)",
 "DELETE FROM account420.acceptance_receipts WHERE created_at<clock_timestamp()-interval '30 days'",
 }{if _,e:=h.auth.store.db.ExecContext(ctx,q);e!=nil{return e}}
 return nil
}
