package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/reputation/model"
)

func TestCreateReviewStopsWhenAntiSybilGuardRejects(t *testing.T) {
	deps := validDeps()
	deps.AbuseGuard = fakeAbuseGuard{err: errors.New("anti-sybil blocked")}
	svc, err := New(deps)
	if err != nil { t.Fatal(err) }

	_, err = svc.CreateReview(context.Background(), CreateReviewInput{
		ID:"review-abuse-1",
		Domain:model.DomainClassifieds,
		Subject:model.SubjectRef{Type:"PROFILE",ID:"seller-1"},
		Author:model.SubjectRef{Type:"PROFILE",ID:"buyer-1"},
		Rating:5,
		Verification:model.VerificationUnverified,
	}, time.Date(2026,9,18,7,0,0,0,time.UTC))
	if err == nil || err.Error() != "anti-sybil blocked" {
		t.Fatalf("expected anti-Sybil rejection, got %v",err)
	}
}
