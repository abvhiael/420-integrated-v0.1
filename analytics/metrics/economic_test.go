package metrics

import (
	"math"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/analytics/architecture"
	"github.com/420integrated/420-integrated/analytics/model"
)

func treasuryTestProvenance() model.Provenance {
	return model.Provenance{
		Source:          string(architecture.SourceIndexer),
		ChainID:         420,
		IndexedHeight:   100,
		IndexedHeadHash: "0xabc",
		SafeHeight:      98,
		IndexedAt:       time.Unix(2_000_000_000, 0).UTC(),
	}
}

func metricValueByID(t *testing.T, metrics []model.Metric, id string) string {
	t.Helper()
	for _, metric := range metrics {
		if metric.ID == id {
			return metric.Value
		}
	}
	t.Fatalf("metric %s not found", id)
	return ""
}

func TestBuildTreasuryEconomicMetrics(t *testing.T) {
	provenance := treasuryTestProvenance()
	metrics, err := BuildTreasuryEconomicMetrics(TreasuryEconomicInput{
		Source: string(architecture.SourceIndexer),
		Budgets: []TreasuryBudgetProjection{
			{ChainID: 420, BlockNumber: 95, BudgetID: "budget-a", SpendingCeiling: 1000, Committed: 600, Executed: 250},
			{ChainID: 420, BlockNumber: 96, BudgetID: "budget-b", SpendingCeiling: 500, Committed: 200, Executed: 100},
		},
		Disbursements: []TreasuryDisbursementProjection{
			{ChainID: 420, BlockNumber: 97, DisbursementID: "d-1", Amount: 125, State: TreasuryDisbursementScheduled},
			{ChainID: 420, BlockNumber: 98, DisbursementID: "d-2", Amount: 350, State: TreasuryDisbursementExecuted},
			{ChainID: 420, BlockNumber: 99, DisbursementID: "d-3", Amount: 50, State: TreasuryDisbursementCancelled},
		},
	}, provenance)
	if err != nil {
		t.Fatalf("BuildTreasuryEconomicMetrics() error = %v", err)
	}
	if got := len(metrics); got != 5 {
		t.Fatalf("metric count = %d, want 5", got)
	}
	if got := metricValueByID(t, metrics, MetricTreasuryBudgetCeiling); got != "1500" {
		t.Fatalf("budget ceiling = %s, want 1500", got)
	}
	if got := metricValueByID(t, metrics, MetricTreasuryCommitted); got != "800" {
		t.Fatalf("committed = %s, want 800", got)
	}
	if got := metricValueByID(t, metrics, MetricTreasuryExecuted); got != "350" {
		t.Fatalf("executed = %s, want 350", got)
	}
	if got := metricValueByID(t, metrics, MetricTreasuryScheduledDisbursement); got != "125" {
		t.Fatalf("scheduled volume = %s, want 125", got)
	}
	if got := metricValueByID(t, metrics, MetricTreasuryExecutedDisbursement); got != "350" {
		t.Fatalf("executed disbursement volume = %s, want 350", got)
	}
	for _, metric := range metrics {
		if metric.Class != architecture.MetricEconomic {
			t.Fatalf("metric %s class = %s, want economic", metric.ID, metric.Class)
		}
		if metric.Canonical {
			t.Fatalf("metric %s unexpectedly canonical", metric.ID)
		}
		if metric.Provenance != provenance {
			t.Fatalf("metric %s provenance mismatch", metric.ID)
		}
	}
}

func TestTreasuryEconomicMetricsRejectNonIndexerSource(t *testing.T) {
	_, err := BuildTreasuryEconomicMetrics(TreasuryEconomicInput{
		Source: "node420",
		Budgets: []TreasuryBudgetProjection{{ChainID: 420, BlockNumber: 90, BudgetID: "b", SpendingCeiling: 1}},
	}, treasuryTestProvenance())
	if err == nil {
		t.Fatal("expected non-indexer source rejection")
	}
}

