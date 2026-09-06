package orchestration

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
)

// RecoveryJobID derives an attempt-scoped job identity without overwriting the
// original canonical node job. Attempt zero is invalid and reserved for the
// Phase 3.2 canonical job identity.
func RecoveryJobID(streamID [32]byte, nodeID string, attempt uint32) [32]byte {
	if streamID == ([32]byte{}) || nodeID == "" || attempt == 0 {
		return [32]byte{}
	}
	buf := make([]byte, 0, len(streamID)+len(nodeID)+24)
	buf = append(buf, []byte("420MEDIA_RECOVERY_V1")...)
	buf = append(buf, streamID[:]...)
	buf = append(buf, []byte(nodeID)...)
	var n [4]byte
	binary.BigEndian.PutUint32(n[:], attempt)
	buf = append(buf, n[:]...)
	return sha256.Sum256(buf)
}

// CreateRecoveryAttempt creates a new requester-side job for one failed DAG node.
// The original canonical job remains immutable history. Operator execution and
// settlement authority remain outside the coordinator, exactly as in Phase 3.2.
func (c *LifecycleCoordinator) CreateRecoveryAttempt(
	ctx context.Context,
	plan Plan,
	nodeID string,
	decision RecoveryDecision,
	cfg LifecycleConfig,
) ([32]byte, error) {
	var zero [32]byte
	if c == nil || c.market == nil || decision.Attempt == 0 || decision.NodeID != nodeID {
		return zero, ErrInvalidRecovery
	}
	if err := validateLifecycleConfig(plan, cfg); err != nil {
		return zero, err
	}

	var node JobNode
	found := false
	for _, n := range plan.Jobs {
		if n.ID == nodeID {
			node = n
			found = true
			break
		}
	}
	if !found || node.OperatorID != decision.PreviousOperatorID || decision.Replacement.Provider.OperatorID == ([32]byte{}) {
		return zero, ErrInvalidRecovery
	}

	originalID := CanonicalJobID(plan.StreamID, node.ID)
	original, err := c.market.Snapshot(ctx, originalID)
	if err != nil {
		return zero, err
	}
	if original.JobID != originalID || original.OperatorID != node.OperatorID || !original.Status.terminalFailure() {
		return zero, ErrInvalidRecovery
	}

	jobID := RecoveryJobID(plan.StreamID, node.ID, decision.Attempt)
	if jobID == zero || jobID == originalID {
		return zero, ErrInvalidRecovery
	}
	if snap, err := c.market.Snapshot(ctx, jobID); err == nil {
		if snap.JobID != jobID || snap.OperatorID != decision.Replacement.Provider.OperatorID {
			return zero, ErrInvalidRecovery
		}
		return jobID, nil
	} else if err != ErrLifecycleJobNotFound {
		return zero, err
	}

	inputRef, err := inputRefFor(ctx, c.market, plan, node, cfg.RootInputRef)
	if err != nil {
		return zero, err
	}
	spec := JobSpec{
		JobID: jobID,
		StreamID: plan.StreamID,
		NodeID: node.ID,
		Role: node.Role,
		OperatorID: decision.Replacement.Provider.OperatorID,
		CapabilityID: capabilityFor(node.Role, cfg.Capabilities),
		JobKind: cfg.JobKinds[node.Role],
		SLAID: cfg.SLAID,
		InputRef: inputRef,
		MaxSpend: cfg.MaxSpend[node.Role],
		Deadline: cfg.Deadline,
	}
	if err := c.market.CreateJob(ctx, spec); err != nil {
		return zero, err
	}
	return jobID, nil
}
