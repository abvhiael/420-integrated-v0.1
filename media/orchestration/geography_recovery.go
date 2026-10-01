package orchestration

import (
	"context"
	"errors"

	"github.com/420integrated/420-integrated/media/discovery"
)

var ErrInvalidFailureDomain = errors.New("420media orchestration: invalid failure domain")

// GeographyRecoveryPolicy controls how recovery spreads work across geographic
// failure domains. A replacement is never allowed back into the failed geography.
// PreferDistinctOccupiedGeographies first avoids geographies already serving the
// stream; RequireDistinctOccupiedGeographies makes that diversity requirement hard.
type GeographyRecoveryPolicy struct {
	PreferDistinctOccupiedGeographies  bool
	RequireDistinctOccupiedGeographies bool
}

type GeographyRecoveryRequest struct {
	RecoveryRequest
	FailedGeography     string
	OccupiedGeographies map[string]struct{}
}

// SelectGeographicReplacement preserves all Phase 3.3 operator/attempt exclusions,
// while adding a failure-domain boundary. Discovery ranking remains authoritative:
// this function only removes candidates that violate the resilience policy and
// returns the highest-ranked remaining candidate.
func (p *RecoveryPlanner) SelectGeographicReplacement(
	ctx context.Context,
	req GeographyRecoveryRequest,
	policy GeographyRecoveryPolicy,
) (RecoveryDecision, error) {
	if p == nil || p.selector == nil || req.Node.ID == "" || req.Node.OperatorID == ([32]byte{}) || req.FailedOperatorID == ([32]byte{}) || req.Selection.CapabilityID == ([32]byte{}) {
		return RecoveryDecision{}, ErrInvalidRecovery
	}
	if req.FailedGeography == "" {
		return RecoveryDecision{}, ErrInvalidFailureDomain
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

	eligible := func(candidate discovery.Selection, requireFreshGeography bool) bool {
		id := candidate.Provider.OperatorID
		if id == ([32]byte{}) || id == req.FailedOperatorID || id == req.Node.OperatorID {
			return false
		}
		if _, blocked := req.Occupied[id]; blocked {
			return false
		}
		if _, tried := req.Attempted[id]; tried {
			return false
		}
		geo := candidate.Provider.Geography
		if geo == "" || geo == req.FailedGeography {
			return false
		}
		if requireFreshGeography {
			if _, occupied := req.OccupiedGeographies[geo]; occupied {
				return false
			}
		}
		return true
	}

	choose := func(requireFreshGeography bool) (RecoveryDecision, bool) {
		for _, candidate := range candidates {
			if !eligible(candidate, requireFreshGeography) {
				continue
			}
			return RecoveryDecision{
				NodeID:             req.Node.ID,
				PreviousOperatorID: req.Node.OperatorID,
				Replacement:        candidate,
				Attempt:            req.Attempt + 1,
			}, true
		}
		return RecoveryDecision{}, false
	}

	if policy.PreferDistinctOccupiedGeographies || policy.RequireDistinctOccupiedGeographies {
		if decision, ok := choose(true); ok {
			return decision, nil
		}
		if policy.RequireDistinctOccupiedGeographies {
			return RecoveryDecision{}, ErrRecoveryExhausted
		}
	}
	if decision, ok := choose(false); ok {
		return decision, nil
	}
	return RecoveryDecision{}, ErrRecoveryExhausted
}
