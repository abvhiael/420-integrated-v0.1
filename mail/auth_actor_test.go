package mail

import (
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "testing"
)

func TestAuthenticatedActorIntrospectionUsesMailIdentityAuthority(t *testing.T) {
 h,_,_:=testHTTPHandler(t)
 valid:=performMailRequest(t,h,http.MethodGet,"/v1/auth/actor","alice.420",nil)
 if valid.Code!=http.StatusOK { t.Fatalf("verified actor status=%d: %s",valid.Code,valid.Body.String()) }
 var r struct { Actor string `json:"actor"`; Service string `json:"service"`; Verified bool `json:"verified"` }
 if err:=json.Unmarshal(valid.Body.Bytes(),&r);err!=nil{t.Fatal(err)}
 if r.Actor!="alice.420"||r.Service!=ServiceID||!r.Verified{t.Fatalf("unexpected actor %+v",r)}
 if valid.Header().Get("Cache-Control")!="no-store"{t.Fatal("actor response cached")}
 for _,actor:=range []string{"","unknown.420"}{
  denied:=performMailRequest(t,h,http.MethodGet,"/v1/auth/actor",actor,nil)
  if denied.Code!=http.StatusUnauthorized{t.Fatalf("actor %q unexpectedly authorized: %d",actor,denied.Code)}
 }
 h.Service.Identities=nil
 missing:=performMailRequest(t,h,http.MethodGet,"/v1/auth/actor","alice.420",nil)
 if missing.Code!=http.StatusServiceUnavailable{t.Fatalf("missing identity provider: %d",missing.Code)}
 h.Service.Identities=testIDs{"alice.420":true}
 noPost:=performMailRequest(t,h,http.MethodPost,"/v1/auth/actor","alice.420",nil)
 if noPost.Code!=http.StatusNotFound{t.Fatalf("incorrect method accepted %d",noPost.Code)}
 request:=httptest.NewRequest(http.MethodGet,"/v1/auth/actor",nil)
 request.Header.Set("X-Test-Actor","alice.420")
 rec:=httptest.NewRecorder()
 h.ServeHTTP(rec,request)
 if rec.Code!=http.StatusOK{t.Fatalf("regular mail auth refused %d",rec.Code)}
}
