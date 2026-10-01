package orchestration

import (
	"context"
	"errors"
	"sort"
)

var ErrRegionalRecoveryIncomplete = errors.New("420media orchestration: regional recovery incomplete")

// RegionalRecoveryPolicy controls coordinated recovery of every DAG node affected by
// one geographic failure domain. Replacement operators are always unique. By default,
// replacement geographies are also unique inside the batch so one regional outage is
// not collapsed into another single failure domain.
type RegionalRecoveryPolicy struct {
	Geography GeographyRecoveryPolicy
	AllowSharedReplacementGeography bool
}

// RegionalRecoveryPlan contains one deterministic recovery decision for every affected
// DAG node. Decisions are ordered by node ID so the same outage snapshot and discovery
// state produce the same batch result.
type RegionalRecoveryPlan struct {
	FailedGeography string
	Decisions       []RecoveryDecision
}

// PlanRegionalRecovery coordinates replacement selection across all nodes in the
// failure-domain snapshot. No partial plan is returned: if any affected node cannot be
// assigned without violating operator, geography, attempt or discovery constraints,
// the entire batch fails closed.
func (p *RecoveryPlanner) PlanRegionalRecovery(
	ctx context.Context,
	snapshot FailureDomainSnapshot,
	requests map[string]RecoveryRequest,
	policy RegionalRecoveryPolicy,
) (RegionalRecoveryPlan, error) {
	if p == nil || p.selector == nil || snapshot.FailedGeography == "" || len(snapshot.AffectedNodeIDs) == 0 {
		return RegionalRecoveryPlan{}, ErrInvalidFailureDomain
	}

	affected := append([]string(nil), snapshot.AffectedNodeIDs...)
	sort.Strings(affected)

	occupiedOperators := cloneOperatorSet(snapshot.OccupiedOperators)
	occupiedGeographies := cloneGeographySet(snapshot.OccupiedGeographies)
	selectedGeographies := make(map[string]struct{}, len(affected))
	decisions := make([]RecoveryDecision, 0, len(affected))

	for _, nodeID := range affected {
		base, ok := requests[nodeID]
		if !ok || base.Node.ID != nodeID {
			return RegionalRecoveryPlan{}, ErrRegionalRecoveryIncomplete
		}

		base.Occupied = mergeOperatorSets(base.Occupied, occupiedOperators)
		geoReq, err := GeographicRecoveryRequestFromSnapshot(base, snapshot)
		if err != nil {
			return RegionalRecoveryPlan{}, err
		}
		geoReq.Occupied = mergeOperatorSets(geoReq.Occupied, occupiedOperators)
		geoReq.OccupiedGeographies = cloneGeographySet(occupiedGeographies)
		if !policy.AllowSharedReplacementGeography {
			for geography := range selectedGeographies {
				geoReq.OccupiedGeographies[geography] = struct{}{}
			}
		}

		geoPolicy := policy.Geography
		if !policy.AllowSharedReplacementGeography {
			geoPolicy.RequireDistinctOccupiedGeographies = true
			geoPolicy.PreferDistinctOccupiedGeographies = true
		}

		decision, err := p.SelectGeographicReplacement(ctx, geoReq, geoPolicy)
		if err != nil {
			return RegionalRecoveryPlan{}, err
		}

		replacementID := decision.Replacement.Provider.OperatorID
		replacementGeo := decision.Replacement.Provider.Geography
		if replacementID == ([32]byte{}) || replacementGeo == "" || replacementGeo == snapshot.FailedGeography {
			return RegionalRecoveryPlan{}, ErrInvalidRecovery
		}
		if _, collision := occupiedOperators[replacementID]; collision {
			return RegionalRecoveryPlan{}, ErrInvalidRecovery
		}
		if !policy.AllowSharedReplacementGeography {
			if _, collision := selectedGeographies[replacementGeo]; collision {
				return RegionalRecoveryPlan{}, ErrInvalidFailureDomain
			}
		}

		decisions = append(decisions, decision)
		occupiedOperators[replacementID] = struct{}{}
		selectedGeographies[replacementGeo] = struct{}{}
		occupiedGeographies[replacementGeo] = struct{}{}
	}

	if len(decisions) != len(affected) {
		return RegionalRecoveryPlan{}, ErrRegionalRecoveryIncomplete
	}
	return RegionalRecoveryPlan{FailedGeography: snapshot.FailedGeography, Decisions: decisions}, nil
}

func cloneOperatorSet(src map[[32]byte]struct{}) map[[32]byte]struct{} {
	out := make(map[[32]byte]struct{}, len(src))
	for id := range src { out[id] = struct{}{} }
	return out
}

func cloneGeographySet(src map[string]struct{}) map[string]struct{} {
	out := make(map[string]struct{}, len(src))
	for geography := range src { out[geography] = struct{}{} }
	return out
}

func mergeOperatorSets(a, b map[[32]byte]struct{}) map[[32]byte]struct{} {
	out := make(map[[32]byte]struct{}, len(a)+len(b))
	for id := range a { out[id] = struct{}{} }
	for id := range b { out[id] = struct{}{} }
	return out
}
