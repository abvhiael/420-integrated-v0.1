package orchestration

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"sort"
	"time"
)

var (
	ErrInvalidLifecycle     = errors.New("420media orchestration: invalid lifecycle state")
	ErrDependencyFailed     = errors.New("420media orchestration: dependency failed")
	ErrLifecycleJobNotFound = errors.New("420media orchestration: lifecycle job not found")
)

type LifecycleStatus string

const (
	LifecyclePlanned         LifecycleStatus = "planned"
	LifecycleCreated         LifecycleStatus = "created"
	LifecycleAccepted        LifecycleStatus = "accepted"
	LifecycleFunded          LifecycleStatus = "funded"
	LifecycleRunning         LifecycleStatus = "running"
	LifecycleResultCommitted LifecycleStatus = "result_committed"
	LifecycleVerified        LifecycleStatus = "verified"
	LifecycleSettled         LifecycleStatus = "settled"
	LifecycleFailed          LifecycleStatus = "failed"
	LifecycleCancelled       LifecycleStatus = "cancelled"
	LifecycleExpired         LifecycleStatus = "expired"
	LifecycleRefunded        LifecycleStatus = "refunded"
)

func (s LifecycleStatus) terminalSuccess() bool {
	return s == LifecycleVerified || s == LifecycleSettled
}

func (s LifecycleStatus) terminalFailure() bool {
	switch s {
	case LifecycleFailed, LifecycleCancelled, LifecycleExpired, LifecycleRefunded:
		return true
	default:
		return false
	}
}

type JobSpec struct {
	JobID        [32]byte
	StreamID     [32]byte
	NodeID       string
	Role         Role
	OperatorID   [32]byte
	CapabilityID [32]byte
	JobKind      [32]byte
	SLAID        [32]byte
	InputRef     [32]byte
	MaxSpend     uint64
	Deadline     time.Time
}

type JobSnapshot struct {
	JobID      [32]byte
	OperatorID [32]byte
	Status     LifecycleStatus
	OutputRef  [32]byte
}

// LifecycleMarket is requester-facing only. Operator acceptance, execution and result
// commitment remain with the assigned operator runtime; funding remains with settlement.
type LifecycleMarket interface {
	CreateJob(ctx context.Context, spec JobSpec) error
	Snapshot(ctx context.Context, jobID [32]byte) (JobSnapshot, error)
}

type LifecycleConfig struct {
	Capabilities CapabilitySet
	JobKinds      map[Role][32]byte
	SLAID         [32]byte
	MaxSpend      map[Role]uint64
	Deadline      time.Time
	RootInputRef  [32]byte
}

type LifecycleCoordinator struct {
	market LifecycleMarket
}

func NewLifecycleCoordinator(market LifecycleMarket) *LifecycleCoordinator {
	return &LifecycleCoordinator{market: market}
}

// Ready returns graph nodes that may be created now. Only an explicit
// ErrLifecycleJobNotFound means a node does not yet exist. All other snapshot errors
// fail closed so an RPC outage cannot be mistaken for job absence.
func (c *LifecycleCoordinator) Ready(ctx context.Context, plan Plan) ([]JobNode, error) {
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
			depJobID := CanonicalJobID(plan.StreamID, dep.ID)
			depSnap, err := c.market.Snapshot(ctx, depJobID)
			if err != nil {
				if errors.Is(err, ErrLifecycleJobNotFound) {
					depsReady = false
					break
				}
				return nil, err
			}
			if depSnap.JobID != depJobID || depSnap.OperatorID != dep.OperatorID {
				return nil, ErrInvalidLifecycle
			}
			if depSnap.Status.terminalFailure() {
				return nil, ErrDependencyFailed
			}
			if !depSnap.Status.terminalSuccess() {
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

// CreateReady creates every currently-ready job using deterministic canonical IDs.
// It never accepts, funds or runs jobs on behalf of operators or settlement.
func (c *LifecycleCoordinator) CreateReady(ctx context.Context, plan Plan, cfg LifecycleConfig) ([][32]byte, error) {
	if err := validateLifecycleConfig(plan, cfg); err != nil {
		return nil, err
	}
	ready, err := c.Ready(ctx, plan)
	if err != nil {
		return nil, err
	}
	created := make([][32]byte, 0, len(ready))
	for _, n := range ready {
		inputRef, err := inputRefFor(ctx, c.market, plan, n, cfg.RootInputRef)
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

func CanonicalJobID(streamID [32]byte, nodeID string) [32]byte {
	buf := make([]byte, 0, len(streamID)+len(nodeID)+18)
	buf = append(buf, []byte("420MEDIA_ORCH_V1")...)
	buf = append(buf, streamID[:]...)
	buf = append(buf, []byte(nodeID)...)
	return sha256.Sum256(buf)
}

func capabilityFor(role Role, caps CapabilitySet) [32]byte {
	switch role {
	case RoleIngress:
		return caps.Ingress
	case RoleTranscoder:
		return caps.Transcoder
	case RoleRelay:
		return caps.Relay
	default:
		return [32]byte{}
	}
}

func validateLifecycleConfig(plan Plan, cfg LifecycleConfig) error {
	if err := Validate(plan); err != nil {
		return err
	}
	if cfg.RootInputRef == ([32]byte{}) || cfg.Deadline.IsZero() || !cfg.Deadline.After(time.Now()) {
		return ErrInvalidLifecycle
	}
	for _, n := range plan.Jobs {
		if capabilityFor(n.Role, cfg.Capabilities) == ([32]byte{}) || cfg.JobKinds[n.Role] == ([32]byte{}) || cfg.MaxSpend[n.Role] == 0 {
			return ErrInvalidLifecycle
		}
	}
	return nil
}

func inputRefFor(ctx context.Context, market LifecycleMarket, plan Plan, node JobNode, root [32]byte) ([32]byte, error) {
	if len(node.DependsOn) == 0 {
		return root, nil
	}
	if len(node.DependsOn) == 1 {
		snap, err := market.Snapshot(ctx, CanonicalJobID(plan.StreamID, node.DependsOn[0]))
		if err != nil {
			return [32]byte{}, err
		}
		if !snap.Status.terminalSuccess() || snap.OutputRef == ([32]byte{}) {
			return [32]byte{}, ErrInvalidLifecycle
		}
		return snap.OutputRef, nil
	}
	// Multi-parent relay inputs are committed as a deterministic manifest reference,
	// avoiding raw media refs in orchestration state while binding every parent output.
	parents := append([]string(nil), node.DependsOn...)
	sort.Strings(parents)
	h := sha256.New()
	h.Write([]byte("420MEDIA_INPUT_MANIFEST_V1"))
	for _, depID := range parents {
		snap, err := market.Snapshot(ctx, CanonicalJobID(plan.StreamID, depID))
		if err != nil {
			return [32]byte{}, err
		}
		if !snap.Status.terminalSuccess() || snap.OutputRef == ([32]byte{}) {
			return [32]byte{}, ErrInvalidLifecycle
		}
		h.Write([]byte(fmt.Sprintf("%s:", depID)))
		h.Write(snap.OutputRef[:])
	}
	var out [32]byte
	copy(out[:], h.Sum(nil))
	return out, nil
}
