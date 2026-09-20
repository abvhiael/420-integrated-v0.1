package travelapp

import (
 "errors"
 "net/http"
 "net/http/httptest"
 "net/url"
 "strings"
 "testing"

 locationui "github.com/420integrated/420-integrated/location/uikit"
)

type testIdentity struct {subject string;token string;err error}
func (i testIdentity) Authenticate(*http.Request)(VerifiedSession,error){return VerifiedSession{SubjectID:i.subject,CSRFToken:i.token},i.err}

func postPrivate(handler http.Handler,path string,form url.Values,origin string)*httptest.ResponseRecorder{
 r:=httptest.NewRequest(http.MethodPost,path,strings.NewReader(form.Encode()))
 r.Header.Set("Content-Type","application/x-www-form-urlencoded")
 if origin!="" {r.Header.Set("Origin",origin)}
 response:=httptest.NewRecorder();handler.ServeHTTP(response,r);return response
}

func TestAuthenticatedTripsE2EIsolationAndCSRF(t *testing.T){
 token:=strings.Repeat("x",40)
 store:=NewTripStore()
 deps:=TravelUserDependencies{Identity:testIdentity{subject:"alice",token:token},Trips:store,Claims:NewClaimStore(nil)}
 handler:=HandlerWithUserDependencies(nil,deps)
 unauth:=HandlerWithUserDependencies(nil,TravelUserDependencies{Identity:testIdentity{err:errors.New("unauthorized")},Trips:store,Claims:NewClaimStore(nil)})
 if response:=getPrivate(unauth,"/travel/trips");response.Code!=http.StatusUnauthorized {t.Fatalf("anonymous GET status %d",response.Code)}
 if response:=getPrivate(handler,"/travel/trips");response.Code!=http.StatusOK||!strings.Contains(response.Body.String(),"Create trip"){t.Fatalf("authenticated GET: %d %s",response.Code,response.Body.String())}
 form:=url.Values{"title":{"private plan"},"visibility":{"PRIVATE"},"csrf_token":{token},"owner_id":{"bob"}}
 if response:=postPrivate(handler,"/travel/trips",form,"https://example.com");response.Code!=http.StatusForbidden {t.Fatalf("cross-origin mutation status %d",response.Code)}
 form.Set("csrf_token","forged")
 if response:=postPrivate(handler,"/travel/trips",form,"");response.Code!=http.StatusForbidden {t.Fatalf("forged CSRF status %d",response.Code)}
 form.Set("csrf_token",token)
 if response:=postPrivate(handler,"/travel/trips",form,"");response.Code!=http.StatusSeeOther {t.Fatalf("trip create status %d",response.Code)}
 alice:=getPrivate(handler,"/travel/trips")
 if alice.Code!=http.StatusOK||!strings.Contains(alice.Body.String(),"private plan") {t.Fatalf("owner trip unavailable: %d %s",alice.Code,alice.Body.String())}
 bob:=getPrivate(HandlerWithUserDependencies(nil,TravelUserDependencies{Identity:testIdentity{subject:"bob",token:token},Trips:store,Claims:NewClaimStore(nil)}),"/travel/trips")
 if bob.Code!=http.StatusOK||strings.Contains(bob.Body.String(),"private plan") {t.Fatalf("cross-owner trip leaked: %d %s",bob.Code,bob.Body.String())}
 if public:=getPrivate(HandlerWithReader(nil),"/travel");strings.Contains(public.Body.String(),"private plan") {t.Fatal("private trip in public discovery")}
 if len(store.ListPublic(nil))!=0 {t.Fatal("private trip in public trip index")}
}
func getPrivate(handler http.Handler,path string)*httptest.ResponseRecorder{
 response:=httptest.NewRecorder();handler.ServeHTTP(response,httptest.NewRequest(http.MethodGet,path,nil));return response
}

func TestAuthenticatedClaimE2ERequiresPublicPlaceAndProvenance(t *testing.T){
 token:=strings.Repeat("t",40)
 verifier:=&claimVerifier{allow:false}
 store:=NewClaimStore(verifier)
 reader:=&stubPublicReader{places:locationui.View{Items:[]locationui.Item{{ID:"public-place",Name:"Public place",Kind:locationui.KindArea,City:"Regina"}}}}
 handler:=HandlerWithUserDependencies(reader,TravelUserDependencies{Identity:testIdentity{subject:"alice",token:token},Trips:NewTripStore(),Claims:store})
 if r:=getPrivate(handler,"/travel/business/claim");r.Code!=http.StatusOK||!strings.Contains(r.Body.String(),"Submit for review") {t.Fatalf("claim form unavailable: %d",r.Code)}
 form:=url.Values{"place_id":{"private-place"},"registry_record_id":{"registry-1"},"evidence_ref":{"proof-1"},"csrf_token":{token},"claimant_id":{"bob"}}
 if r:=postPrivate(handler,"/travel/business/claim",form,"");r.Code!=http.StatusNotFound||verifier.calls!=0 {t.Fatalf("nonpublic claim accepted: %d calls=%d",r.Code,verifier.calls)}
 form.Set("place_id","public-place")
 if r:=postPrivate(handler,"/travel/business/claim",form,"");r.Code!=http.StatusServiceUnavailable {t.Fatalf("unverified claim accepted: %d",r.Code)}
 verifier.allow=true
 r:=postPrivate(handler,"/travel/business/claim",form,"")
 if r.Code!=http.StatusAccepted||!strings.Contains(r.Body.String(),"No place-page control has been granted") {t.Fatalf("verified request not pending: %d %s",r.Code,r.Body.String())}
 if len(store.claims)!=1 {t.Fatalf("want one claim, got %d",len(store.claims))}
 for _,c:=range store.claims {if c.ClaimantID!="alice"||c.Status!=ClaimPending {t.Fatalf("claim escalated or forged: %+v",c)}}
}
