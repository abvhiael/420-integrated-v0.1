package social

// Cross Country Chaos account multiplayer gateway: the existing Go app validates
// every user's 420ID session, canonical host, origin and CSRF boundary before
// signing a short-lived server-to-server request. Browser cookies, wallet IDs,
// raw tokens, and upstream deployment secrets never enter the game service.
import (
 "bytes"
 "context"
 "crypto/hmac"
 "crypto/sha256"
 "encoding/base64"
 "encoding/hex"
 "encoding/json"
 "io"
 "net/http"
 "net/url"
 "strconv"
 "strings"
 "time"
)

type ChaosProxy struct{
 endpoint string
 key [32]byte
 client *http.Client
}
func (h *Handler) EnableChaosProxy(origin,encoded string)error{
 if h==nil||h.Store==nil||h.SignOn==nil||h.Chaos!=nil{return ErrInvalid}
 u,e:=url.Parse(origin)
 if e!=nil||u.Scheme!="https"||u.User!=nil||u.Hostname()==""||
  !strings.HasSuffix(u.Hostname(),".onrender.com")||u.Port()!=""||
  u.Path!=""&&u.Path!="/"||u.RawQuery!=""||u.Fragment!=""{return ErrInvalid}
 decoded,e:=base64.RawURLEncoding.Strict().DecodeString(encoded)
 if e!=nil||len(decoded)!=32{return ErrInvalid}
 c:=&ChaosProxy{endpoint:strings.TrimSuffix(u.String(),"/"),
  client:&http.Client{Timeout:7*time.Second,CheckRedirect:func(*http.Request,[]*http.Request)error{return http.ErrUseLastResponse}}}
 copy(c.key[:],decoded)
 h.Chaos=c
 return nil
}
func chaosSignature(key []byte,method,path,at,subject,name string,body []byte)string{
 digest:=sha256.Sum256(body)
 message:=strings.Join([]string{method,path,at,subject,name,hex.EncodeToString(digest[:])},"\n")
 mac:=hmac.New(sha256.New,key)
 mac.Write([]byte(message))
 return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
func (h *Handler) chaosAPI(ctx context.Context,w http.ResponseWriter,r *http.Request,viewer string){
 if h.Chaos==nil{deny(w,404);return}
 path:=r.URL.Path
 if !strings.HasPrefix(path,"/v1/chaos/rooms")||strings.ContainsAny(path,"%\\")||
  strings.Contains(path,"//")||r.URL.RawQuery!=""{deny(w,404);return}
 if r.Method!="GET"&&r.Method!="POST"{deny(w,405);return}
 var payload []byte
 if r.Method=="POST"{
  if len(r.Header.Values("Content-Type"))!=1||r.Header.Get("Content-Type")!="application/json"||
   r.ContentLength>4096||r.Header.Get("Content-Encoding")!=""{deny(w,400);return}
  raw,e:=io.ReadAll(io.LimitReader(r.Body,4097))
  if e!=nil||len(raw)>4096{deny(w,400);return}
  // Strict top-level JSON with duplicate/alias key rejection; unknown route
  // properties are independently denied by the Node game router.
  clone:=r.Clone(ctx);clone.Body=io.NopCloser(bytes.NewReader(raw));clone.ContentLength=int64(len(raw))
  var fields map[string]json.RawMessage
  if strictJSON(clone,&fields)!=nil{deny(w,400);return}
  payload=raw
 }else if r.ContentLength>0{deny(w,400);return}
 profile,e:=h.Store.MyProfile(ctx,viewer)
 if e!=nil{deny(w,503);return}
 name:=base64.RawURLEncoding.EncodeToString([]byte(profile.DisplayName))
 at:=strconv.FormatInt(time.Now().Unix(),10)
 upstream,e:=http.NewRequestWithContext(ctx,r.Method,h.Chaos.endpoint+path,bytes.NewReader(payload))
 if e!=nil{deny(w,503);return}
 upstream.Header.Set("X-Chaos-Subject",viewer)
 upstream.Header.Set("X-Chaos-Name",name)
 upstream.Header.Set("X-Chaos-Time",at)
 upstream.Header.Set("X-Chaos-Signature",chaosSignature(h.Chaos.key[:],r.Method,path,at,viewer,name,payload))
 if r.Method=="POST"{upstream.Header.Set("Content-Type","application/json")}
 response,e:=h.Chaos.client.Do(upstream)
 if e!=nil{deny(w,503);return}
 defer response.Body.Close()
 if response.Header.Get("Content-Type")!="application/json; charset=utf-8"{
  deny(w,503);return
 }
 content,e:=io.ReadAll(io.LimitReader(response.Body,131073))
 if e!=nil||len(content)>131072||!json.Valid(content){deny(w,503);return}
 switch response.StatusCode{
 case 200,201,400,401,403,404,405,409,413,415,429,503:
  w.Header().Set("Content-Type","application/json; charset=utf-8")
  w.WriteHeader(response.StatusCode)
  _,_=w.Write(content)
 default:deny(w,503)
 }
}
