package social

import (
 "bytes"
 "context"
 "crypto/hmac"
 "crypto/sha256"
 "encoding/base64"
 "encoding/json"
 "errors"
 "io"
 "net"
 "net/http"
 "net/url"
 "strings"
 "time"
)

type Handler struct{
 Store *Store
 SignOn *SignOn
 Messages *MessageService
 Games *AccountGames
 XP *Contributions
 MonetizationEnabled bool // AUTH-11: disabled until explicit confidential 420ID opt-in backend
 Origin string
 host string
}
func NewHandler(store *Store,sso *SignOn,origin string)(*Handler,error){
 u,e:=url.Parse(origin)
 if e!=nil||u.Scheme!="https"||u.Hostname()!="bonggoggles.420integrated.org"||
 u.Port()!=""||u.Path!=""&&u.Path!="/"||u.RawQuery!=""||u.Fragment!=""||u.User!=nil||
 store==nil||sso==nil||sso.Store!=store{return nil,ErrInvalid}
 return &Handler{Store:store,SignOn:sso,Origin:strings.TrimSuffix(origin,"/"),host:u.Host},nil
}
// EnableAccountExtras is opt-in; legacy AUTH-8 behavior has no message or
// off-chain game authority. Both services must share this authenticated store.
func (h *Handler) EnableAccountExtras(messages *MessageService,games *AccountGames)error{
 if h==nil||messages==nil||games==nil||messages.Store!=h.Store||games.Store!=h.Store{return ErrInvalid}
 h.Messages=messages;h.Games=games
 return nil
}
// EnableXP is a separate opt-in from AUTH-8/9 and uses this exact 420ID
// authenticated app Store, never Wallet or a browser-submitted subject.
func (h *Handler) EnableXP(x *Contributions)error{
 if h==nil||x==nil||x.Store!=h.Store{return ErrInvalid}
 h.XP=x
 return nil
}
func (h *Handler) EnableMonetization()error{
 if h==nil||h.SignOn==nil||h.SignOn.Broker==nil{return ErrInvalid}
 if _,ok:=h.SignOn.Broker.(monetizationBroker);!ok{return ErrUnavailable}
 h.MonetizationEnabled=true
 return nil
}
func writeJSON(w http.ResponseWriter,code int,value any){
 w.Header().Set("Content-Type","application/json; charset=utf-8")
 w.WriteHeader(code)
 _=json.NewEncoder(w).Encode(value)
}
func deny(w http.ResponseWriter,code int){writeJSON(w,code,map[string]string{"error":http.StatusText(code)})}
func strictJSON(r *http.Request,dst any)error{
 if r.ContentLength>4096||r.Header.Get("Content-Encoding")!=""||
 len(r.Header.Values("Content-Type"))!=1||r.Header.Get("Content-Type")!="application/json"{return ErrInvalid}
 raw,e:=io.ReadAll(io.LimitReader(r.Body,4097));if e!=nil||len(raw)>4096{return ErrInvalid}
 // Reject duplicate top-level property names; no alternate values can be
 // smuggled past a server-side authorization or content check.
 dec:=json.NewDecoder(bytes.NewReader(raw))
 first,e:=dec.Token();if e!=nil||first!=json.Delim('{'){return ErrInvalid}
 seen:=map[string]bool{}
 for dec.More(){
  token,e:=dec.Token();if e!=nil{return ErrInvalid}
  name,ok:=token.(string);if !ok{return ErrInvalid}
  // encoding/json accepts case-insensitive struct field names. Reject
  // differently-cased duplicates and Unicode key aliases rather than
  // letting a later JSON spelling override authorization-sensitive values.
  for _,ch:=range name{
   if ch!='_'&&(ch<'A'||ch>'Z')&&(ch<'a'||ch>'z')&&(ch<'0'||ch>'9'){return ErrInvalid}
  }
  name=strings.ToLower(name)
  if seen[name]{return ErrInvalid}
  seen[name]=true
  var v json.RawMessage
  if dec.Decode(&v)!=nil{return ErrInvalid}
 }
 end,e:=dec.Token();if e!=nil||end!=json.Delim('}'){return ErrInvalid}
 if dec.Decode(&struct{}{})!=io.EOF{return ErrInvalid}
 dec=json.NewDecoder(bytes.NewReader(raw));dec.DisallowUnknownFields()
 if dec.Decode(dst)!=nil||dec.Decode(&struct{}{})!=io.EOF{return ErrInvalid}
 return nil
}
func setCookie(w http.ResponseWriter,name,value string,maxAge int){
 http.SetCookie(w,&http.Cookie{Name:name,Value:value,Path:"/",MaxAge:maxAge,
  Secure:true,HttpOnly:true,SameSite:http.SameSiteLaxMode})
}
func cleanCookie(w http.ResponseWriter,name string){setCookie(w,name,"",-1)}
func getCookie(r *http.Request,name string)string{
 cookies:=r.Cookies()
 count:=0;var value string
 for _,c:=range cookies{if c.Name==name{count++;value=c.Value}}
 if count!=1{return ""}
 return value
}
func validCursor(raw string)(time.Time,string,error){
 if raw==""{return time.Time{},"",nil}
 if len(raw)>160{return time.Time{},"",ErrInvalid}
 bytes,e:=base64.RawURLEncoding.Strict().DecodeString(raw);if e!=nil{return time.Time{},"",ErrInvalid}
 parts:=strings.Split(string(bytes),"|");if len(parts)!=2||!uuid.MatchString(parts[1]){return time.Time{},"",ErrInvalid}
 tm,e:=time.Parse(time.RFC3339Nano,parts[0]);if e!=nil||tm.After(time.Now().Add(time.Minute)){return time.Time{},"",ErrInvalid}
 return tm,parts[1],nil
}
func nextCursor(p Post)string{
 return base64.RawURLEncoding.EncodeToString([]byte(p.CreatedAt.UTC().Format(time.RFC3339Nano)+"|"+p.ID))
}
func (h *Handler) allowed(r *http.Request)bool{
 if r.Host!=h.host||r.URL.RawPath!=""||r.URL.ForceQuery{return false}
 // Render must only be reachable through the reviewed Cloudflare/Render TLS
 // ingress. Never trust browser-supplied proxy headers from public ingress.
 proto:=r.Header.Values("X-Forwarded-Proto")
 return r.TLS!=nil||len(proto)==1&&proto[0]=="https"
}
func (h *Handler) ServeHTTP(w http.ResponseWriter,r *http.Request){
 w.Header().Set("Cache-Control","no-store")
 w.Header().Set("Referrer-Policy","no-referrer")
 w.Header().Set("X-Content-Type-Options","nosniff")
 w.Header().Set("X-Frame-Options","DENY")
 w.Header().Set("Content-Security-Policy","default-src 'none'; frame-ancestors 'none'")
 w.Header().Set("Permissions-Policy","camera=(), microphone=(), geolocation=()")
 if !h.allowed(r){deny(w,403);return}
 if r.URL.Path=="/healthz"&&r.Method=="GET"{writeJSON(w,200,map[string]bool{"ready":true});return}
 if r.URL.Path=="/auth/start"&&r.Method=="GET"{
  if !h.rate(r.Context(),"login",r.RemoteAddr,30){deny(w,429);return}
  if r.URL.RawQuery!=""{deny(w,400);return}
  ctx,cancel:=context.WithTimeout(r.Context(),5*time.Second);defer cancel()
  destination,flow,e:=h.SignOn.Begin(ctx)
  if e!=nil{deny(w,503);return}
  setCookie(w,flowCookieName,flow,300)
  http.Redirect(w,r,destination,http.StatusSeeOther);return
 }
 if r.URL.Path=="/auth/callback"&&r.Method=="GET"{
  // Callback codes may be attacker-supplied. Budget attempts by the
  // actual ingress socket IP, not its changing port or forwarded headers,
  // before decrypting any flow or contacting the central identity broker.
  if !h.rate(r.Context(),"callback",r.RemoteAddr,60){deny(w,429);return}
  if r.URL.Query().Has("error")||len(r.URL.Query())!=2||len(r.URL.Query()["code"])!=1||
   len(r.URL.Query()["state"])!=1{deny(w,400);return}
  flow:=getCookie(r,flowCookieName)
  cleanCookie(w,flowCookieName)
  ctx,cancel:=context.WithTimeout(r.Context(),8*time.Second);defer cancel()
  cookie,e:=h.SignOn.Finish(ctx,flow,r.URL.Query().Get("state"),r.URL.Query().Get("code"))
  if e!=nil{deny(w,401);return}
  setCookie(w,sessionCookieName,cookie,7*24*3600)
  http.Redirect(w,r,"/social",http.StatusSeeOther);return
 }
 if strings.HasPrefix(r.URL.Path,"/auth/")&&r.URL.Path!="/auth/logout"{deny(w,404);return}
 // Exact same-origin API: no CORS, no authorization cookies from another
 // origin, and no state changes through a GET or form submission.
 if r.Method!="GET"&&r.Method!="POST"&&r.Method!="PUT"&&r.Method!="DELETE"{deny(w,405);return}
 if r.Method!="GET"{
  if len(r.Header.Values("Origin"))!=1||r.Header.Get("Origin")!=h.Origin||
  r.Header.Get("Sec-Fetch-Site")!=""&&r.Header.Get("Sec-Fetch-Site")!="same-origin"{
   deny(w,403);return
  }
 }else if r.URL.RawQuery!=""&&r.URL.Path!="/v1/feed"{deny(w,400);return}
 ctx,cancel:=context.WithTimeout(r.Context(),8*time.Second);defer cancel()
 cookie:=getCookie(r,sessionCookieName)
 viewer,e:=h.SignOn.Verify(ctx,cookie)
 if errors.Is(e,ErrForbidden)||errors.Is(e,ErrInvalid){deny(w,401);return}
 if e!=nil{deny(w,503);return}
 if r.Method!="GET"&&!h.rate(ctx,r.URL.Path,viewer,60){deny(w,429);return}
 if r.URL.Path=="/auth/logout"&&r.Method=="POST"{
  if strictJSON(r,&struct{}{})!=nil{deny(w,400);return}
  e=h.SignOn.Logout(ctx,cookie)
  cleanCookie(w,sessionCookieName)
  if e!=nil{deny(w,503);return}
  writeJSON(w,200,map[string]bool{"signedOut":true});return
 }
 h.api(ctx,w,r,viewer)
}
func (h *Handler) api(ctx context.Context,w http.ResponseWriter,r *http.Request,viewer string){
 path:=r.URL.Path
 if strings.HasPrefix(path,"/v1/messages")||strings.HasPrefix(path,"/v1/account-games"){
  h.accountExtras(ctx,w,r,viewer);return
 }
 switch{
 case path=="/v1/monetization"&&r.Method=="GET":
  if !h.MonetizationEnabled{deny(w,404);return}
  result,e:=h.SignOn.CurrentMonetization(ctx,getCookie(r,sessionCookieName))
  if errors.Is(e,ErrForbidden){deny(w,401);return}
  if e!=nil{deny(w,503);return}
  // Bind the private 420ID projection to this exact verified
  // BongGoggles app subject. A browser must reject a response from an
  // earlier cookie/account even if it arrives after a later /v1/me.
  writeJSON(w,200,map[string]any{"subject":viewer,"programme":result});return
 case path=="/v1/xp"&&r.Method=="GET":
  if h.XP==nil{deny(w,404);return}
  result,e:=h.XP.Summary(ctx,viewer)
  if e!=nil{deny(w,503);return}
  writeJSON(w,200,result);return
 case path=="/v1/me"&&r.Method=="GET":
  m,e:=h.Store.MyProfile(ctx,viewer)
  if e!=nil{deny(w,503);return}
  writeJSON(w,200,map[string]any{"profile":m,"walletRequired":false});return
 case path=="/v1/me"&&r.Method=="PUT":
  var x struct{DisplayName string `json:"displayName"`;Bio string `json:"bio"`}
  if strictJSON(r,&x)!=nil{deny(w,400);return}
  m,e:=h.Store.SetProfile(ctx,viewer,x.DisplayName,x.Bio)
  if errors.Is(e,ErrInvalid){deny(w,400);return}
  if e!=nil{deny(w,503);return}
  writeJSON(w,200,map[string]any{"profile":m});return
 case path=="/v1/feed"&&r.Method=="GET":
  values:=r.URL.Query()
  if len(values)>1||len(values["cursor"])>1{deny(w,400);return}
  before,id,e:=validCursor(values.Get("cursor"));if e!=nil{deny(w,400);return}
  posts,e:=h.Store.Feed(ctx,viewer,before,id,30)
  if e!=nil{deny(w,503);return}
  var cursor any=nil
  if len(posts)==30{cursor=nextCursor(posts[len(posts)-1])}
  writeJSON(w,200,map[string]any{"posts":posts,"nextCursor":cursor,"source":"bonggoggles-account-social","onChain":false});return
 case path=="/v1/posts"&&r.Method=="POST":
  var x struct{Body string `json:"body"`}
  if strictJSON(r,&x)!=nil{deny(w,400);return}
  var post Post
  var e error
  if h.XP!=nil{post,e=h.XP.PublishPost(ctx,viewer,x.Body)}else{post,e=h.Store.NewPost(ctx,viewer,x.Body)}
  if errors.Is(e,ErrInvalid){deny(w,400);return}
  if e!=nil{deny(w,503);return}
  writeJSON(w,201,map[string]any{"post":post,"onChain":false});return
 case strings.HasPrefix(path,"/v1/posts/"):
  segments:=strings.Split(strings.TrimPrefix(path,"/v1/posts/"),"/")
  if len(segments)<1||len(segments)>2||!uuid.MatchString(segments[0]){deny(w,404);return}
  id:=segments[0]
  if len(segments)==1&&r.Method=="DELETE"{
   var e error
   if h.XP!=nil{e=h.XP.DeletePost(ctx,viewer,id)}else{e=h.Store.DeletePost(ctx,viewer,id)}
   if errors.Is(e,ErrNotFound){deny(w,404);return}
   if e!=nil{deny(w,503);return}
   writeJSON(w,200,map[string]bool{"deleted":true});return
  }
  if len(segments)==2&&segments[1]=="comments"{
   if r.Method=="GET"{
    comments,e:=h.Store.Comments(ctx,viewer,id)
    if errors.Is(e,ErrNotFound){deny(w,404);return}
    if e!=nil{deny(w,503);return}
    writeJSON(w,200,map[string]any{"comments":comments});return
   }
   if r.Method=="POST"{
    var x struct{Body string `json:"body"`}
    if strictJSON(r,&x)!=nil{deny(w,400);return}
    var comment Comment
    var e error
    if h.XP!=nil{comment,e=h.XP.PublishComment(ctx,viewer,id,x.Body)}else{comment,e=h.Store.NewComment(ctx,viewer,id,x.Body)}
    if errors.Is(e,ErrInvalid){deny(w,400);return}
    if errors.Is(e,ErrNotFound){deny(w,404);return}
    if e!=nil{deny(w,503);return}
    writeJSON(w,201,map[string]any{"comment":comment});return
   }
  }
  if len(segments)==2&&segments[1]=="reaction"{
   if r.Method!="PUT"&&r.Method!="DELETE"{deny(w,405);return}
   if strictJSON(r,&struct{}{})!=nil{deny(w,400);return}
   e:=h.Store.React(ctx,viewer,id,r.Method=="PUT")
   if errors.Is(e,ErrInvalid){deny(w,400);return}
   if errors.Is(e,ErrForbidden)||errors.Is(e,ErrConflict){deny(w,409);return}
   if e!=nil{deny(w,503);return}
   writeJSON(w,200,map[string]bool{"reacted":r.Method=="PUT"});return
  }
  deny(w,404);return
 case strings.HasPrefix(path,"/v1/relationships/")&&(r.Method=="PUT"||r.Method=="DELETE"):
  segments:=strings.Split(strings.TrimPrefix(path,"/v1/relationships/"),"/")
  if len(segments)!=2||!uuid.MatchString(segments[1])||segments[0]!="follow"&&segments[0]!="block"{deny(w,400);return}
  if strictJSON(r,&struct{}{})!=nil{deny(w,400);return}
  e:=h.Store.Relationship(ctx,viewer,segments[1],segments[0],r.Method=="PUT")
  if errors.Is(e,ErrInvalid){deny(w,400);return}
  if errors.Is(e,ErrNotFound){deny(w,404);return}
  if errors.Is(e,ErrForbidden){deny(w,403);return}
  if e!=nil{deny(w,503);return}
  writeJSON(w,200,map[string]bool{"updated":true});return
 case path=="/v1/reports"&&r.Method=="POST":
  var x struct{PostID string `json:"postId"`;Reason string `json:"reason"`}
  if strictJSON(r,&x)!=nil{deny(w,400);return}
  e:=h.Store.Report(ctx,viewer,x.PostID,x.Reason)
  if errors.Is(e,ErrInvalid){deny(w,400);return}
  if errors.Is(e,ErrConflict){deny(w,409);return}
  if e!=nil{deny(w,503);return}
  writeJSON(w,201,map[string]bool{"received":true});return
 }
 deny(w,404)
}

// HMAC protects raw network addresses and pseudo-subjects from appearing in
// rate-limit rows; the key is the server-only session encryption key.
func (h *Handler) rate(ctx context.Context,action,principal string,limit int)bool{
 if action=="login"||action=="callback"{
  // RemoteAddr includes an ephemeral TCP port; hashing the full value
  // lets one client evade the rate limit by reconnecting. Trust only the
  // actual ingress socket address, never unvalidated forwarded-IP headers.
  host,_,err:=net.SplitHostPort(principal)
  if err!=nil||net.ParseIP(host)==nil{return false}
  principal=host
 }
 mac:=hmac.New(sha256.New,h.SignOn.key[:]);_,_=mac.Write([]byte(principal))
 raw:=mac.Sum(nil)
 if len(action)>24{action="social-write"} // bounded DB schema enum length
 ok,e:=h.Store.Allow(ctx,raw,action,limit)
 return e==nil&&ok
}
