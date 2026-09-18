package service

import (
	"context"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/reputation/model"
)

type summaryReviews struct {
	reviews []model.Review
	responses map[string]model.Response
	moderation map[string][]model.ModerationRecord
}

func (s summaryReviews) Ready(context.Context) error { return nil }
func (s summaryReviews) Create(r model.Review)(model.Review,error){ return r,nil }
func (s summaryReviews) Get(id string)(model.Review,error){
	for _, r := range s.reviews { if r.ID==id { return r,nil } }
	return model.Review{}, errSummaryNotFound{}
}
func (s summaryReviews) Update(r model.Review,_ uint32)(model.Review,error){ return r,nil }
func (s summaryReviews) ListBySubject(d model.Domain, subject model.SubjectRef) []model.Review {
	var out []model.Review
	for _, r := range s.reviews { if r.Domain==d && r.Subject==subject { out=append(out,r) } }
	return out
}
func (s summaryReviews) CreateResponse(r model.Response)(model.Response,error){ return r,nil }
func (s summaryReviews) GetResponse(id string)(model.Response,error){
	if r,ok:=s.responses[id]; ok { return r,nil }
	return model.Response{}, errSummaryNotFound{}
}
func (s summaryReviews) UpdateResponse(r model.Response,_ uint32)(model.Response,error){ return r,nil }
func (s summaryReviews) CreateModeration(r model.ModerationRecord)(model.ModerationRecord,error){ return r,nil }
func (s summaryReviews) ListModeration(id string) []model.ModerationRecord { return s.moderation[id] }

type errSummaryNotFound struct{}
func (errSummaryNotFound) Error() string { return "not found" }

func TestReputationSummaryCountsOnlyVisibleRatings(t *testing.T) {
	subject := model.SubjectRef{Type:"PROFILE",ID:"seller-1"}
	now := time.Date(2026,9,18,6,0,0,0,time.UTC)
	reviews := []model.Review{
		{ID:"r1",Domain:model.DomainClassifieds,Subject:subject,Author:model.SubjectRef{Type:"PROFILE",ID:"a1"},Rating:5,Verification:model.VerificationUnverified,Status:model.ReviewActive,Version:1,CreatedAt:now,UpdatedAt:now},
		{ID:"r2",Domain:model.DomainClassifieds,Subject:subject,Author:model.SubjectRef{Type:"PROFILE",ID:"a2"},Rating:1,Verification:model.VerificationUnverified,Status:model.ReviewHidden,Version:2,CreatedAt:now.Add(-time.Hour),UpdatedAt:now},
	}
	repo := summaryReviews{
		reviews:reviews,
		responses:map[string]model.Response{"r1":{ReviewID:"r1"}},
		moderation:map[string][]model.ModerationRecord{"r2":{{ID:"m1"}}},
	}
	svc,err:=New(Dependencies{
		Subjects:fakeSubjects{}, Trust:fakeTrust{}, Reviews:repo,
		Interactions:fakeInteractions{}, Delegations:fakeDelegations{allowed:true},
		Moderators:fakeModerators{allowed:true},
	})
	if err!=nil { t.Fatal(err) }
	got,err:=svc.ReputationSummary(context.Background(),model.DomainClassifieds,subject)
	if err!=nil { t.Fatal(err) }
	if got.VisibleReviewCount!=1 || got.HiddenReviewCount!=1 { t.Fatalf("counts=%+v",got) }
	if got.UnverifiedReviewCount!=1 || got.RatingDistribution.Five!=1 || got.RatingDistribution.One!=0 { t.Fatalf("visible distribution wrong: %+v",got) }
	if got.ResponseCount!=1 || got.ModeratedReviewCount!=1 || len(got.History)!=2 { t.Fatalf("summary indicators wrong: %+v",got) }
	if got.PolicyVersion!=model.ReputationPolicyVersion { t.Fatalf("policy=%q",got.PolicyVersion) }
	if got.AverageRating()!=5 { t.Fatalf("average=%v",got.AverageRating()) }
}
