package betconsent
import(
 "bytes"
 "crypto/hmac"
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "path/filepath"
 "strings"
 "testing"
 "time"
)
func signed(a EnrollmentAssertion,key string)EnrollmentAssertion{
 m:=hmac.New(sha256.New,[]byte(key));_,_=m.Write([]byte(enrollmentPayload(a)))
 a.Signature=hex.EncodeToString(m.Sum(nil));return a
}
func TestVerifiedWalletBrokerEnrollmentRestartRevocationAndReplay(t *testing.T){
 path:=filepath.Join(t.TempDir(),"consent.json")
 s,e:=Open(path);if e!=nil{t.Fatal(e)}
 key:="independent-broker-HMAC-key-0000000000000"
 now:=time.Now()
 a:=signed(EnrollmentAssertion{Tenant:"420bet",UserID:"subject-1",
  SubscriptionID:"sub-1",Recipient:"route-1",Channel:"notifications",
  PolicyVersion:"policy-1",Action:"enroll",
  Nonce:strings.Repeat("a",64),ExpiresAt:now.Add(time.Minute).UnixMilli()},key)
 result,e:=s.VerifiedEnrollment(a,[]byte(key),now)
 if e!=nil||result.Revision!=1||!result.Consent{t.Fatal("verified consent failed",e)}
 if _,e=s.VerifiedEnrollment(a,[]byte(key),now);e==nil{t.Fatal("replay accepted")}
 modified:=a;modified.PolicyVersion="policy-2"
 if _,e=s.VerifiedEnrollment(modified,[]byte(key),now);e==nil{t.Fatal("scope alteration accepted")}
 if err:=s.Close();err!=nil{t.Fatal(err)}
 s,e=Open(path);if e!=nil{t.Fatal(e)};defer s.Close()
 if _,e=s.VerifiedEnrollment(a,[]byte(key),now);e==nil{t.Fatal("replay accepted after restart")}
 revoked:=signed(EnrollmentAssertion{Tenant:"420bet",UserID:"subject-1",
  SubscriptionID:"sub-1",Recipient:"route-1",Channel:"notifications",PolicyVersion:"policy-1",
  Action:"revoke",Nonce:strings.Repeat("b",64),ExpectedRevision:1,
  ExpiresAt:now.Add(time.Minute).UnixMilli()},key)
 v,e:=s.VerifiedEnrollment(revoked,[]byte(key),now)
 if e!=nil||!v.Revoked||v.Active{t.Fatal("wallet authorized revocation failed",e)}
 if len(s.data.Revocations)!=1{t.Fatal("revoke did not emit durable cancellation event")}
 if _,e=s.VerifiedEnrollment(a,[]byte(key),now);e==nil{t.Fatal("revoked opt-in restored")}
}
func TestEnrollmentHandlerTokenSeparationAndOperatorCannotGrantOptIn(t *testing.T){
 s,e:=Open(filepath.Join(t.TempDir(),"store.json"));if e!=nil{t.Fatal(e)};defer s.Close()
 read:="read-credential-xxxxxxxxxxxxxxxxxxxxxxxx"
 writeToken:="write-credential-xxxxxxxxxxxxxxxxxxxxxxxx"
 brokerToken:="broker-credential-xxxxxxxxxxxxxxxxxxxxxxxx"
 key:="broker-signer-xxxxxxxxxxxxxxxxxxxxxxxx"
 ordinary,e:=Handler(s,read,writeToken);if e!=nil{t.Fatal(e)}
 privileged,e:=EnrollmentHandler(s,brokerToken,key);if e!=nil{t.Fatal(e)}
 ask:=func(h http.Handler,path,token string,v any)*httptest.ResponseRecorder{
  b,_:=json.Marshal(v)
  r:=httptest.NewRequest(http.MethodPost,path,bytes.NewReader(b))
  r.Header.Set("Authorization","Bearer "+token)
  w:=httptest.NewRecorder();h.ServeHTTP(w,r);return w
 }
 if w:=ask(ordinary,"/v1/420bet/subscriptions/apply",writeToken,
  map[string]any{"subscription":fixture(),"expectedRevision":0});w.Code!=403{
  t.Fatal("operator credential created unsolicited consent",w.Code)}
 a:=signed(EnrollmentAssertion{Tenant:"420bet",UserID:"subject-1",
  SubscriptionID:"sub-1",Recipient:"route-1",Channel:"notifications",
  PolicyVersion:"policy-1",Action:"enroll",Nonce:strings.Repeat("c",64),
  ExpiresAt:time.Now().Add(time.Minute).UnixMilli()},key)
 if w:=ask(privileged,"/v1/420bet/enrollments/commit",writeToken,a);w.Code!=403{
  t.Fatal("operator write token accessed enrollment")}
 if w:=ask(privileged,"/v1/420bet/enrollments/commit",brokerToken,a);w.Code!=200{
  t.Fatal("signed broker enrollment rejected",w.Code,w.Body.String())}
 if w:=ask(privileged,"/v1/420bet/enrollments/commit",brokerToken,a);w.Code!=409{
  t.Fatal("same enrollment signed twice")}
}
