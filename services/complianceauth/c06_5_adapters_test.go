package complianceauth

import (
 "context"
 "crypto/ed25519"
 "crypto/rand"
 "crypto/tls"
 "errors"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"
)
func TestC065Ed25519AndImpactProviderDeny(t *testing.T){
 pub,priv,err:=ed25519.GenerateKey(rand.Reader);if err!=nil{t.Fatal(err)}
 verifier:=C065TrustedReviewKeys{Keys:map[string]map[string]ed25519.PublicKey{"reviewer-1":{"key-1":pub}}}
 payload:=[]byte("420compliance/C06.5/review/v1 domain-bound evidence")
 sig:=ed25519.Sign(priv,payload)
 if err:=verifier.VerifyReviewSignature(context.Background(),"reviewer-1","key-1",payload,sig);err!=nil{t.Fatal(err)}
 for _,sample:=range []struct{reviewer,key string;body,signature []byte}{
  {"reviewer-2","key-1",payload,sig},
  {"reviewer-1","wrong",payload,sig},
  {"reviewer-1","key-1",[]byte("other payload"),sig},
  {"reviewer-1","key-1",payload,append([]byte(nil),sig[:len(sig)-1]...)},
 }{if err:=verifier.VerifyReviewSignature(context.Background(),sample.reviewer,sample.key,sample.body,sample.signature);err==nil{t.Fatal("untrusted or replayed proof accepted")}}
 adapter:=C065VerifiedImpactAdapter{}
 if adapter.VerifyReviewImpact(context.Background(),C064DraftVersion{},ImpactReport{})==nil{t.Fatal("missing impact authority accepted")}
 if !(errors.Is(adapter.VerifyReviewImpact(context.Background(),C064DraftVersion{},ImpactReport{}),ErrC065Review)){t.Fatal("impact provider must fail closed")}
}
func TestC065ReviewConsoleFailsClosed(t *testing.T){
 h:=C065ReviewConsole{Origin:"https://compliance.example"}
 request:=httptest.NewRequest(http.MethodGet,"https://compliance.example/private/review",nil)
 request.TLS=&tls.ConnectionState{}
 response:=httptest.NewRecorder()
 h.ServeHTTP(response,request)
 if response.Code!=http.StatusServiceUnavailable{t.Fatalf("missing configured authority: %d",response.Code)}
 if !strings.Contains(response.Header().Get("Cache-Control"),"no-store"){t.Fatal("private data caching allowed")}
 if !strings.Contains(response.Header().Get("Content-Security-Policy"),"default-src 'none'"){t.Fatal("missing CSP")}
 _=time.Now
}
