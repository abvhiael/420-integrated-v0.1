package orchestration

import (
	"context"
	"errors"
	"testing"

	"github.com/420integrated/420-integrated/media/controlplane"
)

type fakeDiscovery struct {
	byCapability map[[32]byte][]controlplane.ProviderView
	err          error
}

func (f fakeDiscovery) Providers(_ context.Context, req controlplane.DiscoveryRequest) ([]controlplane.ProviderView, error) {
	if f.err != nil { return nil, f.err }
	return append([]controlplane.ProviderView(nil), f.byCapability[req.CapabilityID]...), nil
}

func id(v byte) [32]byte { var out [32]byte; out[31] = v; return out }

func provider(v byte, score uint64) controlplane.ProviderView {
	return controlplane.ProviderView{OperatorID: id(v), Score: score, Revision: 1, ReliabilityBPS: 9900, AvailableSlots: 10}
}

func TestBuildConstructsDeterministicJobGraph(t *testing.T) {
	ingressCap, transcodeCap, relayCap := id(10), id(11), id(12)
	p := NewPlanner(fakeDiscovery{byCapability: map[[32]byte][]controlplane.ProviderView{
		ingressCap: {provider(1, 100)},
		transcodeCap: {provider(2, 90), provider(3, 80)},
		relayCap: {provider(4, 70)},
	}})
	plan, err := p.Build(context.Background(), PlanRequest{
		StreamID: id(99),
		Capabilities: CapabilitySet{Ingress: ingressCap, Transcoder: transcodeCap, Relay: relayCap},
		Renditions: []string{"720p", "1080p"},
		RelayCount: 1,
	})
	if err != nil { t.Fatal(err) }
	if len(plan.Assignments) != 4 { t.Fatalf("assignments=%d", len(plan.Assignments)) }
	if len(plan.Jobs) != 4 { t.Fatalf("jobs=%d", len(plan.Jobs)) }
	if plan.Jobs[0].ID != "ingress" || len(plan.Jobs[0].DependsOn) != 0 { t.Fatalf("bad ingress job: %+v", plan.Jobs[0]) }
	if plan.Jobs[1].ID != "transcode:000:720p" || len(plan.Jobs[1].DependsOn) != 1 || plan.Jobs[1].DependsOn[0] != "ingress" { t.Fatalf("bad transcode job: %+v", plan.Jobs[1]) }
	if plan.Jobs[3].ID != "relay:000" || len(plan.Jobs[3].DependsOn) != 2 { t.Fatalf("bad relay job: %+v", plan.Jobs[3]) }
	if err := Validate(plan); err != nil { t.Fatal(err) }
}

func TestBuildExcludesOperatorReuseAcrossRoles(t *testing.T) {
	ingressCap, transcodeCap := id(10), id(11)
	p := NewPlanner(fakeDiscovery{byCapability: map[[32]byte][]controlplane.ProviderView{
		ingressCap: {provider(1, 100)},
		transcodeCap: {provider(1, 99), provider(2, 90)},
	}})
	plan, err := p.Build(context.Background(), PlanRequest{
		StreamID: id(99), Capabilities: CapabilitySet{Ingress: ingressCap, Transcoder: transcodeCap}, Renditions: []string{"720p"},
	})
	if err != nil { t.Fatal(err) }
	if plan.Jobs[1].OperatorID != id(2) { t.Fatalf("expected independent transcoder, got %x", plan.Jobs[1].OperatorID) }
}

func TestBuildFailsWhenIndependentCapacityUnavailable(t *testing.T) {
	ingressCap, transcodeCap := id(10), id(11)
	p := NewPlanner(fakeDiscovery{byCapability: map[[32]byte][]controlplane.ProviderView{
		ingressCap: {provider(1, 100)},
		transcodeCap: {provider(1, 99)},
	}})
	_, err := p.Build(context.Background(), PlanRequest{
		StreamID: id(99), Capabilities: CapabilitySet{Ingress: ingressCap, Transcoder: transcodeCap}, Renditions: []string{"720p"},
	})
	if !errors.Is(err, ErrNoAssignment) { t.Fatalf("err=%v", err) }
}

func TestBuildPropagatesDiscoveryFailure(t *testing.T) {
	boom := errors.New("rpc unavailable")
	p := NewPlanner(fakeDiscovery{err: boom})
	_, err := p.Build(context.Background(), PlanRequest{
		StreamID: id(99), Capabilities: CapabilitySet{Ingress: id(10), Transcoder: id(11)}, Renditions: []string{"720p"},
	})
	if !errors.Is(err, boom) { t.Fatalf("err=%v", err) }
}

func TestBuildRejectsDuplicateRenditions(t *testing.T) {
	p := NewPlanner(fakeDiscovery{})
	_, err := p.Build(context.Background(), PlanRequest{
		StreamID: id(99), Capabilities: CapabilitySet{Ingress: id(10), Transcoder: id(11)}, Renditions: []string{"720p", "720p"},
	})
	if !errors.Is(err, ErrInvalidPlan) { t.Fatalf("err=%v", err) }
}

func TestValidateRejectsCycle(t *testing.T) {
	plan := Plan{
		StreamID: id(99),
		Assignments: []Assignment{{Role: RoleIngress, OperatorID: id(1)}},
		Jobs: []JobNode{
			{ID: "a", Role: RoleIngress, OperatorID: id(1), DependsOn: []string{"b"}},
			{ID: "b", Role: RoleTranscoder, OperatorID: id(2), DependsOn: []string{"a"}},
		},
	}
	if !errors.Is(Validate(plan), ErrInvalidGraph) { t.Fatal("expected cycle rejection") }
}
