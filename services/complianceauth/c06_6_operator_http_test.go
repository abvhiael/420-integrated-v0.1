package complianceauth

import (
 "crypto/tls"
 "net/http"
 "net/http/httptest"
 "testing"
)
func TestC066HTTPUnconfiguredAndAnonymousDenied(t *testing.T){
 h:=C066OperatorHTTP{Origin:"https://compliance.example"}
 r:=httptest.NewRequest(http.MethodGet,"https://compliance.example/private/operator",nil)
 r.TLS=&tls.ConnectionState{}
 w:=httptest.NewRecorder()
 h.ServeHTTP(w,r)
 if w.Code!=http.StatusServiceUnavailable{t.Fatalf("unconfigured %d",w.Code)}
 if w.Header().Get("Cache-Control")==""||w.Header().Get("Content-Security-Policy")==""{t.Fatal("private responses must block caching and embedding")}
}
