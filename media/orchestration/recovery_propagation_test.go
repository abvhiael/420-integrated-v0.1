package orchestration

import (
	"context"
	"errors"
	"testing"
)

func TestRecoveryPropagationPreservesHealthySiblingAndUnlocksRelay(t *testing.T) {
	ctx := context.Background()
	plan := lifecyclePlan()
	cfg := lifecycleConfig()
	market := &memoryLifecycleMarket{jobs: map[[32]byte]JobSnapshot{}}
	coord := NewLifecycleCoordinator(market)

	ingress := plan.Jobs[0]
	failed := plan.Jobs[1]
	healthy := plan.Jobs[2]
	market.jobs[CanonicalJobID(plan.StreamID, ingress.ID)] = JobSnapshot{
		JobID: CanonicalJobID(plan.StreamID, ingress.ID), OperatorID: ingress.OperatorID,
		Status: LifecycleSettled, OutputRef: b32(51),
	}
	failedID := CanonicalJobID(plan.StreamID, failed.ID)
	market.jobs[failedID] = JobSnapshot{JobID: failedID, OperatorID: failed.OperatorID, Status: LifecycleFailed}
	healthyID := CanonicalJobID(plan.StreamID, healthy.ID)
	market.jobs[healthyID] = JobSnapshot{JobID: healthyID, OperatorID: healthy.OperatorID, Status: LifecycleVerified, OutputRef: b32(62)}

	decision := RecoveryDecision{
		NodeID: failed.ID, PreviousOperatorID: failed.OperatorID,
		Replacement: recoverySelection(15, 100), Attempt: 1,
	}
	recoveryID := RecoveryJobID(plan.StreamID, failed.ID, 1)
	market.jobs[recoveryID] = JobSnapshot{
		JobID: recoveryID, OperatorID: decision.Replacement.Provider.OperatorID,
		Status: LifecycleVerified, OutputRef: b32(71),
	}

	created, err := coord.CreateReadyWithRecovery(ctx, plan, cfg, RecoveryBindings{failed.ID: decision})
	if err != nil { t.Fatal(err) }
	if len(created) != 1 || created[0] != CanonicalJobID(plan.StreamID, "relay:000") {
		t.Fatalf("created=%x", created)
	}
	if len(market.created) != 1 || market.created[0].Role != RoleRelay {
		t.Fatalf("expected one relay creation, got %+v", market.created)
	}
	if market.jobs[healthyID].Status != LifecycleVerified || market.jobs[healthyID].OutputRef != b32(62) {
		t.Fatal("healthy sibling was mutated during recovery propagation")
	}
	if market.jobs[failedID].Status != LifecycleFailed || market.jobs[failedID].OperatorID != failed.OperatorID {
		t.Fatal("failed canonical transcoder was mutated during recovery propagation")
	}

	expected, err := coord.inputRefWithRecovery(ctx, plan, plan.Jobs[3], cfg.RootInputRef, RecoveryBindings{failed.ID: decision})
	if err != nil { t.Fatal(err) }
	if market.created[0].InputRef != expected || expected == ([32]byte{}) {
		t.Fatalf("relay input=%x expected=%x", market.created[0].InputRef, expected)
	}
}

func TestRecoveryPropagationFailsClosedWithoutBinding(t *testing.T) {
	ctx := context.Background()
	plan := lifecyclePlan()
	market := recoveryPropagationMarket(plan)
	_, err := NewLifecycleCoordinator(market).ReadyWithRecovery(ctx, plan, nil)
	if !errors.Is(err, ErrDependencyFailed) { t.Fatalf("err=%v", err) }
}

func TestRecoveryPropagationWaitsForReplacementSuccess(t *testing.T) {
	ctx := context.Background()
	plan := lifecyclePlan()
	market := recoveryPropagationMarket(plan)
	failed := plan.Jobs[1]
	decision := RecoveryDecision{
		NodeID: failed.ID, PreviousOperatorID: failed.OperatorID,
		Replacement: recoverySelection(15, 100), Attempt: 1,
	}
	recoveryID := RecoveryJobID(plan.StreamID, failed.ID, 1)
	market.jobs[recoveryID] = JobSnapshot{
		JobID: recoveryID, OperatorID: decision.Replacement.Provider.OperatorID,
		Status: LifecycleRunning,
	}
	ready, err := NewLifecycleCoordinator(market).ReadyWithRecovery(ctx, plan, RecoveryBindings{failed.ID: decision})
	if err != nil { t.Fatal(err) }
	for _, node := range ready {
		if node.Role == RoleRelay { t.Fatal("relay became ready before recovery succeeded") }
	}
}

func TestRecoveryPropagationRejectsWrongReplacementIdentity(t *testing.T) {
	ctx := context.Background()
	plan := lifecyclePlan()
	market := recoveryPropagationMarket(plan)
	failed := plan.Jobs[1]
	decision := RecoveryDecision{
		NodeID: failed.ID, PreviousOperatorID: failed.OperatorID,
		Replacement: recoverySelection(15, 100), Attempt: 1,
	}
	recoveryID := RecoveryJobID(plan.StreamID, failed.ID, 1)
	market.jobs[recoveryID] = JobSnapshot{JobID: recoveryID, OperatorID: b32(99), Status: LifecycleVerified, OutputRef: b32(71)}
	_, err := NewLifecycleCoordinator(market).ReadyWithRecovery(ctx, plan, RecoveryBindings{failed.ID: decision})
	if !errors.Is(err, ErrInvalidRecovery) { t.Fatalf("err=%v", err) }
}

func recoveryPropagationMarket(plan Plan) *memoryLifecycleMarket {
	market := &memoryLifecycleMarket{jobs: map[[32]byte]JobSnapshot{}}
	ingress := plan.Jobs[0]
	failed := plan.Jobs[1]
	healthy := plan.Jobs[2]
	market.jobs[CanonicalJobID(plan.StreamID, ingress.ID)] = JobSnapshot{
		JobID: CanonicalJobID(plan.StreamID, ingress.ID), OperatorID: ingress.OperatorID,
		Status: LifecycleSettled, OutputRef: b32(51),
	}
	market.jobs[CanonicalJobID(plan.StreamID, failed.ID)] = JobSnapshot{
		JobID: CanonicalJobID(plan.StreamID, failed.ID), OperatorID: failed.OperatorID,
		Status: LifecycleFailed,
	}
	market.jobs[CanonicalJobID(plan.StreamID, healthy.ID)] = JobSnapshot{
		JobID: CanonicalJobID(plan.StreamID, healthy.ID), OperatorID: healthy.OperatorID,
		Status: LifecycleVerified, OutputRef: b32(62),
	}
	return market
}
