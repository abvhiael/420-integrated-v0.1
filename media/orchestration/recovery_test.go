package orchestration

import (
	"context"
	"errors"
	"testing"

	"github.com/420integrated/420-integrated/media/discovery"
)

type fakeRecoverySelector struct {
	selections []discovery.Selection
	err        error
}

func (f fakeRecoverySelector) Select(context.Context, discovery.Request) ([]discovery.Selection, error) {
	return f.selections, f.err
}

func recoverySelection(id byte, score uint64) discovery.Selection {
	return discovery.Selection{Provider: discovery.Provider{OperatorID: b32(id), Active: true}, Score: score}
}

func TestRecoverySelectsHighestRankedUnusedReplacement(t *testing.T) {
	planner := NewRecoveryPlanner(fakeRecoverySelector{selections: []discovery.Selection{
		recoverySelection(11, 100),
		recoverySelection(12, 90),
		recoverySelection(13, 80),
		recoverySelection(14, 70),
	}}, RecoveryPolicy{MaxAttempts: 3})

	decision, err := planner.SelectReplacement(context.Background(), RecoveryRequest{
		Node: JobNode{ID: "transcode:000:720p", Role: RoleTranscoder, OperatorID: b32(11)},
		Selection: discovery.Request{CapabilityID: b32(21)},
		FailedOperatorID: b32(11),
		Occupied: map[[32]byte]struct{}{b32(12): {}},
		Attempted: map[[32]byte]struct{}{b32(13): {}},
		Attempt: 1,
	})
	if err != nil { t.Fatal(err) }
	if decision.Replacement.Provider.OperatorID != b32(14) { t.Fatalf("replacement=%x", decision.Replacement.Provider.OperatorID) }
	if decision.Attempt != 2 { t.Fatalf("attempt=%d", decision.Attempt) }
}

func TestRecoveryFailsClosedWhenProviderDiscoveryFails(t *testing.T) {
	boom := errors.New("rpc unavailable")
	planner := NewRecoveryPlanner(fakeRecoverySelector{err: boom}, RecoveryPolicy{})
	_, err := planner.SelectReplacement(context.Background(), RecoveryRequest{
		Node: JobNode{ID: "ingress", OperatorID: b32(11)},
		Selection: discovery.Request{CapabilityID: b32(21)},
		FailedOperatorID: b32(11),
	})
	if !errors.Is(err, boom) { t.Fatalf("err=%v", err) }
}

func TestRecoveryExhaustsAfterBoundedAttempts(t *testing.T) {
	planner := NewRecoveryPlanner(fakeRecoverySelector{}, RecoveryPolicy{MaxAttempts: 2})
	_, err := planner.SelectReplacement(context.Background(), RecoveryRequest{
		Node: JobNode{ID: "ingress", OperatorID: b32(11)},
		Selection: discovery.Request{CapabilityID: b32(21)},
		FailedOperatorID: b32(11),
		Attempt: 2,
	})
	if !errors.Is(err, ErrRecoveryExhausted) { t.Fatalf("err=%v", err) }
}

func TestRecoveryExhaustsWhenOnlyBlockedOperatorsRemain(t *testing.T) {
	planner := NewRecoveryPlanner(fakeRecoverySelector{selections: []discovery.Selection{
		recoverySelection(11, 100), recoverySelection(12, 90), recoverySelection(13, 80),
	}}, RecoveryPolicy{})
	_, err := planner.SelectReplacement(context.Background(), RecoveryRequest{
		Node: JobNode{ID: "relay:000", OperatorID: b32(11)},
		Selection: discovery.Request{CapabilityID: b32(21)},
		FailedOperatorID: b32(11),
		Occupied: map[[32]byte]struct{}{b32(12): {}},
		Attempted: map[[32]byte]struct{}{b32(13): {}},
	})
	if !errors.Is(err, ErrRecoveryExhausted) { t.Fatalf("err=%v", err) }
}

func TestApplyRecoveryRebindsOnlyFailedNodeAndAssignment(t *testing.T) {
	plan := lifecyclePlan()
	decision := RecoveryDecision{
		NodeID: "transcode:000:720p",
		PreviousOperatorID: b32(12),
		Replacement: recoverySelection(99, 42),
		Attempt: 1,
	}
	updated, err := ApplyRecovery(plan, decision)
	if err != nil { t.Fatal(err) }
	if updated.Jobs[1].OperatorID != b32(99) { t.Fatalf("job operator=%x", updated.Jobs[1].OperatorID) }
	if updated.Jobs[2].OperatorID != b32(13) || updated.Jobs[3].OperatorID != b32(14) { t.Fatal("unrelated jobs changed") }
	if plan.Jobs[1].OperatorID != b32(12) { t.Fatal("original plan mutated") }
}
