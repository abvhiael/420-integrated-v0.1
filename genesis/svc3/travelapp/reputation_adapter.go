package travelapp

import (
 "context"
 "errors"
 "time"

 "github.com/420integrated/420-integrated/reputation/interactions"
 "github.com/420integrated/420-integrated/reputation/model"
)

// ReputationReviewService is the existing 420Reputation service contract. The
// deployment injects a trusted service client; no unsigned browser input or
// independently maintained Travel review database is accepted.
type ReputationReviewService interface {
 ListReviews(context.Context, model.Domain, model.SubjectRef) ([]model.Review, error)
 GetReview(context.Context, string) (model.Review, error)
 VerifyInteraction(context.Context, model.Domain, interactions.Kind, string, model.SubjectRef, model.SubjectRef) (interactions.Evidence, error)
}

type ReputationTravelAdapter struct { Service ReputationReviewService }

func NewReputationTravelAdapter(service ReputationReviewService) (*ReputationTravelAdapter,error) {
 if service==nil { return nil,errors.New("420Reputation service required") }
 return &ReputationTravelAdapter{Service:service},nil
}

func eligibleTravelReview(r model.Review, placeID string) bool {
 return r.Status==model.ReviewActive && r.Domain==model.DomainTravel && r.Subject.Type=="PLACE" && r.Subject.ID==placeID && r.Verification==model.VerificationVerified && r.Validate()==nil
}

// PublicTravelReviews returns current candidate records only. A fresh GetReview
// is required for every candidate, so withdrawn/moderated/changed versions are
// not silently treated as still published. The HTTP boundary rechecks the
// public place and calls VerifiedInteraction before rendering any card.
func (a *ReputationTravelAdapter) PublicTravelReviews(ctx context.Context, placeID string)([]model.Review,error) {
 if a==nil||a.Service==nil||!validPlaceID(placeID) { return nil,errors.New("verified reviews unavailable") }
 list,err:=a.Service.ListReviews(ctx,model.DomainTravel,model.SubjectRef{Type:"PLACE",ID:placeID})
 if err!=nil||len(list)>100 { return nil,errors.New("verified reviews unavailable") }
 result:=make([]model.Review,0,len(list))
 seen:=make(map[string]bool,len(list))
 for _,candidate:=range list {
  if !eligibleTravelReview(candidate,placeID) { continue }
  if seen[candidate.ID] { return nil,errors.New("duplicate review record") };seen[candidate.ID]=true
  current,err:=a.Service.GetReview(ctx,candidate.ID)
  if err!=nil { return nil,errors.New("current review state unavailable") }
  if !eligibleTravelReview(current,placeID)||current.Version!=candidate.Version||!current.UpdatedAt.Equal(candidate.UpdatedAt)||current.VerifiedInteractionRef!=candidate.VerifiedInteractionRef { continue }
  result=append(result,current)
 }
 return result,nil
}

// VerifiedInteraction independently queries the existing Reputation verifier
// on each render. Proof ref, issuer, kind, subjects and event time must match
// the persisted review; a missing, revoked or changed proof fails closed.
func (a *ReputationTravelAdapter) VerifiedInteraction(ctx context.Context, review model.Review)(bool,error) {
 if a==nil||a.Service==nil||!eligibleTravelReview(review,review.Subject.ID) {return false,errors.New("verified reviews unavailable")}
 current,err:=a.Service.GetReview(ctx,review.ID)
 if err!=nil {return false,errors.New("current review state unavailable")}
 if !eligibleTravelReview(current,review.Subject.ID)||current.Version!=review.Version||!current.UpdatedAt.Equal(review.UpdatedAt)||current.VerifiedInteractionRef!=review.VerifiedInteractionRef||current.VerificationIssuerID!=review.VerificationIssuerID||current.InteractionKind!=review.InteractionKind||!current.VerifiedOccurredAt.Equal(review.VerifiedOccurredAt) {return false,nil}
 evidence,err:=a.Service.VerifyInteraction(ctx,model.DomainTravel,interactions.Kind(current.InteractionKind),current.VerifiedInteractionRef,current.Author,current.Subject)
 if err!=nil {return false,errors.New("interaction verification unavailable")}
 if !evidence.Final||evidence.EvidenceRef!=current.VerifiedInteractionRef||evidence.IssuerID!=current.VerificationIssuerID||string(evidence.Kind)!=current.InteractionKind||evidence.Reviewer!=current.Author||evidence.Subject!=current.Subject||!evidence.OccurredAt.Equal(current.VerifiedOccurredAt)||evidence.OccurredAt.After(time.Now().UTC()) {return false,nil}
 return true,nil
}

var _ TravelReviewReader = (*ReputationTravelAdapter)(nil)
