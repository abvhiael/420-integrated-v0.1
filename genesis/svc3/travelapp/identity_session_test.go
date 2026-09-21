package travelapp

import (
 "context"
 "crypto/tls"
 "errors"
 "net/http"
 "net/http/httptest"
 "net/url"
 "strings"
 "testing"
 "time"
)

type identityVerdictStub struct {
 verdict IdentitySessionVerdict
 err error
 calls int
 opaque string
}
func (s *identityVerdictStub) VerifyTravelSession(_ context.Context, opaque string) (IdentitySessionVerdict,error) {
 s.calls++;s.opaque=opaque;return s.verdict,s.err
}
func identityRequest(method,path,form,token string)*http.Request {
 req:=httptest.NewRequest(method,"https://travel.example"+path,strings.NewReader(form))
 req.TLS=&tls.ConnectionState{}
 if method==http.MethodPost {req.Header.Set("Content-Type","application/x-www-form-urlencoded")}
 if token!="" {req.AddCookie(&http.Cookie{Name:travelSessionCookie,Value:token,Secure:true,Path:"/"})}
 return req
}
func identityResponse(h http.Handler,req *http.Request)*httptest.ResponseRecorder {
 res:=httptest.NewRecorder();h.ServeHTTP(res,req);return res
}
func TestIdentityCookieAdapterRejectsUntrustedOrExpiredSessions(t *testing.T) {
 now:=time.Date(2026,9,19,12,0,0,0,time.UTC)
 verifier:=&identityVerdictStub{verdict:IdentitySessionVerdict{SubjectID:"alice",Audience:travelSessionAudience,CSRFToken:strings.Repeat("c",40),ExpiresAt:now.Add(time.Hour)}}
 adapter:=IdentityCookieAdapter{Verifier:verifier,Now:func()time.Time{return now}}
 opaque:=strings.Repeat("s",48)
 test:=func(name string,req *http.Request,want bool){t.Helper();t.Run(name,func(t *testing.T){session,err:=adapter.Authenticate(req);if (err==nil)!=want {t.Fatalf("session=%+v err=%v want authorized=%t",session,err,want)};if want && session.SubjectID!="alice" {t.Fatalf("unexpected subject: %+v",session)}})}
 test("valid HTTPS cookie",identityRequest(http.MethodGet,"/travel/trips","",opaque),true)
 test("anonymous",identityRequest(http.MethodGet,"/travel/trips","",""),false)
 forged:=identityRequest(http.MethodGet,"/travel/trips","","");forged.Header.Set("X-User-ID","alice");forged.URL.RawQuery="subject=alice";test("forged headers and query",forged,false)
 plain:=identityRequest(http.MethodGet,"/travel/trips","",opaque);plain.TLS=nil;test("plaintext",plain,false)
 repeated:=identityRequest(http.MethodGet,"/travel/trips","",opaque);repeated.AddCookie(&http.Cookie{Name:travelSessionCookie,Value:opaque});test("duplicate cookie",repeated,false)
 verifier.verdict.Audience="420wallet";test("wrong audience",identityRequest(http.MethodGet,"/travel/trips","",opaque),false)
 verifier.verdict.Audience=travelSessionAudience;verifier.verdict.ExpiresAt=now;test("expired",identityRequest(http.MethodGet,"/travel/trips","",opaque),false)
 verifier.verdict.ExpiresAt=now.Add(time.Hour);verifier.verdict.Revoked=true;test("revoked",identityRequest(http.MethodGet,"/travel/trips","",opaque),false)
 verifier.verdict.Revoked=false;verifier.err=errors.New("identity unavailable");test("upstream unavailable",identityRequest(http.MethodGet,"/travel/trips","",opaque),false)
 if verifier.opaque!=opaque {t.Fatal("session token was not forwarded to trusted verifier")}
}
func TestIdentityBoundTripsSessionIsolationRevocationAndCSRF(t *testing.T) {
 opaque:=strings.Repeat("s",48);csrf:=strings.Repeat("c",40)
 verifier:=&identityVerdictStub{verdict:IdentitySessionVerdict{SubjectID:"alice",Audience:travelSessionAudience,CSRFToken:csrf,ExpiresAt:time.Now().Add(time.Hour)}}
 trips:=NewTripStore()
 handler:=NewIdentityBoundTravelHandler(nil,verifier,trips,NewClaimStore(nil))
 get:=func()*httptest.ResponseRecorder{return identityResponse(handler,identityRequest(http.MethodGet,"/travel/trips","",opaque))}
 if got:=get();got.Code!=http.StatusOK {t.Fatalf("authenticated trips status %d: %s",got.Code,got.Body.String())}
 form:=url.Values{"title":{"private identity-bound plan"},"visibility":{"PRIVATE"},"csrf_token":{csrf},"owner_id":{"bob"}}
 post:=func()*httptest.ResponseRecorder{return identityResponse(handler,identityRequest(http.MethodPost,"/travel/trips",form.Encode(),opaque))}
 form.Set("csrf_token","forged")
 if got:=post();got.Code!=http.StatusForbidden {t.Fatalf("forged CSRF status %d",got.Code)}
 form.Set("csrf_token",csrf)
 if got:=post();got.Code!=http.StatusSeeOther {t.Fatalf("authenticated create status %d: %s",got.Code,got.Body.String())}
 if got:=get();got.Code!=http.StatusOK||!strings.Contains(got.Body.String(),"private identity-bound plan") {t.Fatalf("owner list status %d: %s",got.Code,got.Body.String())}
 verifier.verdict.SubjectID="bob"
 if got:=get();got.Code!=http.StatusOK||strings.Contains(got.Body.String(),"private identity-bound plan") {t.Fatalf("cross-tenant leak: %d %s",got.Code,got.Body.String())}
 verifier.verdict.Revoked=true
 if got:=get();got.Code!=http.StatusUnauthorized {t.Fatalf("revoked session status %d",got.Code)}
 if verifier.calls<5 {t.Fatalf("expected per-request Identity validation, got %d calls",verifier.calls)}
 if len(trips.ListPublic(context.Background()))!=0 {t.Fatal("private trip leaked into public index")}
 if got:=identityResponse(HandlerWithReader(nil),identityRequest(http.MethodGet,"/travel/trips","",opaque));got.Code!=http.StatusServiceUnavailable {t.Fatalf("default handler unexpectedly enabled Trips: %d",got.Code)}
}
