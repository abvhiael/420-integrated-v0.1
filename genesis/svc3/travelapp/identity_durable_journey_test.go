package travelapp

import (
 "context"
 "crypto/tls"
 "errors"
 "net/http"
 "net/http/httptest"
 "net/url"
 "os"
 "strings"
 "sync"
 "testing"
 "time"
)

// identityJourneyVerifier stands in for a *trusted* Identity service only in
// this local integration test. It is not an Identity implementation or a
// production session store.
type identityJourneyVerifier struct {
 mu sync.Mutex
 verdicts map[string]IdentitySessionVerdict
 unavailable bool
 calls int
}
func (v *identityJourneyVerifier) VerifyTravelSession(ctx context.Context, token string) (IdentitySessionVerdict,error) {
 if err:=ctx.Err();err!=nil { return IdentitySessionVerdict{},err }
 v.mu.Lock();defer v.mu.Unlock();v.calls++
 if v.unavailable {return IdentitySessionVerdict{},errors.New("identity unavailable")}
 verdict,ok:=v.verdicts[token];if !ok{return IdentitySessionVerdict{},ErrTripUnauthorized}
 return verdict,nil
}
func (v *identityJourneyVerifier) update(token string,change func(*IdentitySessionVerdict)) {
 v.mu.Lock();defer v.mu.Unlock();value:=v.verdicts[token];change(&value);v.verdicts[token]=value
}

func TestIdentityBoundDurableTripsRestartRevocationAndOwnerIsolation(t *testing.T) {
 dir:=t.TempDir();if err:=os.Chmod(dir,0700);err!=nil {t.Fatal(err)}
 store,err:=OpenDurableTripStore(dir);if err!=nil {t.Fatal(err)}
 defer func(){_ = store.Close()}()
 aliceToken:=strings.Repeat("a",48);bobToken:=strings.Repeat("b",48)
 aliceCSRF:=strings.Repeat("c",48);bobCSRF:=strings.Repeat("d",48)
 expiry:=time.Now().UTC().Add(30*time.Minute)
 verifier:=&identityJourneyVerifier{verdicts:map[string]IdentitySessionVerdict{
  aliceToken:{SubjectID:"identity:alice",Audience:travelSessionAudience,CSRFToken:aliceCSRF,ExpiresAt:expiry},
  bobToken:{SubjectID:"identity:bob",Audience:travelSessionAudience,CSRFToken:bobCSRF,ExpiresAt:expiry},
 }}
 // The real deployment must use its authenticated Identity verifier, not this stub.
 newHandler:=func()http.Handler{return NewIdentityBoundTravelHandler(nil,verifier,store,nil)}
 request:=func(method,token,path string,form url.Values)*http.Request{
  body:="";if form!=nil {body=form.Encode()}
  r:=httptest.NewRequest(method,"https://travel.example"+path,strings.NewReader(body))
  r.TLS=&tls.ConnectionState{}
  if form!=nil {r.Header.Set("Content-Type","application/x-www-form-urlencoded")}
  if token!="" {r.AddCookie(&http.Cookie{Name:travelSessionCookie,Value:token})}
  return r
 }
 serve:=func(method,token,path string,form url.Values)*httptest.ResponseRecorder{
  w:=httptest.NewRecorder();newHandler().ServeHTTP(w,request(method,token,path,form));return w
 }
 form:=url.Values{"title":{"alice private route"},"visibility":{"PRIVATE"},"owner_id":{"identity:bob"},"csrf_token":{aliceCSRF}}
 if got:=serve(http.MethodPost,aliceToken,"/travel/trips",form);got.Code!=http.StatusSeeOther {t.Fatalf("alice create status %d: %s",got.Code,got.Body.String())}
 if got:=serve(http.MethodGet,bobToken,"/travel/trips",nil);got.Code!=http.StatusOK||strings.Contains(got.Body.String(),"alice private route") {t.Fatalf("bob read leaked trip: %d %s",got.Code,got.Body.String())}
 if got:=serve(http.MethodGet,aliceToken,"/travel/trips",nil);got.Code!=http.StatusOK||!strings.Contains(got.Body.String(),"alice private route") {t.Fatalf("alice read failed: %d %s",got.Code,got.Body.String())}
 if public,err:=store.ListPublic(context.Background());err!=nil||len(public)!=0 {t.Fatalf("private indexed: %+v %v",public,err)}
 if err:=store.Close();err!=nil {t.Fatal(err)}
 store,err=OpenDurableTripStore(dir);if err!=nil {t.Fatal(err)}
 if got:=serve(http.MethodGet,aliceToken,"/travel/trips",nil);got.Code!=http.StatusOK||!strings.Contains(got.Body.String(),"alice private route") {t.Fatalf("trip missing after restart: %d %s",got.Code,got.Body.String())}
 if got:=serve(http.MethodGet,bobToken,"/travel/trips",nil);got.Code!=http.StatusOK||strings.Contains(got.Body.String(),"alice private route") {t.Fatalf("trip leaked after restart: %d %s",got.Code,got.Body.String())}
 form.Set("csrf_token",bobCSRF)
 if got:=serve(http.MethodPost,aliceToken,"/travel/trips",form);got.Code!=http.StatusForbidden {t.Fatalf("cross-session CSRF accepted: %d",got.Code)}
 verifier.update(aliceToken,func(v *IdentitySessionVerdict){v.Revoked=true})
 if got:=serve(http.MethodGet,aliceToken,"/travel/trips",nil);got.Code!=http.StatusUnauthorized {t.Fatalf("revoked session accepted: %d",got.Code)}
 verifier.update(bobToken,func(v *IdentitySessionVerdict){v.ExpiresAt=time.Now().Add(-time.Minute)})
 if got:=serve(http.MethodGet,bobToken,"/travel/trips",nil);got.Code!=http.StatusUnauthorized {t.Fatalf("expired session accepted: %d",got.Code)}
 verifier.mu.Lock();verifier.unavailable=true;calls:=verifier.calls;verifier.mu.Unlock()
 if got:=serve(http.MethodGet,aliceToken,"/travel/trips",nil);got.Code==http.StatusOK {t.Fatal("Identity outage exposed private trips")}
 verifier.mu.Lock();if verifier.calls<=calls {t.Fatal("cached verdict bypassed Identity outage")};verifier.mu.Unlock()
 if got:=serve(http.MethodGet,"","/travel/trips",nil);got.Code==http.StatusOK {t.Fatal("anonymous private trip access")}
}
