package privacy_test

import (
	"testing"
	"time"

	"github.com/420integrated/420-integrated/analytics/architecture"
	"github.com/420integrated/420-integrated/analytics/cohorts"
	"github.com/420integrated/420-integrated/analytics/metrics"
	"github.com/420integrated/420-integrated/analytics/model"
	"github.com/420integrated/420-integrated/analytics/privacy"
)

func provenance() model.Provenance {
	return model.Provenance{
		Source:          string(architecture.SourceIndexer),
		ChainID:         420,
		IndexedHeight:   100,
		IndexedHeadHash: "0xabc",
		SafeHeight:      95,
		IndexedAt:       time.Date(2026, 9, 16, 0, 0, 0, 0, time.UTC),
	}
}

func TestFrozenPrivacyExclusionsRejectAdmission(t *testing.T) {
	for _, class := range privacy.Exclusions() {
		if err := privacy.Admit(string(class)); err == nil {
			t.Fatalf("expected protected class %s to be rejected", class)
		}
	}
	if err := privacy.Admit(""); err != nil {
		t.Fatalf("empty legacy classification should normalize to public: %v", err)
	}
	if err := privacy.Admit(string(privacy.Public)); err != nil {
		t.Fatalf("public classification rejected: %v", err)
	}
	if err := privacy.Admit("mystery_private_class"); err == nil {
		t.Fatal("unknown classification must fail closed")
	}
}

func TestProtectedMetricCannotEnterSnapshot(t *testing.T) {
	p := provenance()
	m, err := model.NewMetric("network.indexed_height", architecture.MetricNetwork, "Indexed height", "100", "blocks", model.Methodology{ID: "indexed-height", Version: "v1", Description: "test"}, model.Window{Kind: model.WindowPoint}, p)
	if err != nil {
		t.Fatal(err)
	}
	m.PrivacyClass = string(privacy.PrivateIdentity)
	if err := model.ValidateMetric(m); err == nil {
		t.Fatal("protected metric passed validation")
	}
	if _, err := model.NewSnapshot(time.Now().UTC(), p, []model.Metric{m}); err == nil {
		t.Fatal("protected metric entered snapshot")
	}
}

func TestProtectedProtocolProjectionRejectedBeforeAggregation(t *testing.T) {
	_, err := metrics.BuildProtocolMetrics(metrics.ProtocolInput{
		Source: string(architecture.SourceIndexer),
		Events: []metrics.ProtocolEventProjection{{
			ChainID: 420, BlockNumber: 90, TransactionHash: "0x1", LogIndex: 0,
			Protocol: "attention", EventName: "Viewed", PrivacyClass: string(privacy.RawAttentionTelemetry),
		}},
	}, provenance())
	if err == nil {
		t.Fatal("raw attention telemetry was aggregated")
	}
}

func TestProtectedCohortMemberRejectedBeforeGrouping(t *testing.T) {
	_, err := cohorts.Build(cohorts.Definition{ID: "activity", Version: "v1", Description: "test", MinMembers: 2}, provenance(), []cohorts.Member{
		{EntityID: "a", Cohort: "x", Score: "1", PrivacyClass: string(privacy.PrivateMessenger)},
		{EntityID: "b", Cohort: "x", Score: "2"},
	})
	if err == nil {
		t.Fatal("private messenger member entered cohort")
	}
}
