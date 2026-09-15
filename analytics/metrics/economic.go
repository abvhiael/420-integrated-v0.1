package metrics

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/420integrated/420-integrated/analytics/architecture"
	"github.com/420integrated/420-integrated/analytics/model"
)

const (
	MetricTreasuryBudgetCeiling         = "economic.treasury_budget_ceiling"
	MetricTreasuryCommitted             = "economic.treasury_committed"
	MetricTreasuryExecuted              = "economic.treasury_executed"
	MetricTreasuryScheduledDisbursement = "economic.treasury_scheduled_disbursement_volume"
	MetricTreasuryExecutedDisbursement  = "economic.treasury_executed_disbursement_volume"
)

type TreasuryDisbursementState string

const (
	TreasuryDisbursementScheduled TreasuryDisbursementState = "scheduled"
	TreasuryDisbursementExecuted  TreasuryDisbursementState = "executed"
	TreasuryDisbursementCancelled TreasuryDisbursementState = "cancelled"
)

// TreasuryBudgetProjection is a normalized, public 420Indexer-derived Treasury
// budget view. It is not custody state; 420Vault remains the canonical custody
// and release authority for governed Treasury assets.
type TreasuryBudgetProjection struct {
	ChainID         uint64
	BlockNumber     uint64
	BudgetID        string
	SpendingCeiling uint64
	Committed       uint64
	Executed        uint64
}

// TreasuryDisbursementProjection is a normalized, public 420Indexer-derived
// Treasury disbursement view. Amount is expressed in the indexed asset's base
// units and is aggregated only across projections supplied for one compatible
// economic dataset.
type TreasuryDisbursementProjection struct {
	ChainID        uint64
	BlockNumber    uint64
	DisbursementID string
	Amount         uint64
	State          TreasuryDisbursementState
}

type TreasuryEconomicInput struct {
	Source        string
	Budgets       []TreasuryBudgetProjection
	Disbursements []TreasuryDisbursementProjection
}

func BuildTreasuryEconomicMetrics(input TreasuryEconomicInput, provenance model.Provenance) ([]model.Metric, error) {
	if input.Source != string(architecture.SourceIndexer) || provenance.Source != string(architecture.SourceIndexer) {
		return nil, errors.New("treasury analytics require qualified 420Indexer provenance")
	}
	if len(input.Budgets) == 0 && len(input.Disbursements) == 0 {
		return nil, errors.New("treasury analytics require indexed budget or disbursement projections")
	}

	budgetIDs := map[string]struct{}{}
	var ceiling, committed, executed uint64
	for i, budget := range input.Budgets {
		if err := validateProtocolCoordinates(budget.ChainID, budget.BlockNumber, provenance); err != nil {
			return nil, fmt.Errorf("budget %d: %w", i, err)
		}
		id := strings.ToLower(strings.TrimSpace(budget.BudgetID))
		if id == "" {
			return nil, fmt.Errorf("budget %d identity required", i)
		}
		if _, exists := budgetIDs[id]; exists {
			return nil, fmt.Errorf("duplicate treasury budget projection: %s", id)
		}
		budgetIDs[id] = struct{}{}
		if budget.Executed > budget.Committed || budget.Committed > budget.SpendingCeiling {
			return nil, fmt.Errorf("budget %s accounting invariant violated", id)
		}
		var overflow bool
		if ceiling, overflow = addUint64(ceiling, budget.SpendingCeiling); overflow {
			return nil, errors.New("treasury budget ceiling overflow")
		}
		if committed, overflow = addUint64(committed, budget.Committed); overflow {
			return nil, errors.New("treasury committed amount overflow")
		}
		if executed, overflow = addUint64(executed, budget.Executed); overflow {
			return nil, errors.New("treasury executed amount overflow")
		}
	}

	disbursementIDs := map[string]struct{}{}
	var scheduledVolume, executedVolume uint64
	for i, disbursement := range input.Disbursements {
		if err := validateProtocolCoordinates(disbursement.ChainID, disbursement.BlockNumber, provenance); err != nil {
			return nil, fmt.Errorf("disbursement %d: %w", i, err)
		}
		id := strings.ToLower(strings.TrimSpace(disbursement.DisbursementID))
		if id == "" {
			return nil, fmt.Errorf("disbursement %d identity required", i)
		}
		if _, exists := disbursementIDs[id]; exists {
			return nil, fmt.Errorf("duplicate treasury disbursement projection: %s", id)
		}
		disbursementIDs[id] = struct{}{}

		var overflow bool
		switch disbursement.State {
		case TreasuryDisbursementScheduled:
			if scheduledVolume, overflow = addUint64(scheduledVolume, disbursement.Amount); overflow {
				return nil, errors.New("scheduled treasury disbursement volume overflow")
			}
		case TreasuryDisbursementExecuted:
			if executedVolume, overflow = addUint64(executedVolume, disbursement.Amount); overflow {
				return nil, errors.New("executed treasury disbursement volume overflow")
			}
		case TreasuryDisbursementCancelled:
			// Cancelled disbursements are terminal audit records and do not count
			// toward current scheduled or executed volume.
		default:
			return nil, fmt.Errorf("disbursement %s state unsupported", id)
		}
	}

	defs := []struct {
		id, label, unit string
		value           uint64
	}{
		{MetricTreasuryBudgetCeiling, "Treasury budget ceiling", "base_units", ceiling},
		{MetricTreasuryCommitted, "Treasury committed", "base_units", committed},
		{MetricTreasuryExecuted, "Treasury executed", "base_units", executed},
		{MetricTreasuryScheduledDisbursement, "Scheduled Treasury disbursement volume", "base_units", scheduledVolume},
		{MetricTreasuryExecutedDisbursement, "Executed Treasury disbursement volume", "base_units", executedVolume},
	}

	out := make([]model.Metric, 0, len(defs))
	for _, def := range defs {
		method, err := registeredMethodology(def.id)
		if err != nil {
			return nil, err
		}
		metric, err := model.NewMetric(
			def.id,
			architecture.MetricEconomic,
			def.label,
			strconv.FormatUint(def.value, 10),
			def.unit,
			method,
			model.Window{Kind: model.WindowPoint},
			provenance,
		)
		if err != nil {
			return nil, fmt.Errorf("build %s: %w", def.id, err)
		}
		out = append(out, metric)
	}
	return out, nil
}
