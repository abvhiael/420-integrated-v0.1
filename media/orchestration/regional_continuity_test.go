package orchestration

import (
	"context"
	"errors"
	"testing"

	"github.com/420integrated/420-integrated/media/discovery"
)

func regionalContinuityPlan() Plan {
	return Plan{
		StreamID: b32(1),
		Assignments: []Assignment{
			{Role: RoleIngress, OperatorID: b32(11)},
			{Role: RoleTranscoder, OperatorID: b32(12)},
			{Role: RoleTranscoder, OperatorID: b32(13)},
			{Role: RoleTranscoder, OperatorID: b32(15)},
			{Role: RoleRelay, OperatorID: b32(14)},
		},
		Jobs: []JobNode{
			{ID: "ingress", Role: RoleIngress, OperatorID: b32(11)},
			{ID: "transcode:000:480p", Role: RoleTranscoder, OperatorID: b32(12), DependsOn: []string{"ingress"}, Rendition: "480p"},
			{ID: "transcode:001:720p", Role: RoleTranscoder, OperatorID: b32(13), DependsOn: []string{"ingress"}, Rendition: "720p"},
			{ID: "transcode:002:1080p", Role: RoleTranscoder, OperatorID: b32(15), DependsOn: []string{"ingress"}, Rendition: "1080p"},
			{ID: "relay:000", Role: RoleRelay, OperatorID: b32(14), DependsOn: []string{"transcode:000:480p", "transcode:001:720p", "transcode:002:1080p"}},
		},
	}
}

func regionalContinuityBatch() (FailureDomainSnapshot, RegionalRecoveryPlan) {
	snapshot := FailureDomainSnapshot{
		FailedGeography: "ca-central",
		AffectedNodeIDs: []string{"transcode:001:720p", "transcode:000:480p"},
	}
	regional := RegionalRecoveryPlan{
		FailedGeography: "ca-central",
		Decisions: []RecoveryDecision{
			{
				NodeID: "transcode:000:480p", PreviousOperatorID: b32(12), Attempt: 1,
				Replacement: discovery.Selection{Provider: discovery.Provider{OperatorID: b32(20), Geography: "ap-south"}},
			},
			{
				NodeID: "transcode:001:720p", PreviousOperatorID: b32(13), Attempt: 1,
				Replacement: discovery.Selection{Provider: discovery.Provider{OperatorID: b32(21), Geography: "us-west"}},
			},
		},
	}
	return snapshot, regional
}

func TestRegionalRecoveryContinuityRecombinesRecoveredAndHealthyRenditions(t *testing.T) {
	ctx := context.Background()
	plan := regionalContinuityPlan()
	cfg := lifecycleConfig()
	snapshot, regional := regionalContinuityBatch()
	market := &memoryLifecycleMarket{jobs: map[[32]byte]JobSnapshot{}}
	coord := NewLifecycleCoordinator(market)

	ingress := plan.Jobs[0]
	failed480 := plan.Jobs[1]
	failed720 := plan.Jobs[2]
	healthy1080 := plan.Jobs[3]
	market.jobs[CanonicalJobID(plan.StreamID, ingress.ID)] = JobSnapshot{JobID: CanonicalJobID(plan.StreamID, ingress.ID), OperatorID: ingress.OperatorID, Status: LifecycleSettled, OutputRef: b32(50)}
	market.jobs[CanonicalJobID(plan.StreamID, failed480.ID)] = JobSnapshot{JobID: CanonicalJobID(plan.StreamID, failed480.ID), OperatorID: failed480.OperatorID, Status: LifecycleFailed}
	market.jobs[CanonicalJobID(plan.StreamID, failed720.ID)] = JobSnapshot{JobID: CanonicalJobID(plan.StreamID, failed720.ID), OperatorID: failed720.OperatorID, Status: LifecycleExpired}
	healthyID := CanonicalJobID(plan.StreamID, healthy1080.ID)
	market.jobs[healthyID] = JobSnapshot{JobID: healthyID, OperatorID: healthy1080.OperatorID, Status: LifecycleVerified, OutputRef: b32(63)}

	market.jobs[RecoveryJobID(plan.StreamID, failed480.ID, 1)] = JobSnapshot{JobID: RecoveryJobID(plan.StreamID, failed480.ID, 1), OperatorID: b32(20), Status: LifecycleVerified, OutputRef: b32(71)}
	market.jobs[RecoveryJobID(plan.StreamID, failed720.ID, 1)] = JobSnapshot{JobID: RecoveryJobID(plan.StreamID, failed720.ID, 1), OperatorID: b32(21), Status: LifecycleSettled, OutputRef: b32(72)}

	bindings, err := RecoveryBindingsFromRegionalPlan(plan, snapshot, regional)
	if err != nil { t.Fatal(err) }
	expected, err := coord.inputRefWithRecovery(ctx, plan, plan.Jobs[4], cfg.RootInputRef, bindings)
	if err != nil { t.Fatal(err) }

	created, err := coord.CreateReadyWithRegionalRecovery(ctx, plan, cfg, snapshot, regional)
	if err != nil { t.Fatal(err) }
	if len(created) != 1 || created[0] != CanonicalJobID(plan.StreamID, "relay:000") { t.Fatalf("created=%x", created) }
	if len(market.created) != 1 || market.created[0].Role != RoleRelay { t.Fatalf("created specs=%+v", market.created) }
	if market.created[0].InputRef != expected || expected == ([32]byte{}) { t.Fatalf("relay input=%x expected=%x", market.created[0].InputRef, expected) }
	if market.jobs[healthyID].Status != LifecycleVerified || market.jobs[healthyID].OutputRef != b32(63) { t.Fatal("healthy remote rendition was mutated") }
	if market.jobs[CanonicalJobID(plan.StreamID, failed480.ID)].Status != LifecycleFailed { t.Fatal("failed canonical 480p history mutated") }
	if market.jobs[CanonicalJobID(plan.StreamID, failed720.ID)].Status != LifecycleExpired { t.Fatal("failed canonical 720p history mutated") }
}

