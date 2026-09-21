package travelapp

import (
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
)

func TestPublicDeploymentConfigFailClosed(t *testing.T){
 for _,tc:=range []struct{url string;strict bool;valid bool}{
  {"",false,true},{"",true,false},
  {"https://public.example.org",true,true},
  {"http://127.0.0.1:8090",false,true},
  {"http://127.0.0.1:8090",true,false},
  {"http://example.org",false,false},
  {"https://user:secret@public.example.org",true,false},
  {"https://public.example.org/path",true,false},
  {"https://public.example.org?token=secret",true,false},
  {"file:///tmp/places",false,false},
 } {
  err:= (PublicDeploymentConfig{PublicServiceURL:tc.url,Strict:tc.strict}).Validate()
  if (err==nil)!=tc.valid {t.Errorf("url=%q strict=%v accepted=%v expected=%v",tc.url,tc.strict,err==nil,tc.valid)}
 }
}

func TestPublicDeploymentReadinessWithoutUpstream(t *testing.T){
 h,err:=NewPublicDeploymentHandler(PublicDeploymentConfig{})
 if err!=nil {t.Fatal(err)}
 w:=httptest.NewRecorder()
 h.ServeHTTP(w,httptest.NewRequest(http.MethodGet,"/readyz",nil))
 if w.Code!=http.StatusServiceUnavailable || !strings.Contains(w.Body.String(),"not configured") {t.Fatalf("disconnected readiness %d: %s",w.Code,w.Body.String())}
 for _,path:=range []string{"/travel/trips","/travel/business/claim"} {
  w=httptest.NewRecorder();h.ServeHTTP(w,httptest.NewRequest(http.MethodGet,path,nil))
  if w.Code!=http.StatusServiceUnavailable {t.Errorf("private route %s unexpectedly enabled: %d",path,w.Code)}
 }
 w=httptest.NewRecorder();h.ServeHTTP(w,httptest.NewRequest(http.MethodPost,"/readyz",nil))
 if w.Code!=http.StatusMethodNotAllowed {t.Fatalf("readiness method %d",w.Code)}
}
