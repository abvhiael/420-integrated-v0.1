package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/reputation/interactions"
	"github.com/420integrated/420-integrated/reputation/model"
)

type fakeSubjects struct{ err error }

func (f fakeSubjects) ValidateSubject(context.Context, model.SubjectRef) error { return f.err }

type fakeTrust struct {
	metric model.TrustMetricRef
	err    error
}

func (f fakeTrust) ReadMetric(context.Context, model.SubjectRef, string) (model.TrustMetricRef, error) {
	return f.metric, f.err
}

type fakeReviews struct{ err error }

func (f fakeReviews) Ready(context.Context) error { return f.err }
func (f fakeReviews) Create(r model.Review) (model.Review, error) { return r, f.err }
func (f fakeReviews) Get(string) (model.Review, error) { return model.Review{}, f.err }
func (f fakeReviews) Update(r model.Review, _ uint32) (model.Review, error) { return r, f.err }
func (f fakeReviews) ListBySubject(model.Domain, model.SubjectRef) []model.Review { return nil }
func (f fakeReviews) CreateResponse(r model.Response) (model.Response, error) { return r, f.err }
func (f fakeReviews) GetResponse(string) (model.Response, error) { return model.Response{}, f.err }
func (f fakeReviews) UpdateResponse(r model.Response, _ uint32) (model.Response, error) { return r, f.err }

type fakeDelegations struct{ allowed bool; err error }
func (f fakeDelegations) CanActFor(context.Context, model.SubjectRef, model.SubjectRef) (bool, error) { return f.allowed, f.err }

type fakeInteractions struct {
	evidence interactions.Evidence
	err      error
}

func (f fakeInteractions) Verify(context.Context, model.Domain, interactions.Kind, string, model.SubjectRef, model.SubjectRef) (interactions.Evidence, error) {
	return f.evidence, f.err
}

func validDeps() Dependencies {
	return Dependencies{
		Subjects: fakeSubjects{},
		Trust: fakeTrust{metric: model.TrustMetricRef{
			DomainID:       "trust/domain/market",
			UnitID:         "trust/unit/count",
			MetricID:       "trust/metric/completed-transactions",
			MetricRevision: 1,
			Active:         true,
			Total:          "3",
			ActiveSignals:  3,
		}},
		Reviews: fakeReviews{},
		Delegations: fakeDelegations{allowed:true},
		Interactions: fakeInteractions{evidence: interactions.Evidence{
			Kind:        interactions.KindP2PTransaction,
			EvidenceRef: "evidence-1",
			IssuerID:    "420/service/pay/v1",
			Reviewer:    model.SubjectRef{Type: "PROFILE", ID: "buyer-1"},
			Subject:     model.SubjectRef{Type: "PROFILE", ID: "seller-1"},
			OccurredAt:  time.Date(2026, 9, 18, 2, 30, 0, 0, time.UTC),
			Source:      "420Pay",
			Final:       true,
		}},
	}
}

func TestNewRequiresAllDependencies(t *testing.T) {
	tests := []struct {
		name string
		edit func(*Dependencies)
	}{
		{"subjects", func(d *Dependencies) { d.Subjects = nil }},
		{"trust", func(d *Dependencies) { d.Trust = nil }},
		{"reviews", func(d *Dependencies) { d.Reviews = nil }},
		{"interactions", func(d *Dependencies) { d.Interactions = nil }},
		{"delegations", func(d *Dependencies) { d.Delegations = nil }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			deps := validDeps()
			tt.edit(&deps)
			if _, err := New(deps); err == nil {
				t.Fatalf("expected missing %s dependency to fail", tt.name)
			}
		})
	}
}

func TestGenesisBoundaryCannotAcquireProtocolAuthority(t *testing.T) {
	svc, err := New(validDeps())
	if err != nil {
		t.Fatal(err)
	}
	b := svc.Boundary()
	if b.CanonicalProtocolAuthority || b.UniversalScore || b.CustodyAuthority ||
		b.IdentityAuthority || b.GovernanceWeight || b.ValidatorWeight ||
		b.SubjectiveRatingsOnChain || !b.TrustReadOnly {
		t.Fatalf("unsafe reputation boundary: %+v", b)
	}
}