func TestTreasuryEconomicMetricsRejectEmptyProjectionSet(t *testing.T) {
	_, err := BuildTreasuryEconomicMetrics(TreasuryEconomicInput{Source: string(architecture.SourceIndexer)}, treasuryTestProvenance())
	if err == nil {
		t.Fatal("expected empty projection rejection")
	}
}

func TestTreasuryEconomicMetricsRejectBudgetInvariantViolation(t *testing.T) {
	_, err := BuildTreasuryEconomicMetrics(TreasuryEconomicInput{
		Source: string(architecture.SourceIndexer),
		Budgets: []TreasuryBudgetProjection{{ChainID: 420, BlockNumber: 90, BudgetID: "b", SpendingCeiling: 100, Committed: 101, Executed: 50}},
	}, treasuryTestProvenance())
	if err == nil {
		t.Fatal("expected budget accounting invariant rejection")
	}
}

func TestTreasuryEconomicMetricsRejectDuplicateBudgetCaseInsensitive(t *testing.T) {
	_, err := BuildTreasuryEconomicMetrics(TreasuryEconomicInput{
		Source: string(architecture.SourceIndexer),
		Budgets: []TreasuryBudgetProjection{
			{ChainID: 420, BlockNumber: 90, BudgetID: "BUDGET-A", SpendingCeiling: 100},
			{ChainID: 420, BlockNumber: 91, BudgetID: "budget-a", SpendingCeiling: 100},
		},
	}, treasuryTestProvenance())
	if err == nil {
		t.Fatal("expected duplicate budget rejection")
	}
}

func TestTreasuryEconomicMetricsRejectDuplicateDisbursementCaseInsensitive(t *testing.T) {
	_, err := BuildTreasuryEconomicMetrics(TreasuryEconomicInput{
		Source: string(architecture.SourceIndexer),
		Disbursements: []TreasuryDisbursementProjection{
			{ChainID: 420, BlockNumber: 90, DisbursementID: "D-1", Amount: 1, State: TreasuryDisbursementScheduled},
			{ChainID: 420, BlockNumber: 91, DisbursementID: "d-1", Amount: 1, State: TreasuryDisbursementExecuted},
		},
	}, treasuryTestProvenance())
	if err == nil {
		t.Fatal("expected duplicate disbursement rejection")
	}
}

func TestTreasuryEconomicMetricsRejectUnknownDisbursementState(t *testing.T) {
	_, err := BuildTreasuryEconomicMetrics(TreasuryEconomicInput{
		Source: string(architecture.SourceIndexer),
		Disbursements: []TreasuryDisbursementProjection{{ChainID: 420, BlockNumber: 90, DisbursementID: "d", Amount: 1, State: "pending"}},
	}, treasuryTestProvenance())
	if err == nil {
		t.Fatal("expected unknown state rejection")
	}
}

func TestTreasuryEconomicMetricsRejectProjectionPastIndexedHeight(t *testing.T) {
	_, err := BuildTreasuryEconomicMetrics(TreasuryEconomicInput{
		Source: string(architecture.SourceIndexer),
		Budgets: []TreasuryBudgetProjection{{ChainID: 420, BlockNumber: 101, BudgetID: "b", SpendingCeiling: 1}},
	}, treasuryTestProvenance())
	if err == nil {
		t.Fatal("expected indexed-height rejection")
	}
}

func TestTreasuryEconomicMetricsRejectOverflow(t *testing.T) {
	_, err := BuildTreasuryEconomicMetrics(TreasuryEconomicInput{
		Source: string(architecture.SourceIndexer),
		Budgets: []TreasuryBudgetProjection{
			{ChainID: 420, BlockNumber: 90, BudgetID: "a", SpendingCeiling: math.MaxUint64},
			{ChainID: 420, BlockNumber: 91, BudgetID: "b", SpendingCeiling: 1},
		},
	}, treasuryTestProvenance())
	if err == nil {
		t.Fatal("expected overflow rejection")
	}
}
