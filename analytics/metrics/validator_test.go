package metrics

import (
	"math"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/analytics/model"
)

func validatorProvenance() model.Provenance {
	return model.Provenance{
		Source: "420Indexer", ChainID: 420, IndexedHeight: 100,
		IndexedHeadHash: "0xabc", SafeHeight: 98,
		IndexedAt: time.Unix(2_000_000_000, 0).UTC(),
	}
}

func TestBuildValidatorMetrics(t *testing.T) {
	metrics, err := BuildValidatorMetrics(ValidatorInput{
		Source: "420Indexer",
		Validators: []ValidatorProjection{
			{Validator: "0x1", Lifecycle: ValidatorActive, NativeCollateral: 10, CommunityCollateral: 5, AccruedRewards: 2},
			{Validator: "0x2", Lifecycle: ValidatorCooldown, NativeCollateral: 20, CommunityCollateral: 0, AccruedRewards: 3},
		},
	}, validatorProvenance())
	if err != nil { t.Fatal(err) }
	if len(metrics) != 5 { t.Fatalf("expected 5 metrics, got %d", len(metrics)) }
	want := map[string]string{
		MetricValidatorCount: "2",
		MetricActiveValidatorCount: "1",
		MetricNativeCollateral: "30",
		MetricCommunityCollateral: "5",
		MetricAccruedRewards: "5",
	}
	for _, metric := range metrics {
		if metric.Class != "validator" { t.Fatalf("unexpected class for %s: %s", metric.ID, metric.Class) }
		if metric.Canonical { t.Fatalf("validator metric %s became canonical", metric.ID) }
		if got := metric.Value; got != want[metric.ID] { t.Fatalf("%s=%s want %s", metric.ID, got, want[metric.ID]) }
		if metric.Provenance != validatorProvenance() { t.Fatalf("%s lost provenance", metric.ID) }
	}
}

func TestValidatorMetricsRejectNonIndexerSource(t *testing.T) {
	_, err := BuildValidatorMetrics(ValidatorInput{Source:"node420", Validators:[]ValidatorProjection{{Validator:"0x1", Lifecycle:ValidatorActive}}}, validatorProvenance())
	if err == nil { t.Fatal("expected non-Indexer source rejection") }
}

func TestValidatorMetricsRejectEmptyProjectionSet(t *testing.T) {
	_, err := BuildValidatorMetrics(ValidatorInput{Source:"420Indexer"}, validatorProvenance())
	if err == nil { t.Fatal("expected empty projection rejection") }
}

func TestValidatorMetricsRejectDuplicateValidatorsCaseInsensitive(t *testing.T) {
	_, err := BuildValidatorMetrics(ValidatorInput{Source:"420Indexer", Validators:[]ValidatorProjection{
		{Validator:"0xAbC", Lifecycle:ValidatorActive},
		{Validator:"0xabc", Lifecycle:ValidatorRegistered},
	}}, validatorProvenance())
	if err == nil { t.Fatal("expected duplicate validator rejection") }
}

func TestValidatorMetricsRejectUnknownLifecycle(t *testing.T) {
	_, err := BuildValidatorMetrics(ValidatorInput{Source:"420Indexer", Validators:[]ValidatorProjection{{Validator:"0x1", Lifecycle:"delegated"}}}, validatorProvenance())
	if err == nil { t.Fatal("expected unsupported lifecycle rejection") }
}

func TestValidatorMetricsRejectOverflow(t *testing.T) {
	_, err := BuildValidatorMetrics(ValidatorInput{Source:"420Indexer", Validators:[]ValidatorProjection{
		{Validator:"0x1", Lifecycle:ValidatorActive, NativeCollateral:math.MaxUint64},
		{Validator:"0x2", Lifecycle:ValidatorActive, NativeCollateral:1},
	}}, validatorProvenance())
	if err == nil { t.Fatal("expected collateral overflow rejection") }
}
