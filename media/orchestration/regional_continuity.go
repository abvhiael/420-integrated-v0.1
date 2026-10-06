package orchestration

import (
	"context"
	"sort"
)

// RecoveryBindingsFromRegionalPlan validates that a coordinated regional recovery
// plan covers the complete outage set exactly once and converts it into the bindings
// consumed by the qualified Phase 3.3C dependency-resolution path.
func RecoveryBindingsFromRegionalPlan(
	plan Plan,
	snapshot FailureDomainSnapshot,
	regional RegionalRecoveryPlan,
) (RecoveryBindings, error) {
	if err := Validate(plan); err != nil {
		return nil, err
	}
	if snapshot.FailedGeography == "" || regional.FailedGeography == "" || regional.FailedGeography != snapshot.FailedGeography || len(snapshot.AffectedNodeIDs) == 0 {
		return nil, ErrInvalidFailureDomain
	}
	if len(regional.Decisions) != len(snapshot.AffectedNodeIDs) {
		return nil, ErrRegionalRecoveryIncomplete
	}

	jobs := make(map[string]JobNode, len(plan.Jobs))
	for _, job := range plan.Jobs {
		jobs[job.ID] = job
	}
	affected := make(map[string]struct{}, len(snapshot.AffectedNodeIDs))
	for _, nodeID := range snapshot.AffectedNodeIDs {
		if _, duplicate := affected[nodeID]; duplicate {
			return nil, ErrInvalidFailureDomain
		}
		if _, ok := jobs[nodeID]; !ok {
			return nil, ErrInvalidFailureDomain
		}
		affected[nodeID] = struct{}{}
	}

	bindings := make(RecoveryBindings, len(regional.Decisions))
	operators := make(map[[32]byte]struct{}, len(regional.Decisions))
	for _, decision := range regional.Decisions {
		job, ok := jobs[decision.NodeID]
		if !ok {
			return nil, ErrInvalidRecovery
		}
		if _, ok := affected[decision.NodeID]; !ok {
			return nil, ErrInvalidRecovery
		}
		if _, duplicate := bindings[decision.NodeID]; duplicate {
			return nil, ErrInvalidRecovery
		}
		if decision.PreviousOperatorID != job.OperatorID || decision.Attempt == 0 || decision.Replacement.Provider.OperatorID == ([32]byte{}) || decision.Replacement.Provider.Geography == "" || decision.Replacement.Provider.Geography == snapshot.FailedGeography {
			return nil, ErrInvalidRecovery
		}
		if _, collision := operators[decision.Replacement.Provider.OperatorID]; collision {
			return nil, ErrInvalidRecovery
		}
		operators[decision.Replacement.Provider.OperatorID] = struct{}{}
		bindings[decision.NodeID] = decision
	}
	for nodeID := range affected {
		if _, ok := bindings[nodeID]; !ok {
			return nil, ErrRegionalRecoveryIncomplete
		}
	}
	return bindings, nil
}

// CreateReadyWithRegionalRecovery proves the Phase 3.4 regional recovery batch at the
// orchestration boundary, then reuses Phase 3.3C's canonical dependency resolution.
// Healthy remote dependencies therefore remain canonical while terminal-failed
// dependencies are substituted only by their explicitly-bound successful recovery
// outputs. The downstream relay job ID remains canonical and its manifest remains
// deterministic because inputRefWithRecovery sorts dependency IDs.
func (c *LifecycleCoordinator) CreateReadyWithRegionalRecovery(
	ctx context.Context,
	plan Plan,
	cfg LifecycleConfig,
	snapshot FailureDomainSnapshot,
	regional RegionalRecoveryPlan,
) ([][32]byte, error) {
	bindings, err := RecoveryBindingsFromRegionalPlan(plan, snapshot, regional)
	if err != nil {
		return nil, err
	}
	return c.CreateReadyWithRecovery(ctx, plan, cfg, bindings)
}

// OrderedRegionalRecoveryNodeIDs returns the validated outage node order used for
// deterministic qualification and execution bookkeeping.
func OrderedRegionalRecoveryNodeIDs(snapshot FailureDomainSnapshot) ([]string, error) {
	if snapshot.FailedGeography == "" || len(snapshot.AffectedNodeIDs) == 0 {
		return nil, ErrInvalidFailureDomain
	}
	ids := append([]string(nil), snapshot.AffectedNodeIDs...)
	sort.Strings(ids)
	for i := 1; i < len(ids); i++ {
		if ids[i] == ids[i-1] {
			return nil, ErrInvalidFailureDomain
		}
	}
	return ids, nil
}
