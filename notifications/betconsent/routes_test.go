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
func signedRoute(a RouteAssertion,key string)RouteAssertion{
 mac:=hmac.New(sha256.New,[]byte(key))
 _,_=mac.Write([]byte(routeProofText(a)))
 a.Signature=hex.EncodeToString(mac.Sum(nil));return a
}
func TestProviderOwnedRouteRequiredForWalletEnrollmentAndRevocation(t *testing.T){
 path:=filepath.Join(t.TempDir(),"consent.json")
 s,e:=Open(path);if e!=nil{t.Fatal(e)}
 s.RequireRoutes()
 key:="independent-route-provider-HMAC-credential-00000"
 brokerKey:="broker-independent-HMAC-credential-000000000"
 now:=time.Now()
 a:=signed(EnrollmentAssertion{Tenant:"420bet",UserID:"subject-1",
  SubscriptionID:"sub-1",Recipient:"route-1",Channel:"notifications",PolicyVersion:"policy-1",
  Nonce:strings.Repeat("a",64),Action:"enroll",ExpiresAt:now.Add(time.Minute).UnixMilli()},brokerKey)
 if _,e=s.VerifiedEnrollment(a,[]byte(brokerKey),now);e==nil{
  t.Fatal("wallet signed opt-in bypassed independent route ownership")
 }
 route:=signedRoute(RouteAssertion{Tenant:"420bet",UserID:"subject-1",Channel:"notifications",
  Recipient:"route-1",Action:"bind",IssuedAt:now.UnixMilli(),
  ExpiresAt:now.Add(time.Hour).UnixMilli(),Nonce:strings.Repeat("b",64)},key)
 if _,e=s.AttestRoute(route,[]byte(key),now);e!=nil{t.Fatal(e)}
 if _,e=s.VerifiedEnrollment(a,[]byte(brokerKey),now);e!=nil{t.Fatal(e)}
 wrong:=route;wrong.UserID="another-person";wrong.ExpectedRevision=1
 wrong.Nonce=strings.Repeat("c",64);wrong=signedRoute(wrong,key)
 if _,e=s.AttestRoute(wrong,[]byte(key),now);e==nil{t.Fatal("active route hijacked by another subject")}
 if _,e=s.AttestRoute(route,[]byte(key),now);e==nil{t.Fatal("provider attestation replay")}
 revoked:=route;revoked.Action="revoke";revoked.ExpectedRevision=1
 revoked.Nonce=strings.Repeat("d",64);revoked=signedRoute(revoked,key)
 if _,e=s.AttestRoute(revoked,[]byte(key),now);e!=nil{t.Fatal(e)}
 if found:=s.Check(query());found.Consent||!found.Revoked{t.Fatal("delivery remained active after route revocation")}
 if _,e=s.VerifyRoute("subject-1","notifications","route-1",now);e==nil{t.Fatal("revoked route verified")}
 events,e:=s.Revocations(0,10)
 if e!=nil||len(events)!=1||events[0].Reason!="route_withdrawn"||
  events[0].SubscriptionID!="sub-1"{t.Fatalf("route revoke not broadcast to outbox: %#v %v",events,e)}
 if e=s.Close();e!=nil{t.Fatal(e)}
 s,e=Open(path);if e!=nil{t.Fatal(e)};defer s.Close();s.RequireRoutes()
 if found:=s.Check(query());found.Consent||!found.Revoked{t.Fatal("restart restored revoked route")}
}
func TestPrivateRouteHTTPPrivilegesAndExpiry(t *testing.T){
 s,e:=Open(filepath.Join(t.TempDir(),"route.json"));if e!=nil{t.Fatal(e)};defer s.Close()
 read:="route-read-token-xxxxxxxxxxxxxxxxxxxxxxxxx"
 writeToken:="route-provider-token-xxxxxxxxxxxxxxxxxxxx"
 key:="route-provider-HMAC-key-xxxxxxxxxxxxxxxxx"
 h,e:=RouteHandler(s,read,writeToken,key);if e!=nil{t.Fatal(e)}
 now:=time.Now()
 a:=signedRoute(RouteAssertion{Tenant:"420bet",UserID:"subject-1",
  Channel:"mail",Recipient:"route-mail",Action:"bind",IssuedAt:now.UnixMilli(),
  ExpiresAt:now.Add(time.Hour).UnixMilli(),Nonce:strings.Repeat("e",64)},key)
 invoke:=func(path,token string,payload any)*httptest.ResponseRecorder{
  b,_:=json.Marshal(payload)
  req:=httptest.NewRequest(http.MethodPost,path,bytes.NewReader(b))
  req.Header.Set("Authorization","Bearer "+token)
  w:=httptest.NewRecorder();h.ServeHTTP(w,req);return w
 }
 if r:=invoke("/v1/420bet/routes/attest",read,a);r.Code!=403{t.Fatal("reader attested route")}
 if r:=invoke("/v1/420bet/routes/attest",writeToken,a);r.Code!=200{t.Fatal(r.Body.String())}
 query:=map[string]string{"tenant":"420bet","userId":"subject-1",
  "channel":"mail","recipient":"route-mail"}
 if r:=invoke("/v1/420bet/routes/verify",writeToken,query);r.Code!=403{t.Fatal("provider enumerated private route")}
 if r:=invoke("/v1/420bet/routes/verify",read,query);r.Code!=200{t.Fatal("independent route lookup failed")}
 query["userId"]="another-person"
 if r:=invoke("/v1/420bet/routes/verify",read,query);r.Code!=409{t.Fatal("cross-subject route verified")}
}
