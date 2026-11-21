package social

import (
 "bytes"
 "encoding/base64"
 "net/http"
 "net/http/httptest"
 "testing"
)

func TestTrustedWorkerIngressIsSecretBound(t *testing.T) {
 h:=&Handler{host:"bonggoggles.420integrated.org"}
 key:=base64.RawURLEncoding.EncodeToString(bytes.Repeat([]byte{0x52},32))
 wrong:=base64.RawURLEncoding.EncodeToString(bytes.Repeat([]byte{0x63},32))
 newRequest:=func(host,proto,secret string)*http.Request{
  req:=httptest.NewRequest("GET","http://"+host+"/healthz",nil)
  if proto!=""{req.Header.Set("X-Forwarded-Proto",proto)}
  if secret!=""{req.Header.Set("X-Social420-Edge-Key",secret)}
  return req
 }
 check:=func(name string,req *http.Request,want int){
  t.Helper()
  reply:=httptest.NewRecorder()
  h.ServeHTTP(reply,req)
  if reply.Code!=want{t.Fatalf("%s: got %d, want %d; body=%s",name,reply.Code,want,reply.Body.String())}
 }
 canonical:="bonggoggles.420integrated.org"
 render:="bonggoggles-social.onrender.com"
 check("canonical HTTPS retained",newRequest(canonical,"https",""),http.StatusOK)
 check("canonical HTTP rejected",newRequest(canonical,"http",""),http.StatusForbidden)
 check("render hostname forbidden without credential",newRequest(render,"https",""),http.StatusForbidden)
 check("render hostname forbidden with unconfigured credential",newRequest(render,"https",key),http.StatusForbidden)
 if e:=h.ConfigureTrustedWorker("not-a-32-byte-secret");e==nil{t.Fatal("weak edge secret accepted")}
 if e:=h.ConfigureTrustedWorker(key);e!=nil{t.Fatal("valid edge secret rejected",e)}
 if e:=h.ConfigureTrustedWorker(wrong);e==nil{t.Fatal("trusted edge secret unexpectedly replaced")}
 check("authenticated Render ingress",newRequest(render,"https",key),http.StatusOK)
 check("Render ingress without key",newRequest(render,"https",""),http.StatusForbidden)
 check("Render ingress invalid key",newRequest(render,"https",wrong),http.StatusForbidden)
 check("Render ingress malformed key",newRequest(render,"https","abc"),http.StatusForbidden)
 check("Render ingress without HTTPS",newRequest(render,"http",key),http.StatusForbidden)
 check("Render ingress without forwarded protocol",newRequest(render,"",key),http.StatusForbidden)
 check("unknown hostname",newRequest("untrusted.example","https",key),http.StatusForbidden)
 duplicateKey:=newRequest(render,"https",key)
 duplicateKey.Header.Add("X-Social420-Edge-Key",key)
 check("duplicate trusted edge header",duplicateKey,http.StatusForbidden)
 duplicateProto:=newRequest(render,"https",key)
 duplicateProto.Header.Add("X-Forwarded-Proto","http")
 check("ambiguous forwarded protocol",duplicateProto,http.StatusForbidden)
 rawPath:=newRequest(render,"https",key)
 rawPath.URL.RawPath="/%68ealthz"
 check("encoded alternate path",rawPath,http.StatusForbidden)
}
