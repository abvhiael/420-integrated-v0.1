package orchestration

import (
	"context"
	"errors"
	"testing"
)

func TestRelayBlockedWhenOneTranscoderFails(t *testing.T) {
	plan := lifecyclePlan()
	market := &memoryLifecycleMarket{jobs: map[[32]byte]JobSnapshot{}}

	ingressID := CanonicalJobID(plan.StreamID, "ingress")
	market.jobs[ingressID] = JobSnapshot{JobID: ingressID, OperatorID: b32(11), Status: LifecycleVerified, OutputRef: b32(51)}

	okNode := plan.Jobs[1]
	okID := CanonicalJobID(plan.StreamID, okNode.ID)
	market.jobs[okID] = JobSnapshot{JobID: okID, OperatorID: okNode.OperatorID, Status: LifecycleVerified, OutputRef: b32(61)}

	failedNode := plan.Jobs[2]
	failedID := CanonicalJobID(plan.StreamID, failedNode.ID)
	market.jobs[failedID] = JobSnapshot{JobID: failedID, OperatorID: failedNode.OperatorID, Status: LifecycleFailed}

	_, err := NewLifecycleCoordinator(market).Ready(context.Background(), plan)
	if !errors.Is(err, ErrDependencyFailed) {
		t.Fatalf("err=%v want ErrDependencyFailed", err)
	}

	relayID := CanonicalJobID(plan.StreamID, "relay:000")
	if _, exists := market.jobs[relayID]; exists {
		t.Fatal("relay job must not be created after a rendition failure")
	}
}

func TestRelayWaitsWhileOneTranscoderIsStillRunning(t *testing.T) {
	plan := lifecyclePlan()
	market := &memoryLifecycleMarket{jobs: map[[32]byte]JobSnapshot{}}

	ingressID := CanonicalJobID(plan.StreamID, "ingress")
	market.jobs[ingressID] = JobSnapshot{JobID: ingressID, OperatorID: b32(11), Status: LifecycleVerified, OutputRef: b32(51)}

	first := plan.Jobs[1]
	firstID := CanonicalJobID(plan.StreamID, first.ID)
	market.jobs[firstID] = JobSnapshot{JobID: firstID, OperatorID: first.OperatorID, Status: LifecycleVerified, OutputRef: b32(61)}

	second := plan.Jobs[2]
	secondID := CanonicalJobID(plan.StreamID, second.ID)
	market.jobs[secondID] = JobSnapshot{JobID: secondID, OperatorID: second.OperatorID, Status: LifecycleRunning}

	ready, err := NewLifecycleCoordinator(market).Ready(context.Background(), plan)
	if err != nil { t.Fatal(err) }
	for _, node := range ready {
		if node.Role == RoleRelay {
			t.Fatal("relay became ready before every rendition completed")
		}
	}
}
