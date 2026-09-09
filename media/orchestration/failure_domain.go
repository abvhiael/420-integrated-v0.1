package orchestration

import (
	"context"
	"errors"
	"sort"
)

var ErrFailureDomainLookup = errors.New("420media orchestration: failure domain lookup failed")

// GeographyResolver resolves the current service geography for an operator identity.
// Implementations should use the same canonical/revalidated service metadata boundary
// as Phase 3.1 discovery rather than trusting caller-supplied geography strings.
type GeographyResolver interface {
	Geography(ctx context.Context, operatorID [32]byte) (string, error)
}

// FailureDomainSnapshot is derived from the current orchestration DAG plus explicit
// recovery bindings. It describes the effective placement of stream work at the time
// a regional failure is evaluated.
type FailureDomainSnapshot struct {
	FailedGeography     string
	AffectedNodeIDs     []string
	OccupiedOperators   map[[32]byte]struct{}
	OccupiedGeographies map[string]struct{}
	NodeGeographies     map[string]string
}

// DeriveFailureDomainSnapshot derives regional outage scope from the graph instead of
// accepting occupied geographies from an external caller. For nodes with an explicit
// recovery binding, the replacement operator/geography is the effective placement.
// Missing or inconsistent geography metadata fails closed.
func DeriveFailureDomainSnapshot(
	ctx context.Context,
	plan Plan,
	failedNodeID string,
	recoveries RecoveryBindings,
	resolver GeographyResolver,
) (FailureDomainSnapshot, error) {
	if resolver == nil || failedNodeID == "" {
		return FailureDomainSnapshot{}, ErrInvalidFailureDomain
	}
	if err := Validate(plan); err != nil {
		return FailureDomainSnapshot{}, err
	}

	jobs := make(map[string]JobNode, len(plan.Jobs))
	for _, job := range plan.Jobs {
		jobs[job.ID] = job
	}
	failedNode, ok := jobs[failedNodeID]
	if !ok {
		return FailureDomainSnapshot{}, ErrInvalidFailureDomain
	}

	failedGeography, err := resolver.Geography(ctx, failedNode.OperatorID)
	if err != nil {
		return FailureDomainSnapshot{}, errors.Join(ErrFailureDomainLookup, err)
	}
	if failedGeography == "" {
		return FailureDomainSnapshot{}, ErrInvalidFailureDomain
	}

	snapshot := FailureDomainSnapshot{
		FailedGeography:     failedGeography,
		OccupiedOperators:   make(map[[32]byte]struct{}),
		OccupiedGeographies: make(map[string]struct{}),
		NodeGeographies:     make(map[string]string, len(plan.Jobs)),
	}

	for _, job := range plan.Jobs {
		effectiveOperator := job.OperatorID
		geography := ""

		if decision, bound := recoveries[job.ID]; bound && job.ID != failedNodeID {
			if decision.NodeID != job.ID || decision.PreviousOperatorID != job.OperatorID || decision.Attempt == 0 || decision.Replacement.Provider.OperatorID == ([32]byte{}) {
				return FailureDomainSnapshot{}, ErrInvalidRecovery
			}
			effectiveOperator = decision.Replacement.Provider.OperatorID
			geography = decision.Replacement.Provider.Geography
		}

		if geography == "" {
			geography, err = resolver.Geography(ctx, effectiveOperator)
			if err != nil {
				return FailureDomainSnapshot{}, errors.Join(ErrFailureDomainLookup, err)
			}
		}
		if geography == "" {
			return FailureDomainSnapshot{}, ErrInvalidFailureDomain
		}

		snapshot.NodeGeographies[job.ID] = geography
		if geography == failedGeography {
			snapshot.AffectedNodeIDs = append(snapshot.AffectedNodeIDs, job.ID)
			continue
		}
		snapshot.OccupiedOperators[effectiveOperator] = struct{}{}
		snapshot.OccupiedGeographies[geography] = struct{}{}
	}

	sort.Strings(snapshot.AffectedNodeIDs)
	if len(snapshot.AffectedNodeIDs) == 0 {
		return FailureDomainSnapshot{}, ErrInvalidFailureDomain
	}
	return snapshot, nil
}

// GeographicRecoveryRequestFromSnapshot converts an existing Phase 3.3 recovery
// request into the Phase 3.4 form using graph-derived failure-domain state.
func GeographicRecoveryRequestFromSnapshot(base RecoveryRequest, snapshot FailureDomainSnapshot) (GeographyRecoveryRequest, error) {
	if base.Node.ID == "" || base.Node.OperatorID == ([32]byte{}) || snapshot.FailedGeography == "" {
		return GeographyRecoveryRequest{}, ErrInvalidFailureDomain
	}
	affected := false
	for _, id := range snapshot.AffectedNodeIDs {
		if id == base.Node.ID {
			affected = true
			break
		}
	}
	if !affected {
		return GeographyRecoveryRequest{}, ErrInvalidFailureDomain
	}

	occupiedOperators := make(map[[32]byte]struct{}, len(snapshot.OccupiedOperators)+len(base.Occupied))
	for id := range snapshot.OccupiedOperators {
		occupiedOperators[id] = struct{}{}
	}
	for id := range base.Occupied {
		occupiedOperators[id] = struct{}{}
	}
	base.Occupied = occupiedOperators

	occupiedGeographies := make(map[string]struct{}, len(snapshot.OccupiedGeographies))
	for geography := range snapshot.OccupiedGeographies {
		occupiedGeographies[geography] = struct{}{}
	}

	return GeographyRecoveryRequest{
		RecoveryRequest:       base,
		FailedGeography:       snapshot.FailedGeography,
		OccupiedGeographies:   occupiedGeographies,
	}, nil
}
