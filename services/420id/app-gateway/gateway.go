// Package appgateway is the confidential, wallet-independent 420ID
// consumer for separately deployed first-party 420Integrated applications.
// It never issues payment, wallet, tenant, creator, moderator or game rights.
package appgateway

import (
 "bytes"
 "context"
 "crypto/aes"
 "crypto/cipher"
 "crypto/rand"
 "crypto/hmac"
 "crypto/sha256"
 "crypto/subtle"
 "database/sql"
 "embed"
 "encoding/base64"
 "encoding/json"
 "errors"
 "io"
 "mime"
 "net"
 "net/http"
 "net/url"
 "regexp"
 "strings"
 "time"
)

const (
 Authority = "https://auth.420integrated.org/"
 APIPath = "/420id-api/"
 CookieSession = "__Host-app420_session"
 CookieFlow = "__Host-app420_flow"
)
var (
 ErrInvalid=errors.New("invalid 420ID app configuration")
 ErrUnavailable=errors.New("420ID app session unavailable")
 ErrNotAuthenticated=errors.New("not signed in")
 tokenPattern=regexp.MustCompile(`^[A-Za-z0-9_-]{43}$`)
 subjectPattern=regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
 //go:embed catalogue.json schema.sql
 assets embed.FS
)
type App struct {
 ID string `json:"id"`
 Name string `json:"name"`
 Origin string `json:"origin"`
 Capability string `json:"capability"`
}
type Catalogue struct {
 Schema string `json:"schema"`
 Authority string `json:"authority"`
 GatewayPath string `json:"gatewayPath"`
 Apps []App `json:"apps"`
}
func ApprovedApps()(Catalogue,error){
 var c Catalogue
 raw,e:=assets.ReadFile("catalogue.json")
 if e!=nil{return c,e}
 if e=json.Unmarshal(raw,&c);e!=nil{return c,e}
 if c.Schema!="420id-application-integration-v1"||c.Authority!=Authority||c.GatewayPath!="/420id-api"||len(c.Apps)<1{return c,ErrInvalid}
 seen:=map[string]bool{};hosts:=map[string]bool{}
 for _,app:=range c.Apps{
  u,e:=url.Parse(app.Origin)
  if e!=nil||u.Scheme!="https"||u.Host==""||u.User!=nil||u.Port()!=""||u.Path!=""||u.RawQuery!=""||u.Fragment!=""||
   !strings.HasSuffix(u.Hostname(),".420integrated.org")||u.String()!=app.Origin||
   !regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,62}$`).MatchString(app.ID)||
   app.Name==""||app.Capability==""||seen[app.ID]||hosts[app.Origin]{return c,ErrInvalid}
  seen[app.ID]=true;hosts[app.Origin]=true
 }
 return c,nil
}
func ApprovedApp(id string)(App,error){
 c,e:=ApprovedApps();if e!=nil{return App{},e}
 for _,v:=range c.Apps{if v.ID==id{return v,nil}}
 return App{},ErrInvalid
}

type Config struct{
 AppID string
 DB *sql.DB
 // Each instance has an independent 32-byte secret and an independent
 // 32-byte encryption key. Neither ever enters public site config.
 ClientSecret []byte
 SessionKey []byte
 Client *http.Client
 // Must be explicitly trusted when HTTPS is terminated at Cloudflare/Render.
 TrustedTLSProxy bool
}

type Gateway struct{
 App App
 db *sql.DB
 secret string
 key [32]byte
 httpClient *http.Client
 proxy bool
}
func New(cfg Config)(*Gateway,error){
 app,e:=ApprovedApp(cfg.AppID)
 if e!=nil||cfg.DB==nil||len(cfg.ClientSecret)!=32||len(cfg.SessionKey)!=32||
  subtle.ConstantTimeCompare(cfg.ClientSecret,cfg.SessionKey)==1||!cfg.TrustedTLSProxy{return nil,ErrInvalid}
 c:=cfg.Client
 if c==nil{c=&http.Client{Timeout:5*time.Second}}
 copyClient:=*c
 copyClient.Timeout=5*time.Second
 copyClient.CheckRedirect=func(_ *http.Request,_ []*http.Request)error{return ErrUnavailable}
 g:=&Gateway{App:app,db:cfg.DB,secret:base64.RawURLEncoding.EncodeToString(cfg.ClientSecret),
  httpClient:&copyClient,proxy:cfg.TrustedTLSProxy}
 copy(g.key[:],cfg.SessionKey)
 return g,nil
}

func Migration()([]byte,error){return assets.ReadFile("schema.sql")}
func Migrate(ctx context.Context,db *sql.DB)error{
 if db==nil{return ErrInvalid}
 sqlText,e:=Migration();if e!=nil{return e}
 tx,e:=db.BeginTx(ctx,nil);if e!=nil{return e};defer tx.Rollback()
 if _,e=tx.ExecContext(ctx,"SELECT pg_advisory_xact_lock(420000013)");e!=nil{return e}
 if _,e=tx.ExecContext(ctx,string(sqlText));e!=nil{return e}
 return tx.Commit()
}
func (g *Gateway) Ready(ctx context.Context)error{
 if g==nil||g.db==nil{return ErrInvalid}
 var all,unsafe bool
 e:=g.db.QueryRowContext(ctx,`SELECT (
 COALESCE(has_table_privilege(current_user,to_regclass('app420_sso.login_flows'),'SELECT'),false)
 AND COALESCE(has_table_privilege(current_user,to_regclass('app420_sso.login_flows'),'INSERT'),false)
 AND COALESCE(has_table_privilege(current_user,to_regclass('app420_sso.login_flows'),'DELETE'),false)
 AND COALESCE(has_table_privilege(current_user,to_regclass('app420_sso.sessions'),'SELECT'),false)
 AND COALESCE(has_table_privilege(current_user,to_regclass('app420_sso.sessions'),'INSERT'),false)
 AND COALESCE(has_table_privilege(current_user,to_regclass('app420_sso.sessions'),'DELETE'),false)
 AND COALESCE(has_table_privilege(current_user,to_regclass('app420_sso.rate_buckets'),'SELECT'),false)
 AND COALESCE(has_table_privilege(current_user,to_regclass('app420_sso.rate_buckets'),'INSERT'),false)
 AND COALESCE(has_table_privilege(current_user,to_regclass('app420_sso.rate_buckets'),'UPDATE'),false)
 AND COALESCE(has_table_privilege(current_user,to_regclass('app420_sso.rate_buckets'),'DELETE'),false)),
 (
 COALESCE(has_table_privilege(current_user,to_regclass('app420_sso.login_flows'),'UPDATE'),false)
 OR COALESCE(has_table_privilege(current_user,to_regclass('app420_sso.login_flows'),'TRUNCATE'),false)
 OR COALESCE(has_table_privilege(current_user,to_regclass('app420_sso.sessions'),'UPDATE'),false)
 OR COALESCE(has_table_privilege(current_user,to_regclass('app420_sso.sessions'),'TRUNCATE'),false))
`).Scan(&all,&unsafe)
 if e!=nil{return e};if !all||unsafe{return ErrUnavailable};return nil
}
func (g *Gateway) Purge(ctx context.Context)error{
 if _,e:=g.db.ExecContext(ctx,`DELETE FROM app420_sso.login_flows WHERE expires_at<clock_timestamp()`);e!=nil{return e}
 if _,e:=g.db.ExecContext(ctx,`DELETE FROM app420_sso.sessions WHERE expires_at<clock_timestamp()`);e!=nil{return e}
 _,e:=g.db.ExecContext(ctx,`DELETE FROM app420_sso.rate_buckets WHERE started_at<clock_timestamp()-interval '2 minutes'`)
 return e
}
func rand32()([]byte,error){v:=make([]byte,32);_,e:=rand.Read(v);return v,e}
func encode(b []byte)string{return base64.RawURLEncoding.EncodeToString(b)}
func decode(v string)([]byte,error){
 if !tokenPattern.MatchString(v){return nil,ErrInvalid}
 out,e:=base64.RawURLEncoding.Strict().DecodeString(v)
 if e!=nil||len(out)!=32{return nil,ErrInvalid}
 return out,nil
}
func digest(v []byte)[32]byte{return sha256.Sum256(v)}
func (g *Gateway) seal(plain []byte)([]byte,error){
 block,e:=aes.NewCipher(g.key[:]);if e!=nil{return nil,e}
 aead,e:=cipher.NewGCM(block);if e!=nil{return nil,e}
 nonce:=make([]byte,aead.NonceSize());if _,e=rand.Read(nonce);e!=nil{return nil,e}
 return aead.Seal(nonce,nonce,plain,[]byte("app420:"+g.App.ID)),nil
}
func (g *Gateway) open(ciphertext []byte)([]byte,error){
 block,e:=aes.NewCipher(g.key[:]);if e!=nil{return nil,ErrUnavailable}
 aead,e:=cipher.NewGCM(block);if e!=nil{return nil,ErrUnavailable}
 if len(ciphertext)<aead.NonceSize()+aead.Overhead(){return nil,ErrUnavailable}
 plain,e:=aead.Open(nil,ciphertext[:aead.NonceSize()],ciphertext[aead.NonceSize():],[]byte("app420:"+g.App.ID))
 if e!=nil{return nil,ErrUnavailable}
 return plain,nil
}
func (g *Gateway) secure(r *http.Request)bool{
 u,_:=url.Parse(g.App.Origin)
 return r.Host==u.Host&&(r.TLS!=nil||g.proxy&&len(r.Header.Values("X-Forwarded-Proto"))==1&&r.Header.Get("X-Forwarded-Proto")=="https")&&r.URL.RawPath==""&&!r.URL.ForceQuery
}
func (g *Gateway) sameOrigin(r *http.Request)bool{
 return len(r.Header.Values("Origin"))==1&&r.Header.Get("Origin")==g.App.Origin&&
 (r.Header.Get("Sec-Fetch-Site")==""||r.Header.Get("Sec-Fetch-Site")=="same-origin")
}
func cookie(r *http.Request,name string)string{
 n:=0;value:=""
 for _,c:=range r.Cookies(){if c.Name==name{n++;value=c.Value}}
 if n!=1{return ""}
 return value
}
func setCookie(w http.ResponseWriter,name,value string,age int){
 http.SetCookie(w,&http.Cookie{Name:name,Value:value,Path:"/",Secure:true,HttpOnly:true,SameSite:http.SameSiteLaxMode,MaxAge:age})
}
func clearCookie(w http.ResponseWriter,name string){setCookie(w,name,"",-1)}
func jsonReply(w http.ResponseWriter,code int,data any){
 w.Header().Set("Content-Type","application/json; charset=utf-8")
 w.WriteHeader(code)
 _=json.NewEncoder(w).Encode(data)
}
func deny(w http.ResponseWriter,code int){jsonReply(w,code,map[string]string{"error":http.StatusText(code)})}
func (g *Gateway) allow(ctx context.Context,action,remote string,max int)bool{
 ip,_,e:=net.SplitHostPort(remote)
 if e!=nil||net.ParseIP(ip)==nil{return false}
 // Never store a source IP, session token or full Authorization header in
 // a rate bucket. App-specific key prevents cross-app correlation.
 mac:=hmac.New(sha256.New,g.key[:]);_,_=mac.Write([]byte(action+"\x00"+ip))
 peerDigest:=mac.Sum(nil)
 var count int
 e=g.db.QueryRowContext(ctx,`INSERT INTO app420_sso.rate_buckets(action,peer_digest,requests)
 VALUES($1,$2,1)
 ON CONFLICT(action,peer_digest) DO UPDATE SET
 requests=CASE WHEN app420_sso.rate_buckets.started_at<clock_timestamp()-interval '1 minute'
 THEN 1 ELSE app420_sso.rate_buckets.requests+1 END,
 started_at=CASE WHEN app420_sso.rate_buckets.started_at<clock_timestamp()-interval '1 minute'
 THEN clock_timestamp() ELSE app420_sso.rate_buckets.started_at END
 RETURNING requests`,action,peerDigest).Scan(&count)
 return e==nil&&count<=max
}
func (g *Gateway) upstream(ctx context.Context,path string,input any,dst any)error{
 raw,e:=json.Marshal(input);if e!=nil{return ErrUnavailable}
 req,e:=http.NewRequestWithContext(ctx,"POST",Authority+strings.TrimPrefix(path,"/"),bytes.NewReader(raw))
 if e!=nil{return ErrUnavailable}
 req.Header.Set("Content-Type","application/json")
 req.Header.Set("Accept","application/json")
 req.SetBasicAuth(g.App.ID,g.secret)
 resp,e:=g.httpClient.Do(req);if e!=nil{return ErrUnavailable}
 defer resp.Body.Close()
 typ,params,e:=mime.ParseMediaType(resp.Header.Get("Content-Type"))
 if e!=nil||typ!="application/json"||len(params)!=0||resp.StatusCode!=200{return ErrUnavailable}
 body,e:=io.ReadAll(io.LimitReader(resp.Body,8193));if e!=nil||len(body)>8192{return ErrUnavailable}
 dec:=json.NewDecoder(bytes.NewReader(body));dec.DisallowUnknownFields()
 if dec.Decode(dst)!=nil||dec.Decode(&struct{}{})!=io.EOF{return ErrUnavailable}
 return nil
}
type scopedSession struct{
 Subject struct{App string `json:"app"`;Sub string `json:"sub"`} `json:"subject"`
 Method string `json:"method"`
 ExpiresAt time.Time `json:"expiresAt"`
 IdleUntil time.Time `json:"idleUntil"`
 ID string `json:"id,omitempty"`
 IssuedAt time.Time `json:"issuedAt,omitempty"`
}
type exchangeResponse struct {
 AccessToken string `json:"accessToken"`
 TokenType string `json:"tokenType"`
 Session scopedSession `json:"session"`
}
type introspection struct{
 Active bool `json:"active"`
 Subject *struct{App string `json:"app"`;Sub string `json:"sub"`} `json:"subject,omitempty"`
 ExpiresAt time.Time `json:"expiresAt,omitempty"`
 IdleUntil time.Time `json:"idleUntil,omitempty"`
 Method string `json:"method,omitempty"`
}
func (g *Gateway) validSession(v scopedSession)bool{
 return v.Subject.App==g.App.ID&&subjectPattern.MatchString(v.Subject.Sub)&&v.Method=="sso"&&
 v.ExpiresAt.After(time.Now())&&v.IdleUntil.After(time.Now())
}
// Current returns only this application's private subject, never 420ID's
// global account ID, provider bearer, email, wallet or any entitlement.
func (g *Gateway) Current(ctx context.Context,r *http.Request)(string,error){
 raw,e:=decode(cookie(r,CookieSession));if e!=nil{return "",ErrNotAuthenticated}
 d:=digest(raw)
 tx,e:=g.db.BeginTx(ctx,nil)
 if e!=nil{return "",ErrUnavailable}
 defer tx.Rollback()
 var sealed []byte;var subject string
 e=tx.QueryRowContext(ctx,`SELECT token_cipher,subject_id FROM app420_sso.sessions
 WHERE cookie_digest=$1 AND expires_at>clock_timestamp() FOR SHARE`,d[:]).Scan(&sealed,&subject)
 if errors.Is(e,sql.ErrNoRows){return "",ErrNotAuthenticated}
 if e!=nil{return "",ErrUnavailable}
 token,e:=g.open(sealed);if e!=nil{return "",ErrUnavailable}
 var response introspection
 if e=g.upstream(ctx,"/v1/sso/introspect",map[string]string{"token":string(token)},&response);e!=nil{return "",ErrUnavailable}
 if !response.Active||response.Subject==nil||response.Subject.App!=g.App.ID||
  response.Subject.Sub!=subject||!subjectPattern.MatchString(subject)||
  response.Method!="sso"||!response.ExpiresAt.After(time.Now())||!response.IdleUntil.After(time.Now()){
  _=tx.Rollback()
  _,_=g.db.ExecContext(ctx,"DELETE FROM app420_sso.sessions WHERE cookie_digest=$1",d[:])
  return "",ErrNotAuthenticated
 }
 if e=tx.Commit();e!=nil{return "",ErrUnavailable}
 return subject,nil
}

func (g *Gateway) start(ctx context.Context,w http.ResponseWriter,r *http.Request){
 if r.URL.RawQuery!=""||!g.allow(ctx,"login",r.RemoteAddr,30){deny(w,429);return}
 flow,e:=rand32();if e!=nil{deny(w,503);return}
 state,e:=rand32();if e!=nil{deny(w,503);return}
 verifier,e:=rand32();if e!=nil{deny(w,503);return}
 rawVerifier:=encode(verifier)
 sealed,e:=g.seal([]byte(rawVerifier));if e!=nil{deny(w,503);return}
 fd,sd:=digest(flow),digest(state)
 _,e=g.db.ExecContext(ctx,`INSERT INTO app420_sso.login_flows
 (flow_digest,state_digest,verifier_cipher,expires_at)
 VALUES($1,$2,$3,clock_timestamp()+interval '5 minutes')`,fd[:],sd[:],sealed)
 if e!=nil{deny(w,503);return}
 callback:=g.App.Origin+APIPath+"auth/callback"
 uri,_:=url.Parse(Authority+"sso/authorize")
 q:=uri.Query()
 challenge:=sha256.Sum256([]byte(rawVerifier))
 q.Set("app",g.App.ID);q.Set("redirect_uri",callback);q.Set("state",encode(state))
 q.Set("code_challenge",encode(challenge[:]));q.Set("code_challenge_method","S256")
 uri.RawQuery=q.Encode()
 setCookie(w,CookieFlow,encode(flow),300)
 http.Redirect(w,r,uri.String(),http.StatusSeeOther)
}
func (g *Gateway) callback(ctx context.Context,w http.ResponseWriter,r *http.Request){
 if !g.allow(ctx,"callback",r.RemoteAddr,60){deny(w,429);return}
 clearCookie(w,CookieFlow)
 values,e:=url.ParseQuery(r.URL.RawQuery)
 if e!=nil||len(values)!=2||len(values["state"])!=1||len(values["code"])!=1{deny(w,400);return}
 flow,e:=decode(cookie(r,CookieFlow));if e!=nil{deny(w,401);return}
 state,e:=decode(values.Get("state"));if e!=nil{deny(w,401);return}
 if _,e=decode(values.Get("code"));e!=nil{deny(w,401);return}
 fd,sd:=digest(flow),digest(state)
 var sealed []byte
 e=g.db.QueryRowContext(ctx,`DELETE FROM app420_sso.login_flows
 WHERE flow_digest=$1 AND state_digest=$2 AND expires_at>clock_timestamp()
 RETURNING verifier_cipher`,fd[:],sd[:]).Scan(&sealed)
 if e!=nil{deny(w,401);return}
 verifier,e:=g.open(sealed);if e!=nil{deny(w,503);return}
 var grant exchangeResponse
 e=g.upstream(ctx,"/v1/sso/token",map[string]string{
  "code":values.Get("code"),"codeVerifier":string(verifier),
  "redirectUri":g.App.Origin+APIPath+"auth/callback",
 },&grant)
 if e!=nil||grant.TokenType!="Bearer"||!tokenPattern.MatchString(grant.AccessToken)||
  !g.validSession(grant.Session){deny(w,401);return}
 expire:=grant.Session.ExpiresAt
 if grant.Session.IdleUntil.Before(expire){expire=grant.Session.IdleUntil}
 cookieRaw,e:=rand32();if e!=nil{deny(w,503);return}
 encrypted,e:=g.seal([]byte(grant.AccessToken));if e!=nil{deny(w,503);return}
 dh:=digest(cookieRaw)
 _,e=g.db.ExecContext(ctx,`INSERT INTO app420_sso.sessions
 (cookie_digest,subject_id,token_cipher,expires_at) VALUES($1,$2,$3,$4)`,
  dh[:],grant.Session.Subject.Sub,encrypted,expire)
 if e!=nil{deny(w,503);return}
 setCookie(w,CookieSession,encode(cookieRaw),int(time.Until(expire).Seconds()))
 http.Redirect(w,r,g.App.Origin+"/",http.StatusSeeOther)
}
func (g *Gateway) session(ctx context.Context,w http.ResponseWriter,r *http.Request){
 if !g.allow(ctx,"status",r.RemoteAddr,120){deny(w,429);return}
 subject,e:=g.Current(ctx,r)
 if errors.Is(e,ErrNotAuthenticated){jsonReply(w,200,map[string]any{"authenticated":false});return}
 if e!=nil{deny(w,503);return}
 jsonReply(w,200,map[string]any{
  "authenticated":true,"app":g.App.ID,"subject":subject,
  "financialAuthority":false,"permissions":[]string{},
 })
}
func (g *Gateway) logout(ctx context.Context,w http.ResponseWriter,r *http.Request){
 if !g.sameOrigin(r){deny(w,403);return}
 if !g.allow(ctx,"logout",r.RemoteAddr,30){deny(w,429);return}
 if r.ContentLength>0||r.Header.Get("Content-Encoding")!=""{deny(w,400);return}
 old:=cookie(r,CookieSession)
 clearCookie(w,CookieSession)
 raw,e:=decode(old);if e!=nil{jsonReply(w,200,map[string]bool{"signedOut":true});return}
 d:=digest(raw)
 var sealed []byte
 e=g.db.QueryRowContext(ctx,`DELETE FROM app420_sso.sessions
 WHERE cookie_digest=$1 RETURNING token_cipher`,d[:]).Scan(&sealed)
 if errors.Is(e,sql.ErrNoRows){jsonReply(w,200,map[string]bool{"signedOut":true});return}
 if e!=nil{deny(w,503);return}
 token,e:=g.open(sealed);if e!=nil{deny(w,503);return}
 var result struct{Revoked bool `json:"revoked"`}
 if e=g.upstream(ctx,"/v1/sso/revoke",map[string]string{"token":string(token)},&result);e!=nil||!result.Revoked{
  // Local session is already gone even when central 420ID is unreachable.
  deny(w,503);return
 }
 jsonReply(w,200,map[string]bool{"signedOut":true})
}
func (g *Gateway) ServeHTTP(w http.ResponseWriter,r *http.Request){
 w.Header().Set("Cache-Control","no-store")
 w.Header().Set("Referrer-Policy","no-referrer")
 w.Header().Set("X-Content-Type-Options","nosniff")
 w.Header().Set("X-Frame-Options","DENY")
 w.Header().Set("Content-Security-Policy","default-src 'none'; frame-ancestors 'none'")
 w.Header().Set("Permissions-Policy","camera=(), microphone=(), geolocation=(), payment=()")
 w.Header().Set("X-Robots-Tag","noindex,nofollow")
 if !g.secure(r){deny(w,403);return}
 ctx,cancel:=context.WithTimeout(r.Context(),8*time.Second);defer cancel()
 switch{
 case r.Method=="GET"&&r.URL.Path==APIPath+"healthz":jsonReply(w,200,map[string]bool{"ready":true})
 case r.Method=="GET"&&r.URL.Path==APIPath+"auth/start":g.start(ctx,w,r)
 case r.Method=="GET"&&r.URL.Path==APIPath+"auth/callback":g.callback(ctx,w,r)
 case r.Method=="GET"&&r.URL.Path==APIPath+"auth/session":
  if r.URL.RawQuery!=""{deny(w,400);return};g.session(ctx,w,r)
 case r.Method=="POST"&&r.URL.Path==APIPath+"auth/logout":
  if r.URL.RawQuery!=""{deny(w,400);return};g.logout(ctx,w,r)
 default:deny(w,404)
 }
}
