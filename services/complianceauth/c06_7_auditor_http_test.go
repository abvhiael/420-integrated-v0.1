package complianceauth

import (
 "context"
 "crypto/tls"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"
)
type c067WebSessions struct{ s C067HTTPSession }
func(a c067WebSessions)VerifyAuditorWebSession(context.Context,string)(C067HTTPSession,error){return a.s,nil}
func TestC067AuditorHTTPAuthorizationAndCSRF(t *testing.T){
 token:="long-opaque-auditor-cookie"
 now:=time.Now().UTC()
 h:=C067AuditorHTTP{Origin:"https://compliance.example",Sessions:c067WebSessions{s:C067HTTPSession{Token:token,CSRFToken:strings.Repeat("a",40),ExpiresAt:now.Add(time.Minute)}}}
 cases:=[]struct{name string;cookie,origin,csrf string;tls bool;want int}{
 {"anonymous","","https://compliance.example",strings.Repeat("a",40),true,http.StatusUnauthorized},
 {"noTLS",token,"https://compliance.example",strings.Repeat("a",40),false,http.StatusServiceUnavailable},
 {"cross_origin",token,"https://evil.example",strings.Repeat("a",40),true,http.StatusForbidden},
 {"wrong_csrf",token,"https://compliance.example",strings.Repeat("b",40),true,http.StatusForbidden},
 }
 for _,tc:=range cases{t.Run(tc.name,func(t *testing.T){
  r:=httptest.NewRequest(http.MethodPost,"https://compliance.example/api/v1/auditor/evidence",strings.NewReader(`{"items":[]}`))
  r.Header.Set("Content-Type","application/json")
  r.Header.Set("Origin",tc.origin);r.Header.Set("X-CSRF-Token",tc.csrf)
  if tc.cookie!=""{r.AddCookie(&http.Cookie{Name:"__Host-420ComplianceAuditor",Value:tc.cookie})}
  if tc.tls{r.TLS=&tls.ConnectionState{}}
  w:=httptest.NewRecorder();h.ServeHTTP(w,r)
  if w.Code!=tc.want{t.Fatalf("status %d wanted %d",w.Code,tc.want)}
  if !strings.Contains(w.Header().Get("Cache-Control"),"no-store"){t.Fatal("private auditor response is cacheable")}
 })}
}
func TestC067ArchiveEvidenceFailClosed(t *testing.T){
 a:=C067ArchiveEvidence{}
 if _,err:=a.Inspect(context.Background(),C064AuthorScope{Tenant:"a",Domain:"b",Jurisdiction:"c"},"source1",strings.Repeat("a",64));err==nil{t.Fatal("unconfigured archive disclosed evidence")}
}