func TestRegionalRecoveryContinuityWaitsUntilEveryAffectedRenditionRecovers(t *testing.T) {
	ctx := context.Background()
	plan := regionalContinuityPlan()
	cfg := lifecycleConfig()
	snapshot, regional := regionalContinuityBatch()
	market := &memoryLifecycleMarket{jobs: map[[32]byte]JobSnapshot{}}
	coord := NewLifecycleCoordinator(market)

	market.jobs[CanonicalJobID(plan.StreamID, "ingress")] = JobSnapshot{JobID: CanonicalJobID(plan.StreamID, "ingress"), OperatorID: b32(11), Status: LifecycleSettled, OutputRef: b32(50)}
	market.jobs[CanonicalJobID(plan.StreamID, "transcode:000:480p")] = JobSnapshot{JobID: CanonicalJobID(plan.StreamID, "transcode:000:480p"), OperatorID: b32(12), Status: LifecycleFailed}
	market.jobs[CanonicalJobID(plan.StreamID, "transcode:001:720p")] = JobSnapshot{JobID: CanonicalJobID(plan.StreamID, "transcode:001:720p"), OperatorID: b32(13), Status: LifecycleFailed}
	market.jobs[CanonicalJobID(plan.StreamID, "transcode:002:1080p")] = JobSnapshot{JobID: CanonicalJobID(plan.StreamID, "transcode:002:1080p"), OperatorID: b32(15), Status: LifecycleVerified, OutputRef: b32(63)}
	market.jobs[RecoveryJobID(plan.StreamID, "transcode:000:480p", 1)] = JobSnapshot{JobID: RecoveryJobID(plan.StreamID, "transcode:000:480p", 1), OperatorID: b32(20), Status: LifecycleVerified, OutputRef: b32(71)}
	market.jobs[RecoveryJobID(plan.StreamID, "transcode:001:720p", 1)] = JobSnapshot{JobID: RecoveryJobID(plan.StreamID, "transcode:001:720p", 1), OperatorID: b32(21), Status: LifecycleRunning}

	created, err := coord.CreateReadyWithRegionalRecovery(ctx, plan, cfg, snapshot, regional)
	if err != nil { t.Fatal(err) }
	if len(created) != 0 || len(market.created) != 0 { t.Fatalf("relay created early: %x", created) }
}

func TestRegionalRecoveryContinuityRejectsIncompleteBatch(t *testing.T) {
	plan := regionalContinuityPlan()
	snapshot, regional := regionalContinuityBatch()
	regional.Decisions = regional.Decisions[:1]
	_, err := RecoveryBindingsFromRegionalPlan(plan, snapshot, regional)
	if !errors.Is(err, ErrRegionalRecoveryIncomplete) { t.Fatalf("err=%v", err) }
}

func TestRegionalRecoveryContinuityRejectsDecisionOutsideOutage(t *testing.T) {
	plan := regionalContinuityPlan()
	snapshot, regional := regionalContinuityBatch()
	regional.Decisions[1] = RecoveryDecision{
		NodeID: "transcode:002:1080p", PreviousOperatorID: b32(15), Attempt: 1,
		Replacement: discovery.Selection{Provider: discovery.Provider{OperatorID: b32(22), Geography: "eu-north"}},
	}
	_, err := RecoveryBindingsFromRegionalPlan(plan, snapshot, regional)
	if !errors.Is(err, ErrInvalidRecovery) { t.Fatalf("err=%v", err) }
}

func TestRegionalRecoveryContinuityRejectsFailedDomainReplacement(t *testing.T) {
	plan := regionalContinuityPlan()
	snapshot, regional := regionalContinuityBatch()
	regional.Decisions[0].Replacement.Provider.Geography = snapshot.FailedGeography
	_, err := RecoveryBindingsFromRegionalPlan(plan, snapshot, regional)
	if !errors.Is(err, ErrInvalidRecovery) { t.Fatalf("err=%v", err) }
}
