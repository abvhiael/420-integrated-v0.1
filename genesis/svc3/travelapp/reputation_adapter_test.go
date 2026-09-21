package travelapp

import (
 "context"
 "errors"
 "testing"
 "time"

 "github.com/420integrated/420-integrated/reputation/interactions"
 "github.com/420integrated/420-integrated/reputation/model"
)

type reputationServiceStub struct {review model.Review;proof interactions.Evidence;listErr,getErr,verifyErr error;listCalls,getCalls,proofCalls int}
func (s *reputationServiceStub) ListReviews(_ context.Context,_ model.Domain,_ model.SubjectRef)([]model.Review,error){s.listCalls++;if s.listErr!=nil{return nil,s.listErr};return []model.Review{s.review},nil}
func (s *reputationServiceStub) GetReview(_ context.Context,_ string)(model.Review,error){s.getCalls++;return s.review,s.getErr}
func (s *reputationServiceStub) VerifyInteraction(_ context.Context,_ model.Domain,_ interactions.Kind,_ string,_,_ model.SubjectRef)(interactions.Evidence,error){s.proofCalls++;return s.proof,s.verifyErr}

func TestReputationTravelAdapterCurrentReviewAndRevocation(t *testing.T){
 ctx:=context.Background()
 now:=time.Now().UTC().Add(-time.Hour)
 review:=model.Review{ID:"review-one",Domain:model.DomainTravel,Subject:model.SubjectRef{Type:"PLACE",ID:"place-one"},Author:model.SubjectRef{Type:"USER",ID:"alice"},Rating:5,Verification:model.VerificationVerified,InteractionKind:string(interactions.KindPlaceVisit),VerifiedInteractionRef:"evidence-one",VerificationIssuerID:"issuer-one",VerifiedOccurredAt:now,Status:model.ReviewActive,Version:1,CreatedAt:now,UpdatedAt:now}
 if err:=review.Validate();err!=nil {t.Fatalf("fixture invalid: %v",err)}
 stub:=&reputationServiceStub{review:review,proof:interactions.Evidence{Kind:interactions.KindPlaceVisit,EvidenceRef:"evidence-one",IssuerID:"issuer-one",Reviewer:review.Author,Subject:review.Subject,OccurredAt:now,Source:"trusted",Final:true}}
 adapter,err:=NewReputationTravelAdapter(stub);if err!=nil{t.Fatal(err)}
 list,err:=adapter.PublicTravelReviews(ctx,"place-one");if err!=nil||len(list)!=1||stub.getCalls!=1{t.Fatalf("current public review: %v %v",list,err)}
 ok,err:=adapter.VerifiedInteraction(ctx,list[0]);if err!=nil||!ok||stub.proofCalls!=1{t.Fatalf("proof verification: %v %v",ok,err)}
 stub.proof.Final=false
 ok,err=adapter.VerifiedInteraction(ctx,list[0]);if err!=nil||ok{t.Fatalf("revoked proof displayed: %v %v",ok,err)}
 stub.proof.Final=true;stub.review.Status=model.ReviewHidden
 list,err=adapter.PublicTravelReviews(ctx,"place-one");if err!=nil||len(list)!=0{t.Fatalf("moderated review listed: %v %v",list,err)}
 ok,err=adapter.VerifiedInteraction(ctx,review);if err!=nil||ok{t.Fatalf("moderated review verified: %v %v",ok,err)}
 stub.review=review;stub.verifyErr=errors.New("upstream unavailable")
 ok,err=adapter.VerifiedInteraction(ctx,review);if err==nil||ok{t.Fatalf("upstream outage treated as verified: %v %v",ok,err)}
 stub.verifyErr=nil;stub.getErr=errors.New("review store unavailable")
 if _,err=adapter.PublicTravelReviews(ctx,"place-one");err==nil{t.Fatal("review store outage ignored")}
 if _,err=NewReputationTravelAdapter(nil);err==nil{t.Fatal("nil service accepted")}
}
