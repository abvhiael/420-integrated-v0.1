package e2e

import (
	"context"
	"errors"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/reputation/antisybil"
	"github.com/420integrated/420-integrated/reputation/httpapi"
	"github.com/420integrated/420-integrated/reputation/interactions"
	"github.com/420integrated/420-integrated/reputation/model"
	"github.com/420integrated/420-integrated/reputation/repository"
	"github.com/420integrated/420-integrated/reputation/service"
	reputation420 "github.com/420integrated/420-integrated/sdk/reputation420"
)

type subjects struct{}
func (subjects) ValidateSubject(_ context.Context, s model.SubjectRef) error { return s.Validate() }

type trust struct{}
func (trust) ReadMetric(context.Context, model.SubjectRef, string) (model.TrustMetricRef, error) {
	return model.TrustMetricRef{}, errors.New("trust read not used by journey")
}

type delegations struct{}
func (delegations) CanActFor(context.Context, model.SubjectRef, model.SubjectRef) (bool,error) { return false,nil }

type moderators struct{}
func (moderators) CanModerate(_ context.Context, actor model.SubjectRef, domain model.Domain) (bool,error) {
	return actor == (model.SubjectRef{Type:"PROFILE",ID:"moderator-1"}) && domain==model.DomainClassifieds,nil
}

type conflicts struct{}
func (conflicts) HasConflict(context.Context, model.SubjectRef, model.SubjectRef, model.Domain) (bool,error) { return false,nil }

type interactionSource struct{ record interactions.Record }
func (s interactionSource) Lookup(_ context.Context, ref string) (interactions.Record,error) {
	if ref != s.record.EvidenceRef { return interactions.Record{},errors.New("evidence not found") }
	return s.record,nil
}

