package orchestration

import (
	"context"
	"errors"
	"testing"

	"github.com/420integrated/420-integrated/media/discovery"
)

type fakeGeographyResolver struct {
	geographies map[[32]byte]string
	err          error
}

func (f fakeGeographyResolver) Geography(context.Context, [32]byte) (string, error) {
	panic("use geographyResolver")
}

type geographyResolver map[[32]byte]string

func (g geographyResolver) Geography(_ context.Context, operatorID [32]byte) (string, error) {
	return g[operatorID], nil
}

type failingGeographyResolver struct{ err error }

func (f failingGeographyResolver) Geography(context.Context, [32]byte) (string, error) {
	return "", f.err
}

func TestFailureDomainSnapshotDerivesRegionalOutageFromDAG(t *testing.T) {
	plan := lifecyclePlan()
	resolver := geographyResolver{
		b32(11): "ca-central",
		b32(12): "ca-central",
		b32(13): "us-east",
		b32(14): "eu-west",
	}

	snapshot, err := DeriveFailureDomainSnapshot(context.Background(), plan, "transcode:000:720p", nil, resolver)
	if err != nil { t.Fatal(err) }
	if snapshot.FailedGeography != "ca-central" { t.Fatalf("failed geo=%q", snapshot.FailedGeography) }
	if len(snapshot.AffectedNodeIDs) != 2 || snapshot.AffectedNodeIDs[0] != "ingress" || snapshot.AffectedNodeIDs[1] != "transcode:000:720p" {
		t.Fatalf("affected=%v", snapshot.AffectedNodeIDs)
	}
	if _, ok := snapshot.OccupiedGeographies["us-east"]; !ok { t.Fatal("missing us-east") }
	if _, ok := snapshot.OccupiedGeographies["eu-west"]; !ok { t.Fatal("missing eu-west") }
	if _, ok := snapshot.OccupiedGeographies["ca-central"]; ok { t.Fatal("failed geography must not be healthy occupied") }
	if _, ok := snapshot.OccupiedOperators[b32(13)]; !ok { t.Fatal("missing healthy transcoder") }
	if _, ok := snapshot.OccupiedOperators[b32(14)]; !ok { t.Fatal("missing healthy relay") }
}

func TestFailureDomainSnapshotUsesEffectiveRecoveryPlacement(t *testing.T) {
	plan := lifecyclePlan()
	recoveries := RecoveryBindings{
		"transcode:001:1080p": RecoveryDecision{
			NodeID: "transcode:001:1080p",
			PreviousOperatorID: b32(13),
			Replacement: discovery.Selection{Provider: discovery.Provider{OperatorID: b32(99), Geography: "ap-south"}},
			Attempt: 1,
		},
	}
	resolver := geographyResolver{
		b32(11): "ca-central",
		b32(12): "ca-central",
		b32(13): "us-east",
		b32(14): "eu-west",
	}

	snapshot, err := DeriveFailureDomainSnapshot(context.Background(), plan, "transcode:000:720p", recoveries, resolver)
	if err != nil { t.Fatal(err) }
	if snapshot.NodeGeographies["transcode:001:1080p"] != "ap-south" { t.Fatalf("geo=%q", snapshot.NodeGeographies["transcode:001:1080p"]) }
	if _, ok := snapshot.OccupiedOperators[b32(99)]; !ok { t.Fatal("replacement operator not derived") }
	if _, ok := snapshot.OccupiedOperators[b32(13)]; ok { t.Fatal("superseded operator must not remain occupied") }
}

func TestFailureDomainSnapshotFailsClosedOnLookupFailure(t *testing.T) {
	boom := errors.New("metadata unavailable")
	_, err := DeriveFailureDomainSnapshot(context.Background(), lifecyclePlan(), "ingress", nil, failingGeographyResolver{err: boom})
	if !errors.Is(err, ErrFailureDomainLookup) || !errors.Is(err, boom) { t.Fatalf("err=%v", err) }
}

func TestFailureDomainSnapshotFailsClosedOnMissingGeography(t *testing.T) {
	resolver := geographyResolver{b32(11): "ca-central"}
	_, err := DeriveFailureDomainSnapshot(context.Background(), lifecyclePlan(), "ingress", nil, resolver)
	if !errors.Is(err, ErrInvalidFailureDomain) { t.Fatalf("err=%v", err) }
}

func TestGeographicRecoveryRequestFromSnapshotDerivesOccupiedState(t *testing.T) {
	plan := lifecyclePlan()
	resolver := geographyResolver{
		b32(11): "ca-central",
		b32(12): "ca-central",
		b32(13): "us-east",
		b32(14): "eu-west",
	}
	snapshot, err := DeriveFailureDomainSnapshot(context.Background(), plan, "transcode:000:720p", nil, resolver)
	if err != nil { t.Fatal(err) }
	base := RecoveryRequest{
		Node: JobNode{ID: "transcode:000:720p", Role: RoleTranscoder, OperatorID: b32(12)},
		Selection: discovery.Request{CapabilityID: b32(21)},
		FailedOperatorID: b32(12),
	}
	req, err := GeographicRecoveryRequestFromSnapshot(base, snapshot)
	if err != nil { t.Fatal(err) }
	if req.FailedGeography != "ca-central" { t.Fatalf("failed geo=%q", req.FailedGeography) }
	if _, ok := req.OccupiedGeographies["us-east"]; !ok { t.Fatal("missing us-east") }
	if _, ok := req.OccupiedGeographies["eu-west"]; !ok { t.Fatal("missing eu-west") }
	if _, ok := req.Occupied[b32(13)]; !ok { t.Fatal("missing healthy operator") }
	if _, ok := req.Occupied[b32(14)]; !ok { t.Fatal("missing relay operator") }
}

func TestGeographicRecoveryRequestRejectsHealthyNodeOutsideOutage(t *testing.T) {
	plan := lifecyclePlan()
	resolver := geographyResolver{
		b32(11): "ca-central",
		b32(12): "ca-central",
		b32(13): "us-east",
		b32(14): "eu-west",
	}
	snapshot, err := DeriveFailureDomainSnapshot(context.Background(), plan, "transcode:000:720p", nil, resolver)
	if err != nil { t.Fatal(err) }
	_, err = GeographicRecoveryRequestFromSnapshot(RecoveryRequest{
		Node: JobNode{ID: "transcode:001:1080p", Role: RoleTranscoder, OperatorID: b32(13)},
		Selection: discovery.Request{CapabilityID: b32(21)},
		FailedOperatorID: b32(13),
	}, snapshot)
	if !errors.Is(err, ErrInvalidFailureDomain) { t.Fatalf("err=%v", err) }
}
