package orchestration

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"crypto/sha256"
)

// RecoveryBindings identifies the authoritative recovery attempt, if any, for a
// canonically failed DAG node. Canonical success always wins; recovery is only
// consulted after the canonical dependency is proven terminal-failed.
type RecoveryBindings map[string]RecoveryDecision

// ReadyWithRecovery returns graph nodes whose dependencies are satisfied either
// by their canonical successful jobs or by explicitly-bound successful recovery
// attempts. It preserves Ready's fail-closed behavior and never treats a pending
// or missing recovery attempt as successful.
func (c *LifecycleCoordinator) ReadyWithRecovery(ctx context.Context, plan Plan, recoveries RecoveryBindings) ([]JobNode, error) {
	if c == nil || c.market == nil {
		return nil, ErrInvalidLifecycle
	}
	if err := Validate(plan); err != nil {
		return nil, err
	}
	byID := make(map[string]JobNode, len(plan.Jobs))
	for _, n := range plan.Jobs {
		byID[n.ID] = n
	}
	ready := make([]JobNode, 0)
	for _, n := range plan.Jobs {
		jobID := CanonicalJobID(plan.StreamID, n.ID)
		snap, err := c.market.Snapshot(ctx, jobID)
		if err == nil {
			if snap.JobID != jobID || snap.OperatorID != n.OperatorID {
				return nil, ErrInvalidLifecycle
			}
			continue
		}
		if !errors.Is(err, ErrLifecycleJobNotFound) {
			return nil, err
		}

		depsReady := true
		for _, depID := range n.DependsOn {
			dep, ok := byID[depID]
			if !ok {
				return nil, ErrInvalidGraph
			}
			depSnap, readyNow, err := c.resolvedDependency(ctx, plan, dep, recoveries)
			if err != nil {
				return nil, err
			}
			if !readyNow || depSnap.OutputRef == ([32]byte{}) {
				depsReady = false
				break
			}
		}
		if depsReady {
			ready = append(ready, n)
		}
	}
	sort.Slice(ready, func(i, j int) bool { return ready[i].ID < ready[j].ID })
	return ready, nil
}

// CreateReadyWithRecovery creates downstream canonical jobs while resolving
// dependency inputs through successful recovery attempts where required. The
// downstream job identity remains canonical; only its committed input reflects
// the successful replacement output.
func (c *LifecycleCoordinator) CreateReadyWithRecovery(ctx context.Context, plan Plan, cfg LifecycleConfig, recoveries RecoveryBindings) ([][32]byte, error) {
	if err := validateLifecycleConfig(plan, cfg); err != nil {
		return nil, err
	}
	ready, err := c.ReadyWithRecovery(ctx, plan, recoveries)
	if err != nil {
		return nil, err
	}
	created := make([][32]byte, 0, len(ready))
	for _, n := range ready {
		inputRef, err := c.inputRefWithRecovery(ctx, plan, n, cfg.RootInputRef, recoveries)
		if err != nil {
			return nil, err
		}
		spec := JobSpec{
			JobID: CanonicalJobID(plan.StreamID, n.ID),
			StreamID: plan.StreamID,
			NodeID: n.ID,
			Role: n.Role,
			OperatorID: n.OperatorID,
			CapabilityID: capabilityFor(n.Role, cfg.Capabilities),
			JobKind: cfg.JobKinds[n.Role],
			SLAID: cfg.SLAID,
			InputRef: inputRef,
			MaxSpend: cfg.MaxSpend[n.Role],
			Deadline: cfg.Deadline,
		}
		if err := c.market.CreateJob(ctx, spec); err != nil {
			return nil, err
		}
		created = append(created, spec.JobID)
	}
	return created, nil
}

func (c *LifecycleCoordinator) resolvedDependency(ctx context.Context, plan Plan, dep JobNode, recoveries RecoveryBindings) (JobSnapshot, bool, error) {
	canonicalID := CanonicalJobID(plan.StreamID, dep.ID)
	canonical, err := c.market.Snapshot(ctx, canonicalID)
	if err != nil {
		if errors.Is(err, ErrLifecycleJobNotFound) {
			return JobSnapshot{}, false, nil
		}
		return JobSnapshot{}, false, err
	}
	if canonical.JobID != canonicalID || canonical.OperatorID != dep.OperatorID {
		return JobSnapshot{}, false, ErrInvalidLifecycle
	}
	if canonical.Status.terminalSuccess() {
		return canonical, true, nil
	}
	if !canonical.Status.terminalFailure() {
		return canonical, false, nil
	}

	decision, ok := recoveries[dep.ID]
	if !ok {
		return JobSnapshot{}, false, ErrDependencyFailed
	}
	if decision.NodeID != dep.ID || decision.PreviousOperatorID != dep.OperatorID || decision.Attempt == 0 || decision.Replacement.Provider.OperatorID == ([32]byte{}) {
		return JobSnapshot{}, false, ErrInvalidRecovery
	}
	recoveryID := RecoveryJobID(plan.StreamID, dep.ID, decision.Attempt)
	recovery, err := c.market.Snapshot(ctx, recoveryID)
	if err != nil {
		if errors.Is(err, ErrLifecycleJobNotFound) {
			return JobSnapshot{}, false, nil
		}
		return JobSnapshot{}, false, err
	}
	if recovery.JobID != recoveryID || recovery.OperatorID != decision.Replacement.Provider.OperatorID {
		return JobSnapshot{}, false, ErrInvalidRecovery
	}
	if recovery.Status.terminalFailure() {
		return JobSnapshot{}, false, ErrDependencyFailed
	}
	if !recovery.Status.terminalSuccess() {
		return recovery, false, nil
	}
	return recovery, true, nil
}

func (c *LifecycleCoordinator) inputRefWithRecovery(ctx context.Context, plan Plan, node JobNode, root [32]byte, recoveries RecoveryBindings) ([32]byte, error) {
	if len(node.DependsOn) == 0 {
		return root, nil
	}
	byID := make(map[string]JobNode, len(plan.Jobs))
	for _, n := range plan.Jobs {
		byID[n.ID] = n
	}
	if len(node.DependsOn) == 1 {
		dep, ok := byID[node.DependsOn[0]]
		if !ok {
			return [32]byte{}, ErrInvalidGraph
		}
		snap, ready, err := c.resolvedDependency(ctx, plan, dep, recoveries)
		if err != nil {
			return [32]byte{}, err
		}
		if !ready || snap.OutputRef == ([32]byte{}) {
			return [32]byte{}, ErrInvalidLifecycle
		}
		return snap.OutputRef, nil
	}

	parents := append([]string(nil), node.DependsOn...)
	sort.Strings(parents)
	h := sha256.New()
	h.Write([]byte("420MEDIA_INPUT_MANIFEST_V1"))
	for _, depID := range parents {
		dep, ok := byID[depID]
		if !ok {
			return [32]byte{}, ErrInvalidGraph
		}
		snap, ready, err := c.resolvedDependency(ctx, plan, dep, recoveries)
		if err != nil {
			return [32]byte{}, err
		}
		if !ready || snap.OutputRef == ([32]byte{}) {
			return [32]byte{}, ErrInvalidLifecycle
		}
		h.Write([]byte(fmt.Sprintf("%s:", depID)))
		h.Write(snap.OutputRef[:])
	}
	var out [32]byte
	copy(out[:], h.Sum(nil))
	return out, nil
}
