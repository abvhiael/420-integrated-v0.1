package antisybil

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/reputation/model"
)

type fakeRepo struct {
	evidence map[string]model.Review
	hourly uint64
	daily uint64
}
func (f fakeRepo) FindByVerifiedInteraction(ref string)(model.Review,bool){ r,ok:=f.evidence[ref]; return r,ok }
func (f fakeRepo) CountByAuthorSince(_ model.SubjectRef, since time.Time) uint64 {
	if time.Since(since) < 2*time.Hour { return f.hourly }
	return f.daily
}
type fakeConflicts struct{ conflict bool; err error }
func (f fakeConflicts) HasConflict(context.Context, model.SubjectRef, model.SubjectRef, model.Domain)(bool,error){ return f.conflict,f.err }

func verifiedReview(now time.Time) model.Review {
	return model.Review{
		ID:"r1",Domain:model.DomainClassifieds,
		Subject:model.SubjectRef{Type:"PROFILE",ID:"seller"},
		Author:model.SubjectRef{Type:"PROFILE",ID:"buyer"},
		Rating:5,Verification:model.VerificationVerified,
		InteractionKind:"P2P_TRANSACTION",VerifiedInteractionRef:"evidence-1",VerificationIssuerID:"420Pay",
		VerifiedOccurredAt:now.Add(-time.Hour),Status:model.ReviewActive,Version:1,CreatedAt:now,UpdatedAt:now,
	}
}

func TestGuardBlocksReusedVerifiedEvidence(t *testing.T) {
	now:=time.Now().UTC()
	review:=verifiedReview(now)
	g,err:=New(fakeRepo{evidence:map[string]model.Review{"evidence-1":review}},fakeConflicts{},Config{HourlyLimit:3,DailyLimit:10})
	if err!=nil { t.Fatal(err) }
	if !errors.Is(g.CheckCreate(context.Background(),review,now),ErrDuplicateEvidence){ t.Fatal("expected duplicate evidence rejection") }
}
func TestGuardBlocksRateLimit(t *testing.T) {
	now:=time.Now().UTC()
	g,err:=New(fakeRepo{hourly:3,daily:3},fakeConflicts{},Config{HourlyLimit:3,DailyLimit:10})
	if err!=nil { t.Fatal(err) }
	if !errors.Is(g.CheckCreate(context.Background(),verifiedReview(now),now),ErrRateLimited){ t.Fatal("expected rate limit rejection") }
}
func TestGuardBlocksConflict(t *testing.T) {
	now:=time.Now().UTC()
	g,err:=New(fakeRepo{},fakeConflicts{conflict:true},Config{HourlyLimit:3,DailyLimit:10})
	if err!=nil { t.Fatal(err) }
	if !errors.Is(g.CheckCreate(context.Background(),verifiedReview(now),now),ErrConflict){ t.Fatal("expected conflict rejection") }
}
func TestGuardAllowsCleanReview(t *testing.T) {
	now:=time.Now().UTC()
	g,err:=New(fakeRepo{},fakeConflicts{},Config{HourlyLimit:3,DailyLimit:10})
	if err!=nil { t.Fatal(err) }
	if err:=g.CheckCreate(context.Background(),verifiedReview(now),now); err!=nil { t.Fatal(err) }
}
