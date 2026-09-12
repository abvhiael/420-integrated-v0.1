package orchestration

import (
	"context"
	"errors"
	"testing"
)

func TestRecoveryJobIDIsStableAttemptScopedAndDistinct(t *testing.T) {
	streamID := b32(1)
	a1 := RecoveryJobID(streamID, "ingress", 1)
	a1b := RecoveryJobID(streamID, "ingress", 1)
	a2 := RecoveryJobID(streamID, "ingress", 2)
	canonical := CanonicalJobID(streamID, "ingress")
	if a1 == ([32]byte{}) || a1 != a1b { t.Fatal("recovery id must be stable and non-zero") }
	if a1 == a2 || a1 == canonical { t.Fatal("recovery id must be attempt-scoped and distinct from canonical id") }
	if RecoveryJobID(streamID, "ingress", 0) != ([32]byte{}) { t.Fatal("attempt zero must be invalid") }
}

func TestCreateRecoveryAttemptPreservesFailedCanonicalJob(t *testing.T) {
	ctx := context.Background()
	plan := Plan{
		StreamID: b32(1),
		Assignments: []Assignment{{Role: RoleIngress, OperatorID: b32(11)}},
		Jobs: []JobNode{{ID: "ingress", Role: RoleIngress, OperatorID: b32(11)}},
	}
	cfg := lifecycleConfig()
	market := &memoryLifecycleMarket{jobs: map[[32]byte]JobSnapshot{}}
	canonical := CanonicalJobID(plan.StreamID, "ingress")
	market.jobs[canonical] = JobSnapshot{JobID: canonical, OperatorID: b32(11), Status: LifecycleFailed}
	coord := NewLifecycleCoordinator(market)
	decision := RecoveryDecision{NodeID: "ingress", PreviousOperatorID: b32(11), Replacement: recoverySelection(12, 100), Attempt: 1}

	recoveryID, err := coord.CreateRecoveryAttempt(ctx, plan, "ingress", decision, cfg)
	if err != nil { t.Fatal(err) }
	if recoveryID == canonical || recoveryID != RecoveryJobID(plan.StreamID, "ingress", 1) { t.Fatalf("recovery id=%x", recoveryID) }
	if market.jobs[canonical].Status != LifecycleFailed || market.jobs[canonical].OperatorID != b32(11) { t.Fatal("canonical failed job mutated") }
	recovery := market.jobs[recoveryID]
	if recovery.Status != LifecycleCreated || recovery.OperatorID != b32(12) { t.Fatalf("recovery=%+v", recovery) }
	if len(market.created) != 1 || market.created[0].InputRef != cfg.RootInputRef { t.Fatalf("created=%+v", market.created) }
}

func TestCreateRecoveryAttemptRequiresTerminalFailure(t *testing.T) {
	ctx := context.Background()
	plan := Plan{
		StreamID: b32(1),
		Assignments: []Assignment{{Role: RoleIngress, OperatorID: b32(11)}},
		Jobs: []JobNode{{ID: "ingress", Role: RoleIngress, OperatorID: b32(11)}},
	}
	cfg := lifecycleConfig()
	market := &memoryLifecycleMarket{jobs: map[[32]byte]JobSnapshot{}}
	canonical := CanonicalJobID(plan.StreamID, "ingress")
	market.jobs[canonical] = JobSnapshot{JobID: canonical, OperatorID: b32(11), Status: LifecycleRunning}
	decision := RecoveryDecision{NodeID: "ingress", PreviousOperatorID: b32(11), Replacement: recoverySelection(12, 100), Attempt: 1}
	_, err := NewLifecycleCoordinator(market).CreateRecoveryAttempt(ctx, plan, "ingress", decision, cfg)
	if !errors.Is(err, ErrInvalidRecovery) { t.Fatalf("err=%v", err) }
}

func TestCreateRecoveryAttemptIsIdempotentForMatchingAttempt(t *testing.T) {
	ctx := context.Background()
	plan := Plan{
		StreamID: b32(1),
		Assignments: []Assignment{{Role: RoleIngress, OperatorID: b32(11)}},
		Jobs: []JobNode{{ID: "ingress", Role: RoleIngress, OperatorID: b32(11)}},
	}
	cfg := lifecycleConfig()
	market := &memoryLifecycleMarket{jobs: map[[32]byte]JobSnapshot{}}
	canonical := CanonicalJobID(plan.StreamID, "ingress")
	market.jobs[canonical] = JobSnapshot{JobID: canonical, OperatorID: b32(11), Status: LifecycleExpired}
	decision := RecoveryDecision{NodeID: "ingress", PreviousOperatorID: b32(11), Replacement: recoverySelection(12, 100), Attempt: 1}
	coord := NewLifecycleCoordinator(market)
	first, err := coord.CreateRecoveryAttempt(ctx, plan, "ingress", decision, cfg); if err != nil { t.Fatal(err) }
	second, err := coord.CreateRecoveryAttempt(ctx, plan, "ingress", decision, cfg); if err != nil { t.Fatal(err) }
	if first != second || len(market.created) != 1 { t.Fatalf("first=%x second=%x created=%d", first, second, len(market.created)) }
}
