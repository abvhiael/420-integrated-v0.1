package orchestration

import (
	"context"
	"errors"
	"testing"
	"time"
)

type memoryLifecycleMarket struct {
	jobs    map[[32]byte]JobSnapshot
	created []JobSpec
	fail    error
}

func (m *memoryLifecycleMarket) CreateJob(_ context.Context, spec JobSpec) error {
	if m.fail != nil { return m.fail }
	if m.jobs == nil { m.jobs = map[[32]byte]JobSnapshot{} }
	if _, exists := m.jobs[spec.JobID]; exists { return errors.New("exists") }
	m.created = append(m.created, spec)
	m.jobs[spec.JobID] = JobSnapshot{JobID: spec.JobID, OperatorID: spec.OperatorID, Status: LifecycleCreated}
	return nil
}

func (m *memoryLifecycleMarket) Snapshot(_ context.Context, id [32]byte) (JobSnapshot, error) {
	if m.jobs == nil { return JobSnapshot{}, errors.New("not found") }
	j, ok := m.jobs[id]
	if !ok { return JobSnapshot{}, errors.New("not found") }
	return j, nil
}

func b32(v byte) [32]byte { var out [32]byte; out[31] = v; return out }

func lifecyclePlan() Plan {
	return Plan{
		StreamID: b32(1),
		Assignments: []Assignment{
			{Role: RoleIngress, OperatorID: b32(11)},
			{Role: RoleTranscoder, OperatorID: b32(12)},
			{Role: RoleTranscoder, OperatorID: b32(13)},
			{Role: RoleRelay, OperatorID: b32(14)},
		},
		Jobs: []JobNode{
			{ID: "ingress", Role: RoleIngress, OperatorID: b32(11)},
			{ID: "transcode:000:720p", Role: RoleTranscoder, OperatorID: b32(12), DependsOn: []string{"ingress"}, Rendition: "720p"},
			{ID: "transcode:001:1080p", Role: RoleTranscoder, OperatorID: b32(13), DependsOn: []string{"ingress"}, Rendition: "1080p"},
			{ID: "relay:000", Role: RoleRelay, OperatorID: b32(14), DependsOn: []string{"transcode:000:720p", "transcode:001:1080p"}},
		},
	}
}

func lifecycleConfig() LifecycleConfig {
	return LifecycleConfig{
		Capabilities: CapabilitySet{Ingress: b32(21), Transcoder: b32(22), Relay: b32(23)},
		JobKinds: map[Role][32]byte{RoleIngress: b32(31), RoleTranscoder: b32(32), RoleRelay: b32(33)},
		MaxSpend: map[Role]uint64{RoleIngress: 100, RoleTranscoder: 200, RoleRelay: 50},
		Deadline: time.Now().Add(time.Hour),
		RootInputRef: b32(41),
	}
}

func TestLifecycleCreatesOnlyDependencyReadyJobs(t *testing.T) {
	ctx := context.Background()
	plan := lifecyclePlan()
	market := &memoryLifecycleMarket{}
	coord := NewLifecycleCoordinator(market)

	created, err := coord.CreateReady(ctx, plan, lifecycleConfig())
	if err != nil { t.Fatal(err) }
	if len(created) != 1 { t.Fatalf("created=%d want 1", len(created)) }
	if market.created[0].NodeID != "ingress" { t.Fatalf("created %q first", market.created[0].NodeID) }
	if market.created[0].InputRef != b32(41) { t.Fatal("ingress did not receive root input ref") }

	ingressID := CanonicalJobID(plan.StreamID, "ingress")
	market.jobs[ingressID] = JobSnapshot{JobID: ingressID, OperatorID: b32(11), Status: LifecycleVerified, OutputRef: b32(51)}
	created, err = coord.CreateReady(ctx, plan, lifecycleConfig())
	if err != nil { t.Fatal(err) }
	if len(created) != 2 { t.Fatalf("created=%d want 2 transcoders", len(created)) }
	for _, spec := range market.created[1:] {
		if spec.Role != RoleTranscoder || spec.InputRef != b32(51) { t.Fatalf("bad transcoder spec: %+v", spec) }
	}
}

func TestLifecycleRelayWaitsForAllTranscodersAndUsesManifest(t *testing.T) {
	ctx := context.Background()
	plan := lifecyclePlan()
	market := &memoryLifecycleMarket{jobs: map[[32]byte]JobSnapshot{}}
	coord := NewLifecycleCoordinator(market)

	ingressID := CanonicalJobID(plan.StreamID, "ingress")
	market.jobs[ingressID] = JobSnapshot{JobID: ingressID, OperatorID: b32(11), Status: LifecycleSettled, OutputRef: b32(51)}
	for _, n := range plan.Jobs[1:3] {
		id := CanonicalJobID(plan.StreamID, n.ID)
		market.jobs[id] = JobSnapshot{JobID: id, OperatorID: n.OperatorID, Status: LifecycleVerified, OutputRef: b32(byte(60 + len(n.ID)))}
	}

	created, err := coord.CreateReady(ctx, plan, lifecycleConfig())
	if err != nil { t.Fatal(err) }
	if len(created) != 1 || market.created[0].Role != RoleRelay { t.Fatalf("expected one relay, got %+v", market.created) }
	if market.created[0].InputRef == ([32]byte{}) || market.created[0].InputRef == b32(51) {
		t.Fatal("relay input must be deterministic multi-parent manifest ref")
	}
}

func TestLifecycleFailsClosedOnDependencyFailure(t *testing.T) {
	ctx := context.Background()
	plan := lifecyclePlan()
	market := &memoryLifecycleMarket{jobs: map[[32]byte]JobSnapshot{}}
	ingressID := CanonicalJobID(plan.StreamID, "ingress")
	market.jobs[ingressID] = JobSnapshot{JobID: ingressID, OperatorID: b32(11), Status: LifecycleFailed}
	_, err := NewLifecycleCoordinator(market).Ready(ctx, plan)
	if !errors.Is(err, ErrDependencyFailed) { t.Fatalf("err=%v", err) }
}

func TestLifecycleRejectsCanonicalIdentityMismatch(t *testing.T) {
	ctx := context.Background()
	plan := lifecyclePlan()
	market := &memoryLifecycleMarket{jobs: map[[32]byte]JobSnapshot{}}
	ingressID := CanonicalJobID(plan.StreamID, "ingress")
	market.jobs[ingressID] = JobSnapshot{JobID: ingressID, OperatorID: b32(99), Status: LifecycleVerified, OutputRef: b32(51)}
	_, err := NewLifecycleCoordinator(market).Ready(ctx, plan)
	if !errors.Is(err, ErrInvalidLifecycle) { t.Fatalf("err=%v", err) }
}

func TestCanonicalJobIDStableAndNodeScoped(t *testing.T) {
	a := CanonicalJobID(b32(1), "ingress")
	b := CanonicalJobID(b32(1), "ingress")
	c := CanonicalJobID(b32(1), "relay:000")
	if a != b { t.Fatal("canonical job id not stable") }
	if a == c || a == ([32]byte{}) { t.Fatal("canonical job id not node scoped") }
}

func TestLifecycleRejectsInvalidConfig(t *testing.T) {
	cfg := lifecycleConfig()
	cfg.MaxSpend[RoleRelay] = 0
	_, err := NewLifecycleCoordinator(&memoryLifecycleMarket{}).CreateReady(context.Background(), lifecyclePlan(), cfg)
	if !errors.Is(err, ErrInvalidLifecycle) { t.Fatalf("err=%v", err) }
}
