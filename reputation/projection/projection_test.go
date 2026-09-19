package projection

import (
	"testing"
	"time"

	"github.com/420integrated/420-integrated/reputation/model"
)

func sampleSummary() model.ReputationSummary {
	return model.ReputationSummary{
		Domain:model.DomainClassifieds,
		Subject:model.SubjectRef{Type:"PROFILE",ID:"seller-1"},
		PolicyVersion:model.ReputationPolicyVersion,
		VisibleReviewCount:2,
		HiddenReviewCount:7,
		RemovedReviewCount:3,
		VerifiedReviewCount:1,
		UnverifiedReviewCount:1,
		ResponseCount:1,
		ModeratedReviewCount:1,
		RatingDistribution:model.RatingDistribution{Four:1,Five:1},
		History:[]model.SummaryHistoryEntry{{
			ReviewID:"private-history-not-projected",Rating:5,
		}},
		UpdatedAt:time.Date(2026,9,18,21,0,0,0,time.UTC),
	}
}

func TestProjectionContainsOnlyPublicSummaryFields(t *testing.T) {
	doc,err:=(Projector{}).FromSummary(sampleSummary())
	if err!=nil { t.Fatal(err) }
	if doc.VisibleReviewCount!=2 || doc.AverageRating!=4.5 { t.Fatalf("unexpected doc: %+v",doc) }
	if doc.Authoritative { t.Fatal("projection became authoritative") }
	if doc.ID=="" || doc.Schema!=SchemaVersion { t.Fatalf("unstable projection: %+v",doc) }
}

func TestStableIDSeparatesDomains(t *testing.T) {
	s:=sampleSummary()
	a,_:=StableID(s.Domain,s.Subject)
	b,_:=StableID(model.DomainTravel,s.Subject)
	if a==b { t.Fatal("cross-domain projections share id") }
}

func TestStoreIsRebuildable(t *testing.T) {
	doc,err:=(Projector{}).FromSummary(sampleSummary())
	if err!=nil { t.Fatal(err) }
	store:=NewStore()
	if err:=store.Replace(doc); err!=nil { t.Fatal(err) }
	if _,ok:=store.Get(doc.ID); !ok { t.Fatal("projection missing") }
	store.Remove(doc.ID)
	if _,ok:=store.Get(doc.ID); ok { t.Fatal("projection remove failed") }
	if err:=store.Rebuild([]Document{doc}); err!=nil { t.Fatal(err) }
	if len(store.Snapshot())!=1 { t.Fatal("projection rebuild failed") }
}
