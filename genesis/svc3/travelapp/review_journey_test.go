package travelapp

import (
 "context"
 "errors"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"

 locationui "github.com/420integrated/420-integrated/location/uikit"
 "github.com/420integrated/420-integrated/reputation/model"
)

type testReviewReader struct {reviews []model.Review;allow bool;err error;calls int}
func (s *testReviewReader) PublicTravelReviews(context.Context,string)([]model.Review,error){return s.reviews,s.err}
func (s *testReviewReader) VerifiedInteraction(context.Context,model.Review)(bool,error){s.calls++;return s.allow,s.err}

func sampleVerifiedTravelReview()model.Review{
 now:=time.Now().UTC()
 return model.Review{ID:"review-1",Domain:model.DomainTravel,Subject:model.SubjectRef{Type:"PLACE",ID:"public-place"},Author:model.SubjectRef{Type:"USER",ID:"alice"},Rating:5,Verification:model.VerificationVerified,InteractionKind:"VISIT",VerifiedInteractionRef:"proof-1",VerificationIssuerID:"issuer-1",VerifiedOccurredAt:now,Status:model.ReviewActive,Version:1,CreatedAt:now,UpdatedAt:now}
}
func TestVerifiedTravelReviewPublicJourney(t *testing.T){
 places:=&stubPublicReader{places:locationui.View{Items:[]locationui.Item{{ID:"public-place",Name:"Public venue",Kind:locationui.KindArea,City:"Regina"}}}}
 active:=sampleVerifiedTravelReview()
 unverified:=active;unverified.ID="opinion";unverified.Verification=model.VerificationUnverified;unverified.InteractionKind="";unverified.VerifiedInteractionRef="";unverified.VerificationIssuerID="";unverified.VerifiedOccurredAt=time.Time{}
 hidden:=active;hidden.ID="hidden";hidden.Status=model.ReviewHidden
 wrong:=active;wrong.ID="other-place";wrong.Subject.ID="private-place"
 source:=&testReviewReader{reviews:[]model.Review{active,unverified,hidden,wrong},allow:true}
 handler:=HandlerWithReviewReader(places,source)
 response:=httptest.NewRecorder();handler.ServeHTTP(response,httptest.NewRequest(http.MethodGet,"/travel/place/public-place/reviews",nil))
 body:=response.Body.String()
 if response.Code!=http.StatusOK||!strings.Contains(body,"Verified interaction")||!strings.Contains(body,"Rating: 5 / 5")||source.calls!=1 {t.Fatalf("verified review journey: %d calls=%d body=%s",response.Code,source.calls,body)}
 for _,secret:=range []string{"private-place","proof-1","hidden","opinion"}{if strings.Contains(body,secret){t.Errorf("review provenance/privacy leak %q",secret)}}
 source.allow=false
 response=httptest.NewRecorder();handler.ServeHTTP(response,httptest.NewRequest(http.MethodGet,"/travel/place/public-place/reviews",nil))
 if response.Code!=http.StatusOK||strings.Contains(response.Body.String(),"Rating: 5 / 5") {t.Fatalf("revoked proof still rated verified: %d %s",response.Code,response.Body.String())}
 response=httptest.NewRecorder();handler.ServeHTTP(response,httptest.NewRequest(http.MethodGet,"/travel/place/private-place/reviews",nil))
 if response.Code!=http.StatusNotFound {t.Fatalf("nonpublic place review status %d",response.Code)}
 source.err=errors.New("private backend error")
 response=httptest.NewRecorder();handler.ServeHTTP(response,httptest.NewRequest(http.MethodGet,"/travel/place/public-place/reviews",nil))
 if response.Code!=http.StatusBadGateway||strings.Contains(response.Body.String(),"private backend error") {t.Fatalf("review backend leak %d %s",response.Code,response.Body.String())}
}
