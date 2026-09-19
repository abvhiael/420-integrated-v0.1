package orchestration

import (
	"context"
	"errors"

	"github.com/420integrated/420-integrated/media/discovery"
)

var (
	ErrRecoveryExhausted = errors.New("420media orchestration: recovery exhausted")
	ErrInvalidRecovery   = errors.New("420media orchestration: invalid recovery request")
)

type RecoveryPolicy struct {
	MaxAttempts uint32
}

type RecoveryRequest struct {
	Node             JobNode
	Selection        discovery.Request
	FailedOperatorID [32]byte
	Occupied         map[[32]byte]struct{}
	Attempted        map[[32]byte]struct{}
	Attempt          uint32
}

type RecoveryDecision struct {
	NodeID             string
	PreviousOperatorID [32]byte
	Replacement        discovery.Selection
	Attempt            uint32
}

type RecoverySelector interface {
	Select(context.Context, discovery.Request) ([]discovery.Selection, error)
}

type RecoveryPlanner struct {
	selector RecoverySelector
	policy   RecoveryPolicy
}

func NewRecoveryPlanner(selector RecoverySelector, policy RecoveryPolicy) *RecoveryPlanner {
	if policy.MaxAttempts == 0 {
		policy.MaxAttempts = 3
	}
	return &RecoveryPlanner{selector: selector, policy: policy}
}

func (p *RecoveryPlanner) SelectReplacement(ctx context.Context, req RecoveryRequest) (RecoveryDecision, error) {
	if p == nil || p.selector == nil || req.Node.ID == "" || req.Node.OperatorID == ([32]byte{}) || req.FailedOperatorID == ([32]byte{}) || req.Selection.CapabilityID == ([32]byte{}) {
		return RecoveryDecision{}, ErrInvalidRecovery
	}
	if req.Attempt >= p.policy.MaxAttempts {
		return RecoveryDecision{}, ErrRecoveryExhausted
	}

	selectionReq := req.Selection
	selectionReq.Limit = 0
	candidates, err := p.selector.Select(ctx, selectionReq)
	if err != nil {
		if errors.Is(err, discovery.ErrNoProviders) {
			return RecoveryDecision{}, ErrRecoveryExhausted
		}
		return RecoveryDecision{}, err
	}

	for _, candidate := range candidates {
		id := candidate.Provider.OperatorID
		if id == req.FailedOperatorID || id == req.Node.OperatorID {
			continue
		}
		if _, blocked := req.Occupied[id]; blocked {
			continue
		}
		if _, tried := req.Attempted[id]; tried {
			continue
		}
		return RecoveryDecision{
			NodeID: req.Node.ID,
			PreviousOperatorID: req.Node.OperatorID,
			Replacement: candidate,
			Attempt: req.Attempt + 1,
		}, nil
	}
	return RecoveryDecision{}, ErrRecoveryExhausted
}

func ApplyRecovery(plan Plan, decision RecoveryDecision) (Plan, error) {
	if decision.NodeID == "" || decision.PreviousOperatorID == ([32]byte{}) || decision.Replacement.Provider.OperatorID == ([32]byte{}) {
		return Plan{}, ErrInvalidRecovery
	}
	updated := plan
	updated.Assignments = append([]Assignment(nil), plan.Assignments...)
	updated.Jobs = append([]JobNode(nil), plan.Jobs...)

	foundJob := false
	for i := range updated.Jobs {
		if updated.Jobs[i].ID != decision.NodeID {
			continue
		}
		if updated.Jobs[i].OperatorID != decision.PreviousOperatorID {
			return Plan{}, ErrInvalidRecovery
		}
		updated.Jobs[i].OperatorID = decision.Replacement.Provider.OperatorID
		foundJob = true
	}
	if !foundJob {
		return Plan{}, ErrInvalidRecovery
	}

	foundAssignment := false
	for i := range updated.Assignments {
		if updated.Assignments[i].OperatorID == decision.PreviousOperatorID {
			updated.Assignments[i].OperatorID = decision.Replacement.Provider.OperatorID
			foundAssignment = true
			break
		}
	}
	if !foundAssignment {
		return Plan{}, ErrInvalidRecovery
	}
	return updated, nil
}
