package rpcapi

import (
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
)

func TestBrowserCORSOriginAndPreflight(t *testing.T) {
 const origin="https://wallet.example"
 calls:=0
 next:=http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){calls++;w.WriteHeader(http.StatusAccepted)})
 wrapped,err:=BrowserCORS(next,[]string{origin,"http://localhost:3000"})
 if err!=nil{t.Fatal(err)}
 request:=func(method,source string) *httptest.ResponseRecorder {
  t.Helper()
  r:=httptest.NewRequest(method,"/",nil)
  if source!=""{r.Header.Set("Origin",source)}
  if method==http.MethodOptions{r.Header.Set("Access-Control-Request-Method","POST");r.Header.Set("Access-Control-Request-Headers","content-type")}
  w:=httptest.NewRecorder();wrapped.ServeHTTP(w,r);return w
 }
 preflight:=request(http.MethodOptions,origin)
 if preflight.Code!=http.StatusNoContent||preflight.Header().Get("Access-Control-Allow-Origin")!=origin||preflight.Header().Get("Access-Control-Allow-Headers")!="Content-Type"||calls!=0 {t.Fatalf("invalid browser preflight: %d %v",preflight.Code,preflight.Header())}
 accepted:=request(http.MethodPost,origin)
 if accepted.Code!=http.StatusAccepted||accepted.Header().Get("Access-Control-Allow-Origin")!=origin||calls!=1{t.Fatalf("allowed origin rejected: %d",accepted.Code)}
 denied:=request(http.MethodPost,"https://untrusted.example")
 if denied.Code!=http.StatusForbidden||denied.Header().Get("Access-Control-Allow-Origin")!=""||calls!=1{t.Fatalf("untrusted origin reached RPC: %d",denied.Code)}
 native:=request(http.MethodPost,"")
 if native.Code!=http.StatusAccepted||calls!=2 {t.Fatalf("non-browser operator/client blocked: %d",native.Code)}
}

func TestBrowserCORSRejectsUnsafeConfigurationAndPreflights(t *testing.T){
 next:=http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){t.Fatal("invalid request reached backend")})
 for _,origin:=range []string{"*","http://public.example","https://wallet.example/","https://user@wallet.example","https://wallet.example?token=x","https://wallet.example\r\nX:1"}{
  if _,err:=BrowserCORS(next,[]string{origin});err==nil{t.Errorf("accepted unsafe origin %q",origin)}
 }
 h,err:=BrowserCORS(next,[]string{"https://wallet.example"})
 if err!=nil{t.Fatal(err)}
 for _,header:=range []string{"authorization","content-type, x-operator-secret"}{
  req:=httptest.NewRequest(http.MethodOptions,"/",nil)
  req.Header.Set("Origin","https://wallet.example")
  req.Header.Set("Access-Control-Request-Method","POST")
  req.Header.Set("Access-Control-Request-Headers",header)
  w:=httptest.NewRecorder();h.ServeHTTP(w,req)
  if w.Code!=http.StatusForbidden||strings.Contains(strings.ToLower(w.Header().Get("Access-Control-Allow-Headers")),"authorization"){t.Fatalf("unsafe header approved: %s %d",header,w.Code)}
 }
}
