package assistance

import (
	"context"
	"errors"
	"math"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/grow/security"
)

type projectionFake struct {
	fakeStore
	item WorkItem
}

func (f *projectionFake) Resolve(_ context.Context, _, _, _, _ string) (WorkItem, error) {
	return f.item, nil
}

type adviceFake struct {
	output Recommendation
	called bool
}

func (f *adviceFake) Analyze(_ context.Context, input MinimalInput) (Recommendation, error) {
	if input.Kind != "OBSERVATION" || input.Metric != "temperature" || input.Unit != "C" {
		return Recommendation{}, ErrInvalid
	}
	f.called = true
	return f.output, nil
}

func TestMinimalAdvisoryGenerationNeverControlsEquipment(t *testing.T) {
	now := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	ctx := context.Background()
	item := WorkItem{
		Input: Input{TenantID: "a", FacilityID: "f", ZoneID: "z", JobID: "j",
			Purpose: "CULTIVATION_ADVICE", ConsentID: "consent", SourceKind: "OBSERVATION",
			SourceID: "reading"},
		Observation: MinimalInput{Kind: "OBSERVATION", Metric: "temperature", Unit: "C",
			Value: 24.5, ObservedAt: now.Add(-time.Minute)},
	}
	f := &projectionFake{item: item}
	out := Recommendation{TenantID: "a", FacilityID: "f", ZoneID: "z", JobID: "j", ID: "r",
		Provider: "internal", Model: "advisory-v1", Text: "Investigate temperature trend",
		Explanation: "One sensor reading is insufficient to establish a trend",
		Limitations: "Verify sensor calibration and inspect environment manually",
		Confidence:  "LOW", CreatedAt: now}
	provider := &adviceFake{output: out}
	s := NewWithProvider(f, verifiedProvider{})
	got, err := s.Generate(ctx, scope("a", security.Owner), "f", "z", "j", now, provider)
	if err != nil || !provider.called || got.ID != "r" || len(f.outputs) != 1 {
		t.Fatalf("advisory-only generation: %+v %v", got, err)
	}
	f.item.Input.TenantID = "b"
	provider.called = false
	if _, err := s.Generate(ctx, scope("a", security.Owner), "f", "z", "j", now, provider); !errors.Is(err, ErrDenied) || provider.called {
		t.Fatalf("cross tenant projection reached provider: %v", err)
	}
	f.item.Input.TenantID = "a"
	f.item.Observation.Value = math.NaN()
	if _, err := s.Generate(ctx, scope("a", security.Owner), "f", "z", "j", now, provider); !errors.Is(err, ErrInvalid) {
		t.Fatalf("nonfinite observation reached provider: %v", err)
	}
}

func TestProviderNeedsExplicitWorkerConfiguration(t *testing.T) {
	now := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	f := &projectionFake{item: WorkItem{Input: Input{TenantID: "a", FacilityID: "f",
		ZoneID: "z", JobID: "j", Purpose: "CULTIVATION_ADVICE", ConsentID: "consent"},
		Observation: MinimalInput{Kind: "PLANT", State: "FLOWERING", ObservedAt: now}}}
	s := New(f)
	if _, err := s.Generate(context.Background(), scope("a", security.Owner), "f", "z", "j", now, &adviceFake{}); !errors.Is(err, ErrDenied) {
		t.Fatalf("unverified worker accepted: %v", err)
	}
	if _, err := NewWithProvider(f, verifiedProvider{}).Generate(context.Background(), scope("a", security.Reviewer), "f", "z", "j", now, &adviceFake{}); !errors.Is(err, ErrDenied) {
		t.Fatalf("read-only user initiated AI inference: %v", err)
	}
}