func TestGenesisDomainsAreSeparated(t *testing.T) {
	svc, err := New(validDeps())
	if err != nil {
		t.Fatal(err)
	}
	domains := svc.Domains()
	if len(domains) != 9 {
		t.Fatalf("domains=%d want=9", len(domains))
	}
	seen := map[model.Domain]bool{}
	for _, domain := range domains {
		if !model.ValidDomain(domain) {
			t.Fatalf("invalid domain %q", domain)
		}
		if seen[domain] {
			t.Fatalf("duplicate domain %q", domain)
		}
		seen[domain] = true
	}
}

func TestReadTrustMetricUsesValidatedSubjectAndExactMetric(t *testing.T) {
	svc, err := New(validDeps())
	if err != nil {
		t.Fatal(err)
	}
	got, err := svc.ReadTrustMetric(
		context.Background(),
		model.SubjectRef{Type: "PROFILE", ID: "profile-1"},
		"trust/metric/completed-transactions",
	)
	if err != nil {
		t.Fatal(err)
	}
	if got.ActiveSignals != 3 || got.MetricRevision != 1 {
		t.Fatalf("unexpected metric: %+v", got)
	}
}

func TestReadTrustMetricRejectsBadInputAndBadTrustOutput(t *testing.T) {
	deps := validDeps()
	svc, err := New(deps)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.ReadTrustMetric(context.Background(), model.SubjectRef{}, "metric"); err == nil {
		t.Fatal("expected invalid subject rejection")
	}
	if _, err := svc.ReadTrustMetric(context.Background(), model.SubjectRef{Type: "PROFILE", ID: "p1"}, ""); err == nil {
		t.Fatal("expected missing metric id rejection")
	}

	deps.Trust = fakeTrust{metric: model.TrustMetricRef{DomainID: "d", MetricID: "m"}}
	svc, err = New(deps)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.ReadTrustMetric(context.Background(), model.SubjectRef{Type: "PROFILE", ID: "p1"}, "m"); err == nil {
		t.Fatal("expected malformed Trust result rejection")
	}
}

func TestVerifyInteractionValidatesParticipantsBeforeEvidence(t *testing.T) {
	svc, err := New(validDeps())
	if err != nil { t.Fatal(err) }
	got, err := svc.VerifyInteraction(
		context.Background(),
		model.DomainClassifieds,
		interactions.KindP2PTransaction,
		"evidence-1",
		model.SubjectRef{Type: "PROFILE", ID: "buyer-1"},
		model.SubjectRef{Type: "PROFILE", ID: "seller-1"},
	)
	if err != nil { t.Fatal(err) }
	if !got.Final || got.EvidenceRef != "evidence-1" {
		t.Fatalf("unexpected evidence: %+v", got)
	}
}

func TestVerifyInteractionPropagatesVerifierFailure(t *testing.T) {
	deps := validDeps()
	deps.Interactions = fakeInteractions{err: errors.New("interaction unavailable")}
	svc, err := New(deps)
	if err != nil { t.Fatal(err) }
	if _, err := svc.VerifyInteraction(
		context.Background(),
		model.DomainTravel,
		interactions.KindStay,
		"evidence-1",
		model.SubjectRef{Type: "PROFILE", ID: "buyer-1"},
		model.SubjectRef{Type: "PROFILE", ID: "seller-1"},
	); err == nil {
		t.Fatal("expected verifier failure")
	}
}

func TestReadyPropagatesRepositoryFailure(t *testing.T) {
	deps := validDeps()
	deps.Reviews = fakeReviews{err: errors.New("repository unavailable")}
	svc, err := New(deps)
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.Ready(context.Background()); err == nil {
		t.Fatal("expected readiness failure")
	}
}

func TestSubjectBinderFailurePropagates(t *testing.T) {
	deps := validDeps()
	deps.Subjects = fakeSubjects{err: errors.New("unknown subject")}
	svc, err := New(deps)
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.ValidateSubject(context.Background(), model.SubjectRef{Type: "PROFILE", ID: "missing"}); err == nil {
		t.Fatal("expected subject binder failure")
	}
}
