package appgateway

import (
 "bytes"
 "context"
 "crypto/sha256"
 "database/sql"
 "encoding/base64"
 "errors"
 "io"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"
)

type transport func(*http.Request)(*http.Response,error)
func (f transport) RoundTrip(r *http.Request)(*http.Response,error){return f(r)}
func sampleConfig(app string)Config{
 return Config{AppID:app,DB:&sql.DB{},ClientSecret:bytes.Repeat([]byte{23},32),
 SessionKey:bytes.Repeat([]byte{81},32),TrustedTLSProxy:true}
}
func TestAUTH13PinnedCatalogueAndAppSeparation(t *testing.T){
 all,e:=ApprovedApps()
 if e!=nil||len(all.Apps)<7{t.Fatal("catalogue unusable",e)}
 seen:=map[string]bool{}
 for _,a:=range all.Apps{
  if seen[a.ID]{t.Fatal("duplicate app",a.ID)}
  seen[a.ID]=true
  actual,e:=ApprovedApp(a.ID)
  if e!=nil||actual!=a{t.Fatal("pinned app lookup failed",a.ID,e)}
  if !strings.HasSuffix(a.Origin,".420integrated.org"){t.Fatal("untrusted origin",a.Origin)}
  if a.ID=="420wallet" && (a.Origin!="https://wallet.420integrated.org"||a.Capability!="account-only-no-signing-authority"){t.Fatal("Wallet 420ID app must remain account-only",a)}
  if a.Capability==""{t.Fatal("undefined authority boundary",a.ID)}
 }
 for _,id:=range []string{"evil","BONG-GOGGLES","", "../420pay","420unknown"}{
  if _,e=ApprovedApp(id);!errors.Is(e,ErrInvalid){t.Fatal("unapproved app accepted",id,e)}
 }
}
func TestAUTH13FailClosedConfigHostAndProxy(t *testing.T){
 cfg:=sampleConfig("420town")
 if _,e:=New(cfg);e!=nil{t.Fatal(e)}
 for _,mutate:=range []func(*Config){
  func(c *Config){c.TrustedTLSProxy=false},
  func(c *Config){c.ClientSecret=c.SessionKey},
  func(c *Config){c.ClientSecret=[]byte("short")},
  func(c *Config){c.AppID="evil"},
  func(c *Config){c.DB=nil},
 }{
  x:=cfg;mutate(&x)
  if _,e:=New(x);!errors.Is(e,ErrInvalid){t.Fatal("invalid config accepted",e)}
 }
 g,_:=New(cfg)
 for _,tc:=range []struct{url,host,forward string}{
  {"https://town.420integrated.org/420id-api/auth/session","evil.420integrated.org","https"},
  {"https://town.420integrated.org/420id-api/auth/session","town.420integrated.org","http"},
  {"https://town.420integrated.org/420id-api/auth/session","town.420integrated.org",""},
 }{
  req:=httptest.NewRequest("GET",tc.url,nil)
  req.Host=tc.host;req.TLS=nil
  if tc.forward!=""{req.Header.Set("X-Forwarded-Proto",tc.forward)}
  w:=httptest.NewRecorder();g.ServeHTTP(w,req)
  if w.Code!=403{t.Fatal("bad host/proxy accepted",w.Code)}
 }
}
func TestAUTH13AuthenticatedEncryptionIsApplicationBound(t *testing.T){
 a,_:=New(sampleConfig("420town"))
 b,_:=New(sampleConfig("doobtube"))
 sealed,e:=a.seal([]byte("opaque-sensitive-bearer"))
 if e!=nil{t.Fatal(e)}
 plain,e:=a.open(sealed)
 if e!=nil||string(plain)!="opaque-sensitive-bearer"{t.Fatal("own key cannot decrypt",e)}
 if _,e=b.open(sealed);e==nil{t.Fatal("cross-app ciphertext accepted")}
 if _,e=a.open(sealed[:len(sealed)-1]);e==nil{t.Fatal("tampered ciphertext accepted")}
 if _,e=a.open(nil);e==nil{t.Fatal("empty ciphertext accepted")}
}
func TestAUTH13ConfidentialProviderBoundary(t *testing.T){
 cfg:=sampleConfig("doobtube")
 count:=0
 cfg.Client=&http.Client{Transport:transport(func(req *http.Request)(*http.Response,error){
  count++
  if req.URL.String()!="https://auth.420integrated.org/v1/sso/introspect"||
   req.Method!="POST"||req.Header.Get("Content-Type")!="application/json"||
   req.Header.Get("Cookie")!=""||req.Header.Get("Origin")!=""{t.Fatal("bad confidential request",req.URL)}
  user,secret,ok:=req.BasicAuth()
  if !ok||user!="doobtube"||secret!=base64.RawURLEncoding.EncodeToString(cfg.ClientSecret){t.Fatal("bad app client")}
  return &http.Response{StatusCode:200,Header:http.Header{"Content-Type":[]string{"application/json"}},Body:io.NopCloser(strings.NewReader(`{"active":false}`))},nil
 })}
 g,e:=New(cfg);if e!=nil{t.Fatal(e)}
 var state introspection
 if e=g.upstream(context.Background(),"/v1/sso/introspect",map[string]string{"token":strings.Repeat("a",43)},&state);e!=nil||state.Active{t.Fatal("inactive provider result",e)}
 if count!=1{t.Fatal("not confidential")}
 cfg.Client=&http.Client{Transport:transport(func(req *http.Request)(*http.Response,error){
  return &http.Response{StatusCode:200,Header:http.Header{"Content-Type":[]string{"text/html"}},Body:io.NopCloser(strings.NewReader("<h1>redirect spoof</h1>"))},nil
 })}
 g,_=New(cfg)
 if e=g.upstream(context.Background(),"/v1/sso/introspect",nil,&state);!errors.Is(e,ErrUnavailable){t.Fatal("HTML provider response accepted",e)}
}
func TestAUTH13BrowserBoundaryNoBearerOrFinancialAuthority(t *testing.T){
 g,_:=New(sampleConfig("420pay"))
 session:=scopedSession{Method:"sso",ExpiresAt:time.Now().Add(time.Hour),IdleUntil:time.Now().Add(time.Hour)}
 session.Subject.App="420pay";session.Subject.Sub="12345678-1234-4123-8123-123456789abc"
 if !g.validSession(session){t.Fatal("valid app session rejected")}
 session.Subject.App="420town"
 if g.validSession(session){t.Fatal("foreign app subject accepted")}
 session.Subject.App="420pay";session.ExpiresAt=time.Now().Add(-time.Second)
 if g.validSession(session){t.Fatal("expired app session accepted")}
 req:=httptest.NewRequest("POST","https://420pay.420integrated.org/420id-api/auth/logout",nil)
 req.TLS=nil;req.Header.Set("X-Forwarded-Proto","https")
 req.Header.Set("Origin","https://evil.org")
 w:=httptest.NewRecorder();g.ServeHTTP(w,req)
 if w.Code!=403{t.Fatal("cross-site logout accepted")}
 for _,token:=range []string{"x",strings.Repeat("A",44),"a/b?x="+strings.Repeat("a",40)}{
  if _,e:=decode(token);e==nil{t.Fatal("unsafe token accepted")}
 }
 _=sha256.Sum256
}
