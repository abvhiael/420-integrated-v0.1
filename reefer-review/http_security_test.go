package reeferreview

import (
 "net/http"
 "net/http/httptest"
 "testing"
)

func TestRR9SecurityHeadersOnPublicAndDeniedResponses(t *testing.T) {
 h:=HTTP{Service:testService()}.Handler()
 for _,tc:=range []struct{method,path string}{
  {"GET","/v1/news"},
  {"POST","/v1/publications"},
  {"GET","/invalid-path"},
 } {
  req:=httptest.NewRequest(tc.method,tc.path,nil)
  rr:=httptest.NewRecorder()
  h.ServeHTTP(rr,req)
  for key,want:=range map[string]string{
   "X-Content-Type-Options":"nosniff",
   "X-Frame-Options":"DENY",
   "Referrer-Policy":"no-referrer",
   "Cache-Control":"no-store",
   "Cross-Origin-Resource-Policy":"same-origin",
  } {
   if got:=rr.Header().Get(key);got!=want {t.Errorf("%s %s %s got %q",tc.method,tc.path,key,got)}
  }
  if rr.Header().Get("Content-Security-Policy")=="" {t.Fatalf("missing CSP on %s",tc.path)}
 }
}

func TestRR9NoImplicitCORSOptIn(t *testing.T) {
 h:=HTTP{Service:testService()}.Handler()
 req:=httptest.NewRequest(http.MethodOptions,"/v1/publications",nil)
 req.Header.Set("Origin","https://evil.example")
 rr:=httptest.NewRecorder()
 h.ServeHTTP(rr,req)
 if rr.Header().Get("Access-Control-Allow-Origin")!="" {t.Fatal("unexpected cross-origin access")}
}