func TestVerifiedReviewJourneyEndToEnd(t *testing.T) {
	ctx:=context.Background()
	occurred:=time.Date(2026,9,18,18,0,0,0,time.UTC)
	buyer:=model.SubjectRef{Type:"PROFILE",ID:"buyer-1"}
	seller:=model.SubjectRef{Type:"PROFILE",ID:"seller-1"}
	reporter:=model.SubjectRef{Type:"PROFILE",ID:"reporter-1"}
	moderator:=model.SubjectRef{Type:"PROFILE",ID:"moderator-1"}

	storePath:=filepath.Join(t.TempDir(),"reviews.json")
	store,err:=repository.OpenFileStore(storePath)
	if err!=nil { t.Fatal(err) }

	guard,err:=antisybil.New(store,conflicts{},antisybil.Config{HourlyLimit:3,DailyLimit:10})
	if err!=nil { t.Fatal(err) }

	adapter,err:=interactions.NewAdapter("420Classifieds settlement",interactions.KindP2PTransaction,interactionSource{record:interactions.Record{
		Kind:interactions.KindP2PTransaction,
		EvidenceRef:"tx-verified-1",
		IssuerID:"420Pay",
		Reviewer:buyer.ID,ReviewerType:buyer.Type,
		Subject:seller.ID,SubjectType:seller.Type,
		OccurredAtUnix:occurred.Unix(),
		Final:true,
	}})
	if err!=nil { t.Fatal(err) }
	verifier,err:=interactions.NewVerifier(map[interactions.Kind]interactions.Source{
		interactions.KindP2PTransaction:adapter,
	})
	if err!=nil { t.Fatal(err) }

	svc,err:=service.New(service.Dependencies{
		Subjects:subjects{},Trust:trust{},Reviews:store,Interactions:verifier,
		Delegations:delegations{},Moderators:moderators{},AbuseGuard:guard,
	})
	if err!=nil { t.Fatal(err) }
	httpServer,err:=httpapi.New(svc)
	if err!=nil { t.Fatal(err) }
	ts:=httptest.NewServer(httpServer.Handler())
	defer ts.Close()

	client,err:=reputation420.New(ts.URL,3*time.Second)
	if err!=nil { t.Fatal(err) }

	review,err:=client.CreateReview(ctx,reputation420.CreateReviewRequest{
		ReviewID:"review-verified-1",
		Domain:model.DomainClassifieds,
		Subject:seller,
		Reviewer:buyer,
		Rating:5,
		BodyRef:"storage://reviews/review-verified-1",
		Verification:model.VerificationVerified,
		InteractionKind:string(interactions.KindP2PTransaction),
		EvidenceRef:"tx-verified-1",
	},"idem-review-1")
	if err!=nil { t.Fatalf("create verified review: %v",err) }
	if review.Verification!=model.VerificationVerified || review.VerifiedInteractionRef!="tx-verified-1" || review.VerificationIssuerID!="420Pay" {
		t.Fatalf("verified provenance not preserved: %+v",review)
	}

	_,err=client.CreateReview(ctx,reputation420.CreateReviewRequest{
		ReviewID:"review-replay",
		Domain:model.DomainClassifieds,
		Subject:seller,
		Reviewer:buyer,
		Rating:4,
		Verification:model.VerificationVerified,
		InteractionKind:string(interactions.KindP2PTransaction),
		EvidenceRef:"tx-verified-1",
	},"idem-review-replay")
	if err==nil { t.Fatal("expected verified interaction replay to be rejected") }

	response,err:=client.CreateResponse(ctx,review.ID,reputation420.ResponseRequest{
		Actor:seller,BodyRef:"storage://responses/review-verified-1",
	},"idem-response-1")
	if err!=nil { t.Fatalf("create subject response: %v",err) }
	if response.Subject!=seller || response.Actor!=seller { t.Fatalf("response subject mismatch: %+v",response) }

	report,err:=client.Report(ctx,review.ID,reputation420.ReportRequest{
		ModerationID:"report-1",Actor:reporter,Reason:model.ReasonSpam,BodyRef:"storage://reports/report-1",
	},"idem-report-1")
	if err!=nil { t.Fatalf("report review: %v",err) }
	if report.Action!=model.ModerationReport || report.State!=model.ModerationOpen { t.Fatalf("report=%+v",report) }

	hidden,err:=client.Moderate(ctx,review.ID,reputation420.ModerateRequest{
		ModerationID:"moderation-hide-1",Actor:moderator,Action:model.ModerationHide,
		Reason:model.ReasonSpam,ParentID:report.ID,
	},"idem-hide-1")
	if err!=nil { t.Fatalf("hide review: %v",err) }
	if hidden.ResultState!=model.ReviewHidden || hidden.State!=model.ModerationHidden { t.Fatalf("hide=%+v",hidden) }

	summary,err:=client.Summary(ctx,model.DomainClassifieds,seller)
	if err!=nil { t.Fatalf("summary after hide: %v",err) }
	if summary.Summary.VisibleReviewCount!=0 || summary.Summary.HiddenReviewCount!=1 {
		t.Fatalf("moderation not reflected in summary: %+v",summary.Summary)
	}
	if summary.Summary.ResponseCount!=1 || summary.Summary.ModeratedReviewCount!=1 {
		t.Fatalf("response/moderation aggregates missing: %+v",summary.Summary)
	}

	projection,err:=client.Projection(ctx,model.DomainClassifieds,seller)
	if err!=nil { t.Fatalf("projection after hide: %v",err) }
	if projection.Authoritative { t.Fatal("public projection became authoritative") }
	if projection.VisibleReviewCount!=0 || projection.VerifiedReviewCount!=0 || projection.AverageRating!=0 {
		t.Fatalf("hidden review leaked into public projection: %+v",projection)
	}

	records,err:=client.ListModeration(ctx,review.ID)
	if err!=nil { t.Fatalf("list moderation: %v",err) }
	if records.Count!=2 { t.Fatalf("moderation count=%d want=2",records.Count) }

	reopened,err:=repository.OpenFileStore(storePath)
	if err!=nil { t.Fatalf("reopen persisted repository: %v",err) }
	persisted,err:=reopened.Get(review.ID)
	if err!=nil { t.Fatalf("persisted review missing: %v",err) }
	if persisted.Status!=model.ReviewHidden || persisted.VerifiedInteractionRef!="tx-verified-1" {
		t.Fatalf("persisted review lost state/provenance: %+v",persisted)
	}
	if _,err:=reopened.GetResponse(review.ID); err!=nil { t.Fatalf("persisted response missing: %v",err) }
	if got:=reopened.ListModeration(review.ID); len(got)!=2 { t.Fatalf("persisted moderation count=%d want=2",len(got)) }
}
