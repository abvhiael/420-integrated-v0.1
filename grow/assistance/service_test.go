package assistance

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/grow/security"
)

type verifiedProvider struct{}

func (verifiedProvider) Verify(_ context.Context, output Recommendation) error {
	if output.Provider != "internal" {
		return ErrDenied
	}
	return nil
}

type fakeStore struct {
	jobs      []Input
	outputs   []Recommendation
	reviews   []Review
	consented bool
}

func (f *fakeStore) Enqueue(_ context.Context, input Input, _ string) error {
	if !f.consented {
		return ErrDenied
	}
	for _, prior := range f.jobs {
		if prior.JobID == input.JobID {
			return ErrConflict
		}
	}
	f.jobs = append(f.jobs, input)
	return nil
}
func (f *fakeStore) SaveRecommendation(_ context.Context, output Recommendation) error {
	for _, prior := range f.outputs {
		if prior.ID == output.ID || prior.JobID == output.JobID {
			return ErrConflict
		}
	}
	f.outputs = append(f.outputs, output)
	return nil
}
func (f *fakeStore) Review(_ context.Context, review Review) error {
	for _, prior := range f.reviews {
		if prior.RecommendationID == review.RecommendationID {
			return ErrConflict
		}
	}
	f.reviews = append(f.reviews, review)
	return nil
}
func (f *fakeStore) Read(_ context.Context, _, _, _, id string) (Recommendation, error) {
	for _, record := range f.outputs {
		if record.ID == id {
			return record, nil
		}
	}
	return Recommendation{}, ErrDenied
}
func scope(tenant string, role security.Role) Scope {
	return Scope{
		TenantID:  tenant,
		Principal: security.Principal{SubjectID: "operator", Authenticated: true},
		Grant:     security.Grant{SubjectID: "operator", TenantID: tenant, Role: role, State: security.Active},
	}
}
func TestConsentMinimalPayloadAndTenantIsolation(t *testing.T) {
	now := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	ctx := context.Background()
	store := &fakeStore{}
	svc := New(store)
	req := Input{TenantID: "a", FacilityID: "f", ZoneID: "z", JobID: "j",
		Purpose: "CULTIVATION_ADVICE", SourceKind: "PLANT", SourceID: "p",
		ConsentID: "c", RequestedAt: now}
	if err := svc.Submit(ctx, scope("a", security.Owner), req, now); !errors.Is(err, ErrDenied) {
		t.Fatalf("absent consent accepted: %v", err)
	}
	store.consented = true
	if err := svc.Submit(ctx, scope("a", security.Owner), req, now); err != nil {
		t.Fatal(err)
	}
	if err := svc.Submit(ctx, scope("a", security.Owner), req, now); !errors.Is(err, ErrConflict) {
		t.Fatalf("duplicate accepted: %v", err)
	}
	req.Prompt = "private address and identifiers"
	if err := svc.Submit(ctx, scope("a", security.Owner), req, now); !errors.Is(err, ErrInvalid) {
		t.Fatalf("arbitrary prompt accepted: %v", err)
	}
	req.Prompt = ""
	if err := svc.Submit(ctx, scope("b", security.Owner), req, now); !errors.Is(err, ErrDenied) {
		t.Fatalf("cross-tenant accepted: %v", err)
	}
	if err := svc.Submit(ctx, scope("a", security.Reviewer), req, now); !errors.Is(err, ErrDenied) {
		t.Fatalf("reader submitted AI job: %v", err)
	}
}
func TestRecommendationRequiresExplanationAndHumanDecision(t *testing.T) {
	now := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	ctx := context.Background()
	store := &fakeStore{consented: true}
	svc := NewWithProvider(store, verifiedProvider{})
	out := Recommendation{TenantID: "a", FacilityID: "f", ZoneID: "z", JobID: "j",
		ID: "r", Provider: "internal", Model: "advisory-v1", Text: "Inspect plant",
		Explanation: "Based on the provided observation", Limitations: "Manual evaluation required",
		Confidence: "LOW", CreatedAt: now}
	if err := svc.Record(ctx, scope("a", security.Owner), out, now); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Read(ctx, scope("b", security.Owner), "f", "z", "r"); !errors.Is(err, ErrDenied) {
		t.Fatalf("cross-tenant recommendation read: %v", err)
	}
	review := Review{TenantID: "a", FacilityID: "f", ZoneID: "z", ID: "review",
		RecommendationID: "r", Actor: "operator", Decision: "ACCEPTED_FOR_REVIEW",
		Reason: "Independent inspection required", ReviewedAt: now}
	if err := svc.Decide(ctx, scope("a", security.Owner), review, now); err != nil {
		t.Fatal(err)
	}
	if err := svc.Decide(ctx, scope("a", security.Owner), review, now); !errors.Is(err, ErrConflict) {
		t.Fatalf("repeat decision accepted: %v", err)
	}
	out.ID = "r2"
	out.Explanation = ""
	if err := svc.Record(ctx, scope("a", security.Owner), out, now); !errors.Is(err, ErrInvalid) {
		t.Fatalf("unexplained advice accepted: %v", err)
	}
	review.Decision = "EXECUTE_EQUIPMENT"
	if err := svc.Decide(ctx, scope("a", security.Owner), review, now); !errors.Is(err, ErrInvalid) {
		t.Fatalf("autonomous equipment instruction accepted: %v", err)
	}
}

func TestUnverifiedProviderIsDenied(t *testing.T) {
	now := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	output := Recommendation{TenantID: "a", FacilityID: "f", ZoneID: "z", JobID: "j",
		ID: "r", Provider: "attacker", Model: "x", Text: "Act now",
		Explanation: "unknown", Limitations: "unknown", Confidence: "LOW", CreatedAt: now}
	ctx := context.Background()
	if err := New(&fakeStore{}).Record(ctx, scope("a", security.Owner), output, now); !errors.Is(err, ErrDenied) {
		t.Fatalf("no trusted provider verifier accepted: %v", err)
	}
	if err := NewWithProvider(&fakeStore{}, verifiedProvider{}).Record(ctx, scope("a", security.Owner), output, now); !errors.Is(err, ErrDenied) {
		t.Fatalf("untrusted provider accepted: %v", err)
	}
}
