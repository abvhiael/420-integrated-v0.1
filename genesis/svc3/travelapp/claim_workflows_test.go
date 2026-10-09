package travelapp

import (
 "context"
 "net/http"
 "net/http/httptest"
 "net/url"
 "strings"
 "testing"
)

type travelClaimReviewer struct{ allow bool }
func (a travelClaimReviewer) AuthorizeClaimReview(_ context.Context,_,_ string,_ ClaimStatus)(bool,error){return a.allow,nil}
type travelClaimDecision struct{ called *bool }
func (d travelClaimDecision) Decide(_ context.Context,_,_ string,_ ClaimStatus)(PlaceClaim,error){*d.called=true;return PlaceClaim{Status:ClaimApproved},nil}

func TestOwnerClaimStatusAndReviewerFailClosed(t *testing.T) {
 csrf:=strings.Repeat("c",40)
 store:=NewClaimStore(nil)
 // Test seeded store; neither HTTP route can create a claim without provenance.
 store.claims["claim-one"]=PlaceClaim{ID:"claim-one",PlaceID:"place-one",ClaimantID:"alice",Status:ClaimPending}
 own:=HandlerWithClaimWorkflows(http.NotFoundHandler(),testIdentity{subject:"alice",token:csrf},store,nil,nil)
 other:=HandlerWithClaimWorkflows(http.NotFoundHandler(),testIdentity{subject:"bob",token:csrf},store,nil,nil)
 get:=func(h http.Handler,path string)*httptest.ResponseRecorder{w:=httptest.NewRecorder();h.ServeHTTP(w,httptest.NewRequest(http.MethodGet,path,nil));return w}
 status:=get(own,"/travel/business/claim/status/claim-one")
 if status.Code!=200||!strings.Contains(status.Body.String(),"PENDING")||status.Header().Get("Cache-Control")!="no-store"{t.Fatalf("owner status %d: %s",status.Code,status.Body.String())}
 if strings.Contains(status.Body.String(),"alice") {t.Fatal("owner identity leaked")}
 if w:=get(other,"/travel/business/claim/status/claim-one");w.Code!=404{t.Fatalf("cross-owner status=%d",w.Code)}
 if w:=get(own,"/travel/business/claim/review/claim-one");w.Code!=503{t.Fatalf("missing reviewer gate=%d",w.Code)}
 denied:=HandlerWithClaimWorkflows(http.NotFoundHandler(),testIdentity{subject:"reviewer",token:csrf},store,travelClaimReviewer{false},travelClaimDecision{})
 if w:=get(denied,"/travel/business/claim/review/claim-one");w.Code!=404{t.Fatalf("unauthorized reviewer=%d",w.Code)}
 called:=false
 permitted:=HandlerWithClaimWorkflows(http.NotFoundHandler(),testIdentity{subject:"reviewer",token:csrf},store,travelClaimReviewer{true},travelClaimDecision{&called})
 if w:=get(permitted,"/travel/business/claim/review/claim-one");w.Code!=200||!strings.Contains(w.Body.String(),"Record decision"){t.Fatalf("review form=%d",w.Code)}
 post:=func(token,decision string)*httptest.ResponseRecorder{
  form:=url.Values{"csrf_token":{token},"claim_id":{"claim-one"},"decision":{decision}}
  req:=httptest.NewRequest(http.MethodPost,"/travel/business/claim/review/claim-one",strings.NewReader(form.Encode()))
  req.Header.Set("Content-Type","application/x-www-form-urlencoded")
  w:=httptest.NewRecorder();permitted.ServeHTTP(w,req);return w
 }
 if w:=post("forged","APPROVED");w.Code!=403 {t.Fatalf("csrf bypass=%d",w.Code)}
 if w:=post(csrf,"INVALID");w.Code!=400 {t.Fatalf("invalid decision=%d",w.Code)}
 if called {t.Fatal("unauthorized decision executed")}
 if w:=post(csrf,"APPROVED");w.Code!=303||!called {t.Fatalf("review decision=%d,called=%t",w.Code,called)}
}
