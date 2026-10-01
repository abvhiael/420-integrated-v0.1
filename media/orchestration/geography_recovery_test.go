package orchestration

import (
	"context"
	"errors"
	"testing"

	"github.com/420integrated/420-integrated/media/discovery"
)

func geoSelection(id byte, geo string, score uint64) discovery.Selection {
	return discovery.Selection{Provider: discovery.Provider{OperatorID: b32(id), Active: true, Geography: geo}, Score: score}
}

func geographyRequest() GeographyRecoveryRequest {
	return GeographyRecoveryRequest{
		RecoveryRequest: RecoveryRequest{
			Node: JobNode{ID: "transcode:000:720p", Role: RoleTranscoder, OperatorID: b32(11)},
			Selection: discovery.Request{CapabilityID: b32(21)},
			FailedOperatorID: b32(11),
		},
		FailedGeography: "ca-central",
		OccupiedGeographies: map[string]struct{}{"us-east": {}},
	}
}

func TestGeographyRecoveryNeverReturnsFailedDomain(t *testing.T) {
	planner := NewRecoveryPlanner(fakeRecoverySelector{selections: []discovery.Selection{
		geoSelection(12, "ca-central", 100),
		geoSelection(13, "us-east", 90),
	}}, RecoveryPolicy{})
	decision, err := planner.SelectGeographicReplacement(context.Background(), geographyRequest(), GeographyRecoveryPolicy{})
	if err != nil { t.Fatal(err) }
	if decision.Replacement.Provider.OperatorID != b32(13) || decision.Replacement.Provider.Geography == "ca-central" {
		t.Fatalf("decision=%+v", decision)
	}
}

func TestGeographyRecoveryPrefersFreshFailureDomain(t *testing.T) {
	planner := NewRecoveryPlanner(fakeRecoverySelector{selections: []discovery.Selection{
		geoSelection(12, "us-east", 100),
		geoSelection(13, "eu-west", 90),
	}}, RecoveryPolicy{})
	decision, err := planner.SelectGeographicReplacement(context.Background(), geographyRequest(), GeographyRecoveryPolicy{PreferDistinctOccupiedGeographies: true})
	if err != nil { t.Fatal(err) }
	if decision.Replacement.Provider.OperatorID != b32(13) || decision.Replacement.Provider.Geography != "eu-west" {
		t.Fatalf("decision=%+v", decision)
	}
}

func TestGeographyRecoveryMayFallbackToHealthyOccupiedGeography(t *testing.T) {
	planner := NewRecoveryPlanner(fakeRecoverySelector{selections: []discovery.Selection{
		geoSelection(12, "us-east", 100),
	}}, RecoveryPolicy{})
	decision, err := planner.SelectGeographicReplacement(context.Background(), geographyRequest(), GeographyRecoveryPolicy{PreferDistinctOccupiedGeographies: true})
	if err != nil { t.Fatal(err) }
	if decision.Replacement.Provider.OperatorID != b32(12) { t.Fatalf("decision=%+v", decision) }
}

func TestGeographyRecoveryCanRequireFreshFailureDomain(t *testing.T) {
	planner := NewRecoveryPlanner(fakeRecoverySelector{selections: []discovery.Selection{
		geoSelection(12, "us-east", 100),
	}}, RecoveryPolicy{})
	_, err := planner.SelectGeographicReplacement(context.Background(), geographyRequest(), GeographyRecoveryPolicy{RequireDistinctOccupiedGeographies: true})
	if !errors.Is(err, ErrRecoveryExhausted) { t.Fatalf("err=%v", err) }
}

func TestGeographyRecoveryFailsClosedOnMissingOrUnknownGeography(t *testing.T) {
	planner := NewRecoveryPlanner(fakeRecoverySelector{selections: []discovery.Selection{
		geoSelection(12, "", 100),
	}}, RecoveryPolicy{})
	req := geographyRequest()
	_, err := planner.SelectGeographicReplacement(context.Background(), req, GeographyRecoveryPolicy{})
	if !errors.Is(err, ErrRecoveryExhausted) { t.Fatalf("err=%v", err) }

	req.FailedGeography = ""
	_, err = planner.SelectGeographicReplacement(context.Background(), req, GeographyRecoveryPolicy{})
	if !errors.Is(err, ErrInvalidFailureDomain) { t.Fatalf("err=%v", err) }
}

func TestGeographyRecoveryPreservesAttemptAndOperatorExclusions(t *testing.T) {
	planner := NewRecoveryPlanner(fakeRecoverySelector{selections: []discovery.Selection{
		geoSelection(12, "eu-west", 100),
		geoSelection(13, "ap-south", 90),
		geoSelection(14, "us-west", 80),
	}}, RecoveryPolicy{MaxAttempts: 3})
	req := geographyRequest()
	req.Occupied = map[[32]byte]struct{}{b32(12): {}}
	req.Attempted = map[[32]byte]struct{}{b32(13): {}}
	req.Attempt = 1
	decision, err := planner.SelectGeographicReplacement(context.Background(), req, GeographyRecoveryPolicy{})
	if err != nil { t.Fatal(err) }
	if decision.Replacement.Provider.OperatorID != b32(14) || decision.Attempt != 2 { t.Fatalf("decision=%+v", decision) }
}
